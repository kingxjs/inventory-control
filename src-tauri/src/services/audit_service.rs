use chrono::Utc;
use serde_json::Value;
use uuid::Uuid;

use crate::domain::audit::AuditAction;
use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::audit_repo::{self, AuditLogRow};
use crate::repo::operator_repo;
use crate::repo::meta_repo;
use sqlx::SqlitePool;

/// 写入审计日志并统一格式化结果
pub async fn write_audit(
  pool: &SqlitePool,
  action: AuditAction,
  actor_operator_id: Option<String>,
  target_type: Option<String>,
  target_id: Option<String>,
  request_json: Option<Value>,
  result: Result<(), &AppError>,
) -> Result<(), AppError> {
  // 统一构建审计记录并写入数据库
  let now = Utc::now().timestamp();
  let (result_str, error_code, error_detail) = match result {
    Ok(_) => ("success".to_string(), None, None),
    Err(err) => (
      "fail".to_string(),
      Some(err.code.as_str().to_string()),
      Some(truncate_error(&err.message)),
    ),
  };

  let request_json = request_json.map(|val| val.to_string());

  let row = AuditLogRow {
    id: Uuid::new_v4().to_string(),
    created_at: now,
    actor_operator_id,
    actor_operator_name: None,
    action: action.as_str().to_string(),
    target_type,
    target_id,
    request_json,
    result: result_str,
    error_code,
    error_detail,
  };

  audit_repo::insert_audit_log(pool, row).await
}

/// 审计列表返回结构
#[derive(Debug, serde::Serialize)]
pub struct AuditListResult {
  // 审计记录列表
  pub items: Vec<AuditLogRow>,
  // 总数
  pub total: i64,
}

/// 审计导出返回结构
#[derive(Debug, serde::Serialize)]
pub struct AuditExportResult {
  // 导出文件路径
  pub file_path: String,
}

/// 查询审计列表
pub async fn list_audit_logs(
  pool: &SqlitePool,
  action: Option<String>,
  keyword: Option<String>,
  start_at: Option<i64>,
  end_at: Option<i64>,
  page_index: i64,
  page_size: i64,
) -> Result<AuditListResult, AppError> {
  let (page_index, page_size) = normalize_page(page_index, page_size)?;
  let total =
    audit_repo::count_audit_logs(pool, action.clone(), keyword.clone(), start_at, end_at)
      .await?;
  let mut items = audit_repo::list_audit_logs(
    pool,
    action,
    keyword,
    start_at,
    end_at,
    page_index,
    page_size,
  )
  .await?;
  attach_actor_names(pool, &mut items).await?;
  Ok(AuditListResult { items, total })
}

fn normalize_page(page_index: i64, page_size: i64) -> Result<(i64, i64), AppError> {
  if page_index < 1 || page_size < 1 {
    return Err(AppError::new(ErrorCode::ValidationError, "分页参数非法"));
  }
  Ok((page_index, page_size))
}

/// 导出审计日志为 CSV
pub async fn export_audit_logs(pool: &SqlitePool) -> Result<AuditExportResult, AppError> {
  // 在移动端使用临时文件，桌面端使用导出目录
  #[cfg(any(target_os = "android", target_os = "ios"))]
  let file_path = {
      let temp_dir = std::env::temp_dir();
      let now = Utc::now().timestamp();
      temp_dir.join(format!("audit_logs_{}.csv", now))
  };
  
  #[cfg(not(any(target_os = "android", target_os = "ios")))]
  let file_path = {
      let storage_root = meta_repo::get_meta_value(pool, "storage_root")
          .await?
          .ok_or_else(|| AppError::new(ErrorCode::NotFound, "存储根目录未配置"))?;
      let export_dir = match meta_repo::get_meta_value(pool, "exports_dir").await? {
          Some(dir) if !dir.is_empty() => std::path::PathBuf::from(dir),
          _ => std::path::PathBuf::from(storage_root).join("exports"),
      };
      std::fs::create_dir_all(&export_dir)
          .map_err(|_| AppError::new(ErrorCode::IoError, "创建导出目录失败"))?;
      let now = Utc::now().timestamp();
      export_dir.join(format!("audit_logs_{}.csv", now))
  };
  let mut lines = Vec::new();
  lines.push("id,created_at,actor_operator_id,actor_operator_name,action,target_type,target_id,request_json,result,error_code,error_detail".to_string());

  let mut items = audit_repo::list_audit_logs_all(pool, None).await?;
  attach_actor_names(pool, &mut items).await?;
  for item in items {
    lines.push(format!(
      "{},{},{},{},{},{},{},{},{},{},{}",
      escape_csv(&item.id),
      item.created_at,
      escape_csv(item.actor_operator_id.as_deref().unwrap_or("")),
      escape_csv(item.actor_operator_name.as_deref().unwrap_or("")),
      escape_csv(&item.action),
      escape_csv(item.target_type.as_deref().unwrap_or("")),
      escape_csv(item.target_id.as_deref().unwrap_or("")),
      escape_csv(item.request_json.as_deref().unwrap_or("")),
      escape_csv(&item.result),
      escape_csv(item.error_code.as_deref().unwrap_or("")),
      escape_csv(item.error_detail.as_deref().unwrap_or(""))
    ));
  }

  std::fs::write(&file_path, lines.join("\n"))
    .map_err(|_| AppError::new(ErrorCode::IoError, "写入导出文件失败"))?;

  Ok(AuditExportResult {
    file_path: file_path.to_string_lossy().to_string(),
  })
}

/// 截断错误详情，防止审计记录过长
fn truncate_error(message: &str) -> String {
  let max_len = 200;
  if message.len() <= max_len {
    return message.to_string();
  }

  message.chars().take(max_len).collect()
}

/// 错误码字符串化
trait ErrorCodeStr {
  // 错误码转换为规范字符串
  fn as_str(&self) -> &'static str;
}

/// CSV 字段转义
fn escape_csv(value: &str) -> String {
  let needs_wrap = value.contains(',') || value.contains('"') || value.contains('\n');
  if !needs_wrap {
    return value.to_string();
  }
  let escaped = value.replace('"', "\"\"");
  format!("\"{}\"", escaped)
}

async fn attach_actor_names(
  pool: &SqlitePool,
  items: &mut [AuditLogRow],
) -> Result<(), AppError> {
  let ids: Vec<String> = items
    .iter()
    .filter_map(|item| item.actor_operator_id.clone())
    .collect();
  let names = operator_repo::list_operator_names_by_ids(pool, &ids).await?;
  for item in items.iter_mut() {
    if let Some(id) = item.actor_operator_id.as_ref() {
      if let Some(name) = names.get(id) {
        item.actor_operator_name = Some(name.clone());
      }
    }
  }
  Ok(())
}

impl ErrorCodeStr for ErrorCode {
  fn as_str(&self) -> &'static str {
    match self {
      ErrorCode::AuthFailed => "AUTH_FAILED",
      ErrorCode::PwdChangeRequired => "PWD_CHANGE_REQUIRED",
      ErrorCode::ValidationError => "VALIDATION_ERROR",
      ErrorCode::NotFound => "NOT_FOUND",
      ErrorCode::InactiveResource => "INACTIVE_RESOURCE",
      ErrorCode::InsufficientStock => "INSUFFICIENT_STOCK",
      ErrorCode::Conflict => "CONFLICT",
      ErrorCode::Forbidden => "FORBIDDEN",
      ErrorCode::DbError => "DB_ERROR",
      ErrorCode::IoError => "IO_ERROR",
    }
  }
}
