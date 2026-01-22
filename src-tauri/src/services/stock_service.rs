use chrono::Utc;
use sqlx::SqlitePool;

use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::{meta_repo, stock_query_repo};

#[derive(Debug, serde::Serialize)]
pub struct StockBySlotResult {
  pub items: Vec<stock_query_repo::StockBySlotRow>,
  pub total: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct StockByItemResult {
  pub items: Vec<stock_query_repo::StockByItemRow>,
  pub total: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct StockExportResult {
  pub file_path: String,
}

pub async fn list_stock_by_slot(
  pool: &SqlitePool,
  page_index: i64,
  page_size: i64,
  warehouse_id: Option<String>,
  rack_id: Option<String>,
  slot_id: Option<String>,
  item_id: Option<String>,
  operator_id: Option<String>,
) -> Result<StockBySlotResult, AppError> {
  let (page_index, page_size) = normalize_page(page_index, page_size)?;
  let total = stock_query_repo::count_stock_by_slot_filtered(pool, warehouse_id.clone(), rack_id.clone(), slot_id.clone(), item_id.clone(), operator_id.clone()).await?;
  let items = stock_query_repo::list_stock_by_slot(pool, page_index, page_size, warehouse_id, rack_id, slot_id, item_id, operator_id).await?;
  Ok(StockBySlotResult { items, total })
}

pub async fn list_stock_by_item(
  pool: &SqlitePool,
  page_index: i64,
  page_size: i64,
  warehouse_id: Option<String>,
  rack_id: Option<String>,
  slot_id: Option<String>,
  item_id: Option<String>,
  operator_id: Option<String>,
) -> Result<StockByItemResult, AppError> {
  let (page_index, page_size) = normalize_page(page_index, page_size)?;
  let total = stock_query_repo::count_stock_by_item_filtered(pool, warehouse_id.clone(), rack_id.clone(), slot_id.clone(), item_id.clone(), operator_id.clone()).await?;
  let items = stock_query_repo::list_stock_by_item_filtered(pool, page_index, page_size, warehouse_id, rack_id, slot_id, item_id, operator_id).await?;
  Ok(StockByItemResult { items, total })
}

pub async fn export_stock(pool: &SqlitePool) -> Result<StockExportResult, AppError> {
  let storage_root = meta_repo::get_meta_value(pool, "storage_root")
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "存储根目录未配置"))?;
  let export_dir = std::path::PathBuf::from(storage_root).join("exports");
  std::fs::create_dir_all(&export_dir)
    .map_err(|_| AppError::new(ErrorCode::IoError, "创建导出目录失败"))?;

  let now = Utc::now().timestamp();
  let file_path = export_dir.join(format!("stock_export_{}.csv", now));
  let mut lines = Vec::new();
  lines.push("rack_code,slot_code,item_code,item_name,qty".to_string());

  let items = stock_query_repo::list_stock_by_slot_all(pool).await?;
  for item in items {
    lines.push(format!(
      "{},{},{},{},{}",
      escape_csv(&item.rack_code),
      escape_csv(&item.slot_code),
      escape_csv(&item.item_code),
      escape_csv(&item.item_name),
      item.qty
    ));
  }

  std::fs::write(&file_path, lines.join("\n"))
    .map_err(|_| AppError::new(ErrorCode::IoError, "写入导出文件失败"))?;

  Ok(StockExportResult {
    file_path: file_path.to_string_lossy().to_string(),
  })
}

fn normalize_page(page_index: i64, page_size: i64) -> Result<(i64, i64), AppError> {
  if page_index < 1 || page_size < 1 {
    return Err(AppError::new(ErrorCode::ValidationError, "分页参数非法"));
  }
  Ok((page_index, page_size))
}

fn escape_csv(value: &str) -> String {
  let needs_wrap = value.contains(',') || value.contains('"') || value.contains('\n');
  if !needs_wrap {
    return value.to_string();
  }
  let escaped = value.replace('"', "\"\"");
  format!("\"{}\"", escaped)
}
