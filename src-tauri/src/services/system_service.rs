use std::path::PathBuf;

use chrono::Utc;
use sqlx::SqlitePool;

use crate::domain::audit::AuditAction;
use crate::domain::errors::{AppError, ErrorCode};
use crate::infra::fs;
use crate::repo::{meta_repo, photo_repo};
use crate::services::audit_service;

/// 系统设置返回结构
#[derive(Debug, serde::Serialize)]
pub struct SettingsDto {
  // 是否启用 RBAC
  pub rbac_enabled: bool,
  // 存储根目录
  pub storage_root: String,
  // 导出目录
  pub exports_dir: String,
  // 备份目录
  pub backups_dir: String,
  // 库位号补零位数
  pub slot_no_pad: i64,
  // 低库存阈值
  pub low_stock_threshold: i64,
}

/// 查询系统设置
pub async fn get_settings(pool: &SqlitePool) -> Result<SettingsDto, AppError> {
  let rbac = meta_repo::get_meta_value(pool, "rbac_enabled")
    .await?
    .unwrap_or_else(|| "0".to_string());
  let storage_root = meta_repo::get_meta_value(pool, "storage_root")
    .await?
    .unwrap_or_default();
  let slot_no_pad = meta_repo::get_meta_value(pool, "slot_no_pad")
    .await?
    .and_then(|value| value.parse::<i64>().ok())
    .filter(|value| *value > 0)
    .unwrap_or(2);
  let low_stock_threshold = meta_repo::get_meta_value(pool, "low_stock_threshold")
    .await?
    .and_then(|value| value.parse::<i64>().ok())
    .filter(|value| *value >= 0)
    .unwrap_or(0);

  let exports_dir = meta_repo::get_meta_value(pool, "exports_dir")
    .await?
    .unwrap_or_default();

  let backups_dir = meta_repo::get_meta_value(pool, "backups_dir")
    .await?
    .unwrap_or_default();

  Ok(SettingsDto {
    rbac_enabled: rbac == "1",
    storage_root,
    exports_dir,
    backups_dir,
    slot_no_pad,
    low_stock_threshold,
  })
}

/// 更新系统设置
pub async fn set_settings(
  pool: &SqlitePool,
  rbac_enabled: Option<bool>,
  slot_no_pad: Option<i64>,
  low_stock_threshold: Option<i64>,
) -> Result<(), AppError> {
  if let Some(rbac_enabled) = rbac_enabled {
    let value = if rbac_enabled { "1" } else { "0" };
    meta_repo::set_meta_value(pool, "rbac_enabled", value).await?;
  }
  if let Some(slot_no_pad) = slot_no_pad {
    if slot_no_pad < 1 {
      return Err(AppError::new(
        ErrorCode::ValidationError,
        "slot_no_pad 必须大于 0",
      ));
    }
    meta_repo::set_meta_value(pool, "slot_no_pad", &slot_no_pad.to_string()).await?;
  }
  if let Some(low_stock_threshold) = low_stock_threshold {
    if low_stock_threshold < 0 {
      return Err(AppError::new(
        ErrorCode::ValidationError,
        "low_stock_threshold 不能为负数",
      ));
    }
    meta_repo::set_meta_value(
      pool,
      "low_stock_threshold",
      &low_stock_threshold.to_string(),
    )
    .await?;
  }
  Ok(())
}

/// 迁移存储根目录并更新配置
pub async fn set_storage_root(
  pool: &SqlitePool,
  new_path: &str,
  actor_operator_id: &str,
) -> Result<(), AppError> {
  let new_root = fs::normalize_path(new_path)?;
  fs::ensure_not_sensitive_dir(&new_root)?;
  fs::ensure_dir_ready(&new_root)?;
  if !fs::is_dir_writable(&new_root)? {
    return Err(AppError::new(ErrorCode::ValidationError, "目标目录不可写"));
  }
  fs::ensure_dir_empty_or_allowed(&new_root, &["db", "photos", "exports", "backups"])?;

  let old_root_str = meta_repo::get_meta_value(pool, "storage_root")
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "旧存储目录不存在"))?;
  let old_root = PathBuf::from(old_root_str);
  if new_root == old_root {
    return Ok(());
  }

  let new_db = new_root.join("db");
  let new_photos = new_root.join("photos");
  let new_exports = new_root.join("exports");
  let new_backups = new_root.join("backups");
  fs::ensure_dir(&new_db)?;
  fs::ensure_dir(&new_photos)?;
  fs::ensure_dir(&new_exports)?;
  fs::ensure_dir(&new_backups)?;

  migrate_dir(&old_root.join("db"), &new_db)?;
  migrate_dir(&old_root.join("photos"), &new_photos)?;
  migrate_dir(&old_root.join("exports"), &new_exports)?;
  migrate_dir(&old_root.join("backups"), &new_backups)?;

  rewrite_photo_paths(pool, &old_root, &new_root, actor_operator_id).await?;
  meta_repo::set_meta_value(pool, "storage_root", &new_root.to_string_lossy()).await?;

  Ok(())
}

/// 备份数据库文件
pub async fn backup_db(pool: &SqlitePool) -> Result<String, AppError> {
  let storage_root = meta_repo::get_meta_value(pool, "storage_root")
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "存储根目录未配置"))?;
  let root = PathBuf::from(storage_root);
  let db_path = root.join("db").join("db.sqlite");
  if !db_path.exists() {
    return Err(AppError::new(ErrorCode::NotFound, "数据库文件不存在"));
  }

  // 移动端使用临时目录，桌面端使用备份目录
  #[cfg(any(target_os = "android", target_os = "ios"))]
  let backups_dir = std::env::temp_dir();
  
  #[cfg(not(any(target_os = "android", target_os = "ios")))]
  let backups_dir = root.join("backups");
  
  fs::ensure_dir(&backups_dir)?;
  let now = Utc::now().timestamp();
  let backup_path = backups_dir.join(format!("db_backup_{}.sqlite", now));
  std::fs::copy(&db_path, &backup_path)
    .map_err(|_| AppError::new(ErrorCode::IoError, "备份数据库失败"))?;

  Ok(backup_path.to_string_lossy().to_string())
}

/// 从备份文件恢复数据库
pub async fn restore_db(pool: &SqlitePool, src_path: &str) -> Result<(), AppError> {
  let storage_root = meta_repo::get_meta_value(pool, "storage_root")
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "存储根目录未配置"))?;
  let root = PathBuf::from(storage_root);
  let db_path = root.join("db").join("db.sqlite");

  let src = fs::normalize_path(src_path)?;
  if !src.exists() {
    return Err(AppError::new(ErrorCode::NotFound, "备份文件不存在"));
  }

  std::fs::copy(&src, &db_path)
    .map_err(|_| AppError::new(ErrorCode::IoError, "恢复数据库失败"))?;
  Ok(())
}

/// 迁移目录（同盘移动/跨盘拷贝）
fn migrate_dir(from: &PathBuf, to: &PathBuf) -> Result<(), AppError> {
  if !from.exists() {
    return Ok(());
  }
  if from == to {
    return Ok(());
  }
  fs::move_or_copy_dir(from, to)?;
  Ok(())
}

/// 重写照片路径为相对路径并写入审计
async fn rewrite_photo_paths(
  pool: &SqlitePool,
  old_root: &PathBuf,
  _new_root: &PathBuf,
  actor_operator_id: &str,
) -> Result<(), AppError> {
  let photos = photo_repo::list_all_photos(pool).await?;
  for photo in photos {
    let path = PathBuf::from(&photo.file_path);
    if !path.is_absolute() {
      continue;
    }
    let relative = path
      .strip_prefix(old_root)
      .map(|p| p.to_path_buf())
      .unwrap_or_else(|_| {
        if let Some(idx) = photo.file_path.find("/photos/") {
          PathBuf::from(&photo.file_path[idx + 1..])
        } else {
          PathBuf::from(&photo.file_path)
        }
      });
    let relative_str = relative.to_string_lossy().to_string();
    photo_repo::update_photo_path(pool, &photo.id, &relative_str).await?;
    let audit_request = serde_json::json!({
      "photo_id": photo.id,
      "old_path": photo.file_path,
      "new_path": relative_str.clone()
    });
    let (action, target_type) = if photo.photo_type == "txn" {
      (AuditAction::MediaAttachmentTxnPathRewrite, "media_attachment")
    } else {
      (AuditAction::MediaAttachmentItemPathRewrite, "media_attachment")
    };
    let _ = audit_service::write_audit(
      pool,
      action,
      Some(actor_operator_id.to_string()),
      Some(target_type.to_string()),
      Some(photo.id.clone()),
      Some(audit_request),
      Ok(()),
    )
    .await;
  }

  Ok(())
}

/// 统一时间戳入口
pub fn now_ts() -> i64 {
  Utc::now().timestamp()
}
