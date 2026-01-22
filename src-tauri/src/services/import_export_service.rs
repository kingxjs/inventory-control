use chrono::Utc;
use csv::{ReaderBuilder, WriterBuilder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::{item_repo, meta_repo, operator_repo};
use crate::services::txn_service;

#[derive(Debug, serde::Serialize)]
pub struct ExportResult {
  pub file_path: String,
}

pub async fn export_items(pool: &SqlitePool) -> Result<ExportResult, AppError> {
  let storage_root = meta_repo::get_meta_value(pool, "storage_root")
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "存储根目录未配置"))?;
  // 优先使用可配置的 exports_dir，否则回退到 storage_root/exports
  let export_dir = match meta_repo::get_meta_value(pool, "exports_dir").await? {
    Some(dir) if !dir.is_empty() => std::path::PathBuf::from(dir),
    _ => std::path::PathBuf::from(&storage_root).join("exports"),
  };
  std::fs::create_dir_all(&export_dir)
    .map_err(|_| AppError::new(ErrorCode::IoError, "创建导出目录失败"))?;

  let now = Utc::now().timestamp();
  let file_path = export_dir.join(format!("items_export_{}.csv", now));
  let mut writer = WriterBuilder::new()
    .has_headers(true)
    .from_path(&file_path)
    .map_err(|_| AppError::new(ErrorCode::IoError, "创建导出文件失败"))?;

  writer
    .write_record([
      "item_code",
      "name",
      "model",
      "spec",
      "uom",
      "status",
      "remark",
    ])
    .map_err(|_| AppError::new(ErrorCode::IoError, "写入导出文件失败"))?;

  let items = item_repo::list_items_all(pool).await?;
  for item in items {
    writer
      .write_record([
        item.item_code,
        item.name,
        item.model.unwrap_or_default(),
        item.spec.unwrap_or_default(),
        item.uom.unwrap_or_default(),
        item.status,
        item.remark.unwrap_or_default(),
      ])
      .map_err(|_| AppError::new(ErrorCode::IoError, "写入导出文件失败"))?;
  }

  writer
    .flush()
    .map_err(|_| AppError::new(ErrorCode::IoError, "写入导出文件失败"))?;

  Ok(ExportResult {
    file_path: file_path.to_string_lossy().to_string(),
  })
}

// txns export moved to txn_service

pub async fn import_items(pool: &SqlitePool, file_path: &str) -> Result<(), AppError> {
  let mut reader = ReaderBuilder::new()
    .has_headers(true)
    .from_path(file_path)
    .map_err(|_| AppError::new(ErrorCode::IoError, "读取导入文件失败"))?;

  for record in reader.records() {
    let record = record.map_err(|_| AppError::new(ErrorCode::IoError, "读取导入文件失败"))?;
    let item_code = record.get(0).unwrap_or("").trim().to_string();
    let name = record.get(1).unwrap_or("").trim().to_string();
    let model = empty_to_none(record.get(2));
    let spec = empty_to_none(record.get(3));
    let uom = empty_to_none(record.get(4));
    let status = record.get(5).unwrap_or("active").trim().to_string();
    let remark = empty_to_none(record.get(6));

    if item_code.is_empty() || name.is_empty() {
      return Err(AppError::new(ErrorCode::ValidationError, "物品编码或名称不能为空"));
    }
    if !matches!(status.as_str(), "active" | "inactive") {
      return Err(AppError::new(ErrorCode::ValidationError, "物品状态非法"));
    }

    if item_repo::count_by_item_code(pool, &item_code).await? > 0 {
      continue;
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();
    item_repo::insert_item(
      pool,
      &id,
      &item_code,
      &name,
      model,
      spec,
      uom,
      &status,
      remark,
      now,
    )
    .await?;
  }

  Ok(())
}

pub async fn import_txns(pool: &SqlitePool, file_path: &str) -> Result<(), AppError> {
  let mut reader = ReaderBuilder::new()
    .has_headers(true)
    .from_path(file_path)
    .map_err(|_| AppError::new(ErrorCode::IoError, "读取导入文件失败"))?;

  for record in reader.records() {
    let record = record.map_err(|_| AppError::new(ErrorCode::IoError, "读取导入文件失败"))?;
    let txn_type = record.get(0).unwrap_or("").trim();
    let item_code = record.get(1).unwrap_or("").trim();
    let from_slot_code = record.get(2).unwrap_or("").trim();
    let to_slot_code = record.get(3).unwrap_or("").trim();
    let qty = parse_i64_optional(record.get(4))?;
    let actual_qty = parse_i64_optional(record.get(5))?.unwrap_or(0);
    let occurred_at = parse_i64(record.get(6))?;
    let operator_username = record.get(7).unwrap_or("").trim();
    let operator_id = if operator_username.is_empty() {
      return Err(AppError::new(ErrorCode::ValidationError, "操作员不能为空"));
    } else {
      operator_repo::get_operator_by_username(pool, operator_username)
        .await?
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "操作员不存在"))?
        .id
    };
    let note = empty_to_none(record.get(8));
    let ref_txn_no = record.get(9).unwrap_or("").trim();

    match txn_type {
      "IN" => {
        let qty = qty.ok_or_else(|| AppError::new(ErrorCode::ValidationError, "数量不能为空"))?;
        txn_service::create_inbound(
          pool,
          item_code,
          to_slot_code,
          qty,
          occurred_at,
          &operator_id,
          note,
        )
        .await?;
      }
      "OUT" => {
        let qty = qty.ok_or_else(|| AppError::new(ErrorCode::ValidationError, "数量不能为空"))?;
        txn_service::create_outbound(
          pool,
          item_code,
          from_slot_code,
          qty,
          occurred_at,
          &operator_id,
          note,
        )
        .await?;
      }
      "MOVE" => {
        let qty = qty.ok_or_else(|| AppError::new(ErrorCode::ValidationError, "数量不能为空"))?;
        txn_service::create_move(
          pool,
          item_code,
          from_slot_code,
          to_slot_code,
          qty,
          occurred_at,
          &operator_id,
          note,
        )
        .await?;
      }
      "COUNT" => {
        txn_service::create_count(
          pool,
          item_code,
          from_slot_code,
          actual_qty,
          occurred_at,
          &operator_id,
          note,
        )
        .await?;
      }
      "REVERSAL" => {
        txn_service::reverse_txn(
          pool,
          ref_txn_no,
          occurred_at,
          &operator_id,
          note,
        )
        .await?;
      }
      _ => {
        return Err(AppError::new(ErrorCode::ValidationError, "交易类型非法"));
      }
    }
  }

  Ok(())
}

fn empty_to_none(value: Option<&str>) -> Option<String> {
  value.map(|v| v.trim()).filter(|v| !v.is_empty()).map(|v| v.to_string())
}

fn parse_i64(value: Option<&str>) -> Result<i64, AppError> {
  let value = value.unwrap_or("").trim();
  if value.is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "数值字段不能为空"));
  }
  value
    .parse::<i64>()
    .map_err(|_| AppError::new(ErrorCode::ValidationError, "数值字段非法"))
}

fn parse_i64_optional(value: Option<&str>) -> Result<Option<i64>, AppError> {
  let value = value.unwrap_or("").trim();
  if value.is_empty() {
    return Ok(None);
  }
  value
    .parse::<i64>()
    .map(Some)
    .map_err(|_| AppError::new(ErrorCode::ValidationError, "数值字段非法"))
}
