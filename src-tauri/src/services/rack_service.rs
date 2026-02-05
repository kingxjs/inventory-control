use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::rack_repo::{RackRow, SlotRow};
use crate::repo::{rack_repo, stock_repo};
use crate::repo::warehouse_repo;
use crate::services::warehouse_service;

#[derive(Debug, serde::Serialize)]
pub struct RackListResult {
  pub items: Vec<RackRow>,
  pub total: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct SlotListResult {
  pub items: Vec<SlotRow>,
}

pub async fn list_racks(
  pool: &SqlitePool,
  page_index: i64,
  page_size: i64,
  keyword: Option<String>,
  warehouse_id: Option<String>,
) -> Result<RackListResult, AppError> {
  let (page_index, page_size) = normalize_page(page_index, page_size)?;
  let total = rack_repo::count_racks(pool, keyword.clone(), warehouse_id.clone()).await?;
  let items = rack_repo::list_racks(pool, page_index, page_size, keyword, warehouse_id).await?;
  Ok(RackListResult { items, total })
}

pub async fn list_slots(
  pool: &SqlitePool,
  rack_id: Option<String>,
  warehouse_id: Option<String>,
  level_no: Option<i64>,
) -> Result<SlotListResult, AppError> {
  let items = rack_repo::list_slots(pool, rack_id, warehouse_id, level_no).await?;
  Ok(SlotListResult { items })
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

pub async fn create_rack(
  pool: &SqlitePool,
  code: &str,
  name: &str,
  warehouse_id: Option<String>,
  location: Option<String>,
  level_count: i64,
  slots_per_level: i64,
) -> Result<(), AppError> {
  if code.trim().is_empty() || name.trim().is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "货架编号或名称不能为空"));
  }
  if level_count < 1 || slots_per_level < 1 {
    return Err(AppError::new(ErrorCode::ValidationError, "层数或格数非法"));
  }

  // 先规范并验证仓库，再基于仓库判断编号是否重复
  let normalized_warehouse_id = warehouse_id
    .as_ref()
    .map(|value| value.trim())
    .filter(|value| !value.is_empty())
    .map(|value| value.to_string())
    .ok_or_else(|| AppError::new(ErrorCode::ValidationError, "请选择仓库"))?;

  warehouse_service::ensure_warehouse_exists(pool, &normalized_warehouse_id).await?;
  let mut warehouse_code: Option<String> = None;
  if let Some(warehouse) = warehouse_repo::get_warehouse_by_id(pool, &normalized_warehouse_id).await? {
    warehouse_code = Some(warehouse.code);
  }

  let normalized_code = normalize_rack_code(code)?;
  if rack_repo::get_rack_by_code_and_warehouse(pool, &normalized_code, &normalized_warehouse_id)
    .await?
    .is_some()
  {
    return Err(AppError::new(ErrorCode::Conflict, "该仓库下的货架编号已存在"));
  }

  let id = Uuid::new_v4().to_string();
  let now = Utc::now().timestamp();
  rack_repo::insert_rack(
    pool,
    &id,
    &normalized_code,
    name,
    Some(normalized_warehouse_id.clone()),
    location,
    "active",
    level_count,
    slots_per_level,
    now,
  )
  .await?;

  // 自动生成 slots
  regenerate_slots(
    pool,
    &id,
    &normalized_code,
    Some(&normalized_warehouse_id),
    warehouse_code.as_deref(),
    level_count,
    slots_per_level,
    now,
  )
  .await?;

  Ok(())
}

pub async fn update_rack(
  pool: &SqlitePool,
  id: &str,
  name: &str,
  warehouse_id: Option<String>,
  location: Option<String>,
  level_count: i64,
  slots_per_level: i64,
) -> Result<(), AppError> {
  if name.trim().is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "货架名称不能为空"));
  }
  if level_count < 1 || slots_per_level < 1 {
    return Err(AppError::new(ErrorCode::ValidationError, "层数或格数非法"));
  }

  let normalized_warehouse_id = warehouse_id
    .as_ref()
    .map(|value| value.trim())
    .filter(|value| !value.is_empty())
    .map(|value| value.to_string())
    .ok_or_else(|| AppError::new(ErrorCode::ValidationError, "请选择仓库"))?;
  warehouse_service::ensure_warehouse_exists(pool, &normalized_warehouse_id).await?;

  rack_repo::update_rack(
    pool,
    id,
    name,
    Some(normalized_warehouse_id),
    location,
    level_count,
    slots_per_level,
  )
  .await?;
  Ok(())
}

pub async fn set_rack_status(pool: &SqlitePool, id: &str, status: &str) -> Result<(), AppError> {
  if !matches!(status, "active" | "inactive") {
    return Err(AppError::new(ErrorCode::ValidationError, "状态非法"));
  }
  if status == "inactive" {
    let count = stock_repo::count_stock_by_rack(pool, id).await?;
    if count > 0 {
      return Err(AppError::new(ErrorCode::Conflict, "货架仍有库存，无法停用"));
    }
  }

  rack_repo::set_rack_status(pool, id, status).await?;
  Ok(())
}

pub async fn set_slot_status(
  pool: &SqlitePool,
  slot_id: &str,
  status: &str,
) -> Result<(), AppError> {
  if !matches!(status, "active" | "inactive") {
    return Err(AppError::new(ErrorCode::ValidationError, "状态非法"));
  }
  if status == "inactive" {
    let count = stock_repo::count_stock_by_slot(pool, slot_id).await?;
    if count > 0 {
      return Err(AppError::new(ErrorCode::Conflict, "库位仍有库存，无法停用"));
    }
  }

  rack_repo::set_slot_status(pool, slot_id, status).await?;
  Ok(())
}

fn normalize_rack_code(code: &str) -> Result<String, AppError> {
  let trimmed = code.trim();
  let suffix = trimmed.trim_start_matches(|value: char| value == 'R' || value == 'r');
  if suffix.is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "货架编号不能为空"));
  }
  if !suffix.chars().all(|value| value.is_ascii_digit()) {
    return Err(AppError::new(
      ErrorCode::ValidationError,
      "货架编号只能输入数字",
    ));
  }
  Ok(suffix.to_string())
}

pub async fn regenerate_slots(
  pool: &SqlitePool,
  rack_id: &str,
  rack_code: &str,
  warehouse_id: Option<&str>,
  warehouse_code: Option<&str>,
  level_count: i64,
  slots_per_level: i64,
  now: i64,
) -> Result<(), AppError> {
  // 先删除后创建，确保一致性
  rack_repo::delete_slots_by_rack(pool, rack_id).await?;
  // resolve warehouse id and code (we need both: id saved in slot.warehouse_id, code used for slot.code)
  let mut resolved_warehouse_id = warehouse_id.map(|v| v.to_string());
  if resolved_warehouse_id.is_none() {
    if let Some(rack) = rack_repo::get_rack_by_id(pool, rack_id).await? {
      if let Some(wid) = rack.warehouse_id {
        resolved_warehouse_id = Some(wid);
      }
    }
  }

  let resolved_warehouse_id = resolved_warehouse_id.ok_or_else(|| {
    AppError::new(ErrorCode::ValidationError, "仓库缺失，无法生成库位编码")
  })?;

  let mut resolved_warehouse_code = warehouse_code.map(|v| v.to_string());
  if resolved_warehouse_code.is_none() {
    if let Some(warehouse) = warehouse_repo::get_warehouse_by_id(pool, &resolved_warehouse_id).await? {
      resolved_warehouse_code = Some(warehouse.code);
    }
  }

  let resolved_warehouse_code = resolved_warehouse_code.ok_or_else(|| {
    AppError::new(ErrorCode::ValidationError, "仓库缺失，无法生成库位编码")
  })?;

  let mut slots = Vec::new();
  for level in 1..=level_count {
    for slot_no in 1..=slots_per_level {
      let base_code = format!(
        "{}-{}-{}",
        rack_code,
        level,
        slot_no
      );
      let code = format!("{}-{}", resolved_warehouse_code, base_code);
      slots.push(SlotRow {
        id: Uuid::new_v4().to_string(),
        rack_id: rack_id.to_string(),
        warehouse_id: Some(resolved_warehouse_id.clone()),
        level_no: level,
        slot_no,
        code,
        status: "active".to_string(),
        created_at: now,
      });
    }
  }

  rack_repo::insert_slots(pool, slots).await?;
  Ok(())
}
