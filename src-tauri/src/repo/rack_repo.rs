use sqlx::{Row, SqlitePool};

use crate::domain::errors::{AppError, ErrorCode};

#[derive(Debug, serde::Serialize)]
pub struct RackRow {
  pub id: String,
  pub code: String,
  pub name: String,
  pub warehouse_id: Option<String>,
  pub location: Option<String>,
  pub status: String,
  pub level_count: i64,
  pub slots_per_level: i64,
  pub created_at: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct SlotRow {
  pub id: String,
  pub rack_id: String,
  pub level_no: i64,
  pub slot_no: i64,
  pub code: String,
  pub status: String,
  pub created_at: i64,
}

pub async fn list_racks(
  pool: &SqlitePool,
  page_index: i64,
  page_size: i64,
) -> Result<Vec<RackRow>, AppError> {
  let offset = (page_index - 1) * page_size;
  let rows = sqlx::query(
    "SELECT id, code, name, warehouse_id, location, status, level_count, slots_per_level, created_at \
     FROM rack ORDER BY created_at DESC LIMIT ? OFFSET ?",
  )
  .bind(page_size)
  .bind(offset)
  .fetch_all(pool)
  .await?;

  let items = rows
    .into_iter()
    .map(|row| RackRow {
      id: row.get("id"),
      code: row.get("code"),
      name: row.get("name"),
      warehouse_id: row.get("warehouse_id"),
      location: row.get("location"),
      status: row.get("status"),
      level_count: row.get("level_count"),
      slots_per_level: row.get("slots_per_level"),
      created_at: row.get("created_at"),
    })
    .collect();

  Ok(items)
}

pub async fn count_racks(pool: &SqlitePool) -> Result<i64, AppError> {
  let (count,): (i64,) = sqlx::query_as("SELECT COUNT(1) FROM rack")
    .fetch_one(pool)
    .await?;
  Ok(count)
}

pub async fn get_rack_by_code(pool: &SqlitePool, code: &str) -> Result<Option<RackRow>, AppError> {
  let row = sqlx::query(
    "SELECT id, code, name, warehouse_id, location, status, level_count, slots_per_level, created_at \
     FROM rack WHERE code = ?",
  )
  .bind(code)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| RackRow {
    id: row.get("id"),
    code: row.get("code"),
    name: row.get("name"),
    warehouse_id: row.get("warehouse_id"),
    location: row.get("location"),
    status: row.get("status"),
    level_count: row.get("level_count"),
    slots_per_level: row.get("slots_per_level"),
    created_at: row.get("created_at"),
  }))
}

pub async fn get_rack_by_code_and_warehouse(
  pool: &SqlitePool,
  code: &str,
  warehouse_id: &str,
) -> Result<Option<RackRow>, AppError> {
  let row = sqlx::query(
    "SELECT id, code, name, warehouse_id, location, status, level_count, slots_per_level, created_at \
     FROM rack WHERE code = ? AND warehouse_id = ?",
  )
  .bind(code)
  .bind(warehouse_id)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| RackRow {
    id: row.get("id"),
    code: row.get("code"),
    name: row.get("name"),
    warehouse_id: row.get("warehouse_id"),
    location: row.get("location"),
    status: row.get("status"),
    level_count: row.get("level_count"),
    slots_per_level: row.get("slots_per_level"),
    created_at: row.get("created_at"),
  }))
}

pub async fn get_rack_by_id(pool: &SqlitePool, id: &str) -> Result<Option<RackRow>, AppError> {
  let row = sqlx::query(
    "SELECT id, code, name, warehouse_id, location, status, level_count, slots_per_level, created_at \
     FROM rack WHERE id = ?",
  )
  .bind(id)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| RackRow {
    id: row.get("id"),
    code: row.get("code"),
    name: row.get("name"),
    warehouse_id: row.get("warehouse_id"),
    location: row.get("location"),
    status: row.get("status"),
    level_count: row.get("level_count"),
    slots_per_level: row.get("slots_per_level"),
    created_at: row.get("created_at"),
  }))
}

pub async fn insert_rack(
  pool: &SqlitePool,
  id: &str,
  code: &str,
  name: &str,
  warehouse_id: Option<String>,
  location: Option<String>,
  status: &str,
  level_count: i64,
  slots_per_level: i64,
  created_at: i64,
) -> Result<(), AppError> {
  sqlx::query(
    "INSERT INTO rack (id, code, name, warehouse_id, location, status, level_count, slots_per_level, created_at) \
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
  .bind(id)
  .bind(code)
  .bind(name)
  .bind(warehouse_id)
  .bind(location)
  .bind(status)
  .bind(level_count)
  .bind(slots_per_level)
  .bind(created_at)
  .execute(pool)
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
  let result = sqlx::query(
    "UPDATE rack SET name = ?, warehouse_id = ?, location = ?, level_count = ?, slots_per_level = ? WHERE id = ?",
  )
  .bind(name)
  .bind(warehouse_id)
  .bind(location)
  .bind(level_count)
  .bind(slots_per_level)
  .bind(id)
  .execute(pool)
  .await?;

  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "货架不存在"));
  }

  Ok(())
}

pub async fn set_rack_status(
  pool: &SqlitePool,
  id: &str,
  status: &str,
) -> Result<(), AppError> {
  let result = sqlx::query("UPDATE rack SET status = ? WHERE id = ?")
    .bind(status)
    .bind(id)
    .execute(pool)
    .await?;

  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "货架不存在"));
  }

  Ok(())
}

pub async fn delete_slots_by_rack(pool: &SqlitePool, rack_id: &str) -> Result<(), AppError> {
  sqlx::query("DELETE FROM slot WHERE rack_id = ?")
    .bind(rack_id)
    .execute(pool)
    .await?;
  Ok(())
}

pub async fn set_slot_status(
  pool: &SqlitePool,
  slot_id: &str,
  status: &str,
) -> Result<(), AppError> {
  let result = sqlx::query("UPDATE slot SET status = ? WHERE id = ?")
    .bind(status)
    .bind(slot_id)
    .execute(pool)
    .await?;

  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "库位不存在"));
  }

  Ok(())
}

pub async fn insert_slots(pool: &SqlitePool, slots: Vec<SlotRow>) -> Result<(), AppError> {
  let mut tx = pool.begin().await?;

  for slot in slots {
    sqlx::query(
      "INSERT INTO slot (id, rack_id, level_no, slot_no, code, status, created_at) \
       VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(slot.id)
    .bind(slot.rack_id)
    .bind(slot.level_no)
    .bind(slot.slot_no)
    .bind(slot.code)
    .bind(slot.status)
    .bind(slot.created_at)
    .execute(&mut *tx)
    .await?;
  }

  tx.commit().await?;
  Ok(())
}

pub async fn list_slots(
  pool: &SqlitePool,
  rack_id: &str,
  level_no: Option<i64>,
) -> Result<Vec<SlotRow>, AppError> {
  let rows = if let Some(level_no) = level_no {
    sqlx::query(
      "SELECT id, rack_id, level_no, slot_no, code, status, created_at \
       FROM slot WHERE rack_id = ? AND level_no = ? ORDER BY level_no, slot_no",
    )
    .bind(rack_id)
    .bind(level_no)
    .fetch_all(pool)
    .await?
  } else {
    sqlx::query(
      "SELECT id, rack_id, level_no, slot_no, code, status, created_at \
       FROM slot WHERE rack_id = ? ORDER BY level_no, slot_no",
    )
    .bind(rack_id)
    .fetch_all(pool)
    .await?
  };

  let items = rows
    .into_iter()
    .map(|row| SlotRow {
      id: row.get("id"),
      rack_id: row.get("rack_id"),
      level_no: row.get("level_no"),
      slot_no: row.get("slot_no"),
      code: row.get("code"),
      status: row.get("status"),
      created_at: row.get("created_at"),
    })
    .collect();

  Ok(items)
}

pub async fn get_slot_by_code(
  pool: &SqlitePool,
  code: &str,
) -> Result<Option<SlotRow>, AppError> {
  let row = sqlx::query(
    "SELECT id, rack_id, level_no, slot_no, code, status, created_at FROM slot WHERE code = ?",
  )
  .bind(code)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| SlotRow {
    id: row.get("id"),
    rack_id: row.get("rack_id"),
    level_no: row.get("level_no"),
    slot_no: row.get("slot_no"),
    code: row.get("code"),
    status: row.get("status"),
    created_at: row.get("created_at"),
  }))
}
