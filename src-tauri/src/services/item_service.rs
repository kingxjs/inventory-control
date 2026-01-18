use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::item_repo::{self, ItemRow};

#[derive(Debug, serde::Serialize)]
pub struct ItemListResult {
  pub items: Vec<ItemRow>,
  pub total: i64,
}

pub async fn list_items(
  pool: &SqlitePool,
  keyword: Option<String>,
  page_index: i64,
  page_size: i64,
) -> Result<ItemListResult, AppError> {
  let (page_index, page_size) = normalize_page(page_index, page_size)?;
  let total = item_repo::count_items(pool, keyword.clone()).await?;
  let items = item_repo::list_items(pool, keyword, page_index, page_size).await?;
  Ok(ItemListResult { items, total })
}

pub async fn create_item(
  pool: &SqlitePool,
  item_code: &str,
  name: &str,
  model: Option<String>,
  spec: Option<String>,
  uom: Option<String>,
  remark: Option<String>,
) -> Result<(), AppError> {
  if item_code.trim().is_empty() || name.trim().is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "物品编码或名称不能为空"));
  }

  if item_repo::count_by_item_code(pool, item_code).await? > 0 {
    return Err(AppError::new(ErrorCode::Conflict, "物品编码已存在"));
  }

  let id = Uuid::new_v4().to_string();
  let now = Utc::now().timestamp();
  item_repo::insert_item(
    pool,
    &id,
    item_code,
    name,
    model,
    spec,
    uom,
    "active",
    remark,
    now,
  )
  .await?;

  Ok(())
}

pub async fn update_item(
  pool: &SqlitePool,
  id: &str,
  name: &str,
  model: Option<String>,
  spec: Option<String>,
  uom: Option<String>,
  remark: Option<String>,
) -> Result<(), AppError> {
  if name.trim().is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "物品名称不能为空"));
  }

  item_repo::update_item(pool, id, name, model, spec, uom, remark).await?;
  Ok(())
}

pub async fn set_item_status(pool: &SqlitePool, id: &str, status: &str) -> Result<(), AppError> {
  if !matches!(status, "active" | "inactive") {
    return Err(AppError::new(ErrorCode::ValidationError, "状态非法"));
  }

  item_repo::set_item_status(pool, id, status).await?;
  Ok(())
}

fn normalize_page(page_index: i64, page_size: i64) -> Result<(i64, i64), AppError> {
  if page_index < 1 || page_size < 1 {
    return Err(AppError::new(ErrorCode::ValidationError, "分页参数非法"));
  }
  Ok((page_index, page_size))
}
