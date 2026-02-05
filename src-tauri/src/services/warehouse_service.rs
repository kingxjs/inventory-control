use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::warehouse_repo::{WarehouseRow};
use crate::repo::warehouse_repo;

#[derive(Debug, serde::Serialize)]
pub struct WarehouseListResult {
  pub items: Vec<WarehouseRow>,
  pub total: i64,
}

pub async fn list_warehouses(
  pool: &SqlitePool,
  keyword: Option<String>,
  status: Option<String>,
  page_index: i64,
  page_size: i64,
) -> Result<WarehouseListResult, AppError> {
  let (page_index, page_size) = normalize_page(page_index, page_size)?;
  let total = warehouse_repo::count_warehouses_with_filter(pool, keyword.clone(), status.clone()).await?;
  let items =
    warehouse_repo::list_warehouses(pool, keyword, status, page_index, page_size).await?;
  Ok(WarehouseListResult { items, total })
}

fn normalize_page(page_index: i64, page_size: i64) -> Result<(i64, i64), AppError> {
  if page_index < 1 || page_size < 1 {
    return Err(AppError::new(
      ErrorCode::ValidationError,
      "分页参数非法",
    ));
  }
  Ok((page_index, page_size))
}

pub async fn create_warehouse(
  pool: &SqlitePool,
  code: &str,
  name: &str,
) -> Result<(), AppError> {
  if code.trim().is_empty() || name.trim().is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "仓库编号或名称不能为空"));
  }
  let normalized_code = normalize_warehouse_code(code)?;
  if warehouse_repo::get_warehouse_by_code(pool, &normalized_code)
    .await?
    .is_some()
  {
    return Err(AppError::new(ErrorCode::Conflict, "仓库编号已存在"));
  }
  let id = Uuid::new_v4().to_string();
  let now = Utc::now().timestamp();
  warehouse_repo::insert_warehouse(pool, &id, &normalized_code, name, "active", now).await?;
  Ok(())
}

pub async fn update_warehouse(
  pool: &SqlitePool,
  id: &str,
  name: &str,
) -> Result<(), AppError> {
  if name.trim().is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "仓库名称不能为空"));
  }
  warehouse_repo::update_warehouse(pool, id, name).await?;
  Ok(())
}

pub async fn set_warehouse_status(
  pool: &SqlitePool,
  id: &str,
  status: &str,
) -> Result<(), AppError> {
  if !matches!(status, "active" | "inactive") {
    return Err(AppError::new(ErrorCode::ValidationError, "状态非法"));
  }
  warehouse_repo::set_warehouse_status(pool, id, status).await?;
  Ok(())
}

pub async fn ensure_warehouse_exists(
  pool: &SqlitePool,
  warehouse_id: &str,
) -> Result<(), AppError> {
  if warehouse_repo::get_warehouse_by_id(pool, warehouse_id)
    .await?
    .is_none()
  {
    return Err(AppError::new(ErrorCode::NotFound, "仓库不存在"));
  }
  Ok(())
}

fn normalize_warehouse_code(code: &str) -> Result<String, AppError> {
  let trimmed = code.trim();
  let suffix = trimmed.trim_start_matches(|value: char| value == 'W' || value == 'w');
  if suffix.is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "仓库编号不能为空"));
  }
  if !suffix.chars().all(|value| value.is_ascii_digit()) {
    return Err(AppError::new(
      ErrorCode::ValidationError,
      "仓库编号只能输入数字",
    ));
  }
  Ok(suffix.to_string())
}
