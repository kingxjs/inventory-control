use sqlx::{Row, SqlitePool, Transaction};

use crate::domain::errors::{AppError, ErrorCode};

#[derive(Debug)]
pub struct StockRow {
  pub id: String,
  pub qty: i64,
}

pub async fn get_stock(
  pool: &SqlitePool,
  item_id: &str,
  slot_id: &str,
) -> Result<Option<StockRow>, AppError> {
  let row = sqlx::query("SELECT id, qty FROM stock WHERE item_id = ? AND slot_id = ?")
    .bind(item_id)
    .bind(slot_id)
    .fetch_optional(pool)
    .await?;

  Ok(row.map(|row| StockRow {
    id: row.get("id"),
    qty: row.get("qty"),
  }))
}

pub async fn get_stock_tx(
  tx: &mut Transaction<'_, sqlx::Sqlite>,
  item_id: &str,
  slot_id: &str,
) -> Result<Option<StockRow>, AppError> {
  let row = sqlx::query("SELECT id, qty FROM stock WHERE item_id = ? AND slot_id = ?")
    .bind(item_id)
    .bind(slot_id)
    .fetch_optional(&mut **tx)
    .await?;

  Ok(row.map(|row| StockRow {
    id: row.get("id"),
    qty: row.get("qty"),
  }))
}

pub async fn upsert_stock(
  pool: &SqlitePool,
  item_id: &str,
  slot_id: &str,
  qty: i64,
  updated_at: i64,
) -> Result<(), AppError> {
  if qty < 0 {
    return Err(AppError::new(ErrorCode::ValidationError, "库存不能为负数"));
  }

  let existing = get_stock(pool, item_id, slot_id).await?;
  if let Some(stock) = existing {
    sqlx::query("UPDATE stock SET qty = ?, updated_at = ? WHERE id = ?")
      .bind(qty)
      .bind(updated_at)
      .bind(stock.id)
      .execute(pool)
      .await?;
    return Ok(());
  }

  sqlx::query("INSERT INTO stock (id, item_id, slot_id, qty, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(item_id)
    .bind(slot_id)
    .bind(qty)
    .bind(updated_at)
    .execute(pool)
    .await?;

  Ok(())
}

pub async fn upsert_stock_tx(
  tx: &mut Transaction<'_, sqlx::Sqlite>,
  item_id: &str,
  slot_id: &str,
  qty: i64,
  updated_at: i64,
) -> Result<(), AppError> {
  if qty < 0 {
    return Err(AppError::new(ErrorCode::ValidationError, "库存不能为负数"));
  }

  let existing = get_stock_tx(tx, item_id, slot_id).await?;
  if let Some(stock) = existing {
    sqlx::query("UPDATE stock SET qty = ?, updated_at = ? WHERE id = ?")
      .bind(qty)
      .bind(updated_at)
      .bind(stock.id)
      .execute(&mut **tx)
      .await?;
    return Ok(());
  }

  sqlx::query("INSERT INTO stock (id, item_id, slot_id, qty, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(item_id)
    .bind(slot_id)
    .bind(qty)
    .bind(updated_at)
    .execute(&mut **tx)
    .await?;

  Ok(())
}

pub async fn count_stock_by_rack(pool: &SqlitePool, rack_id: &str) -> Result<i64, AppError> {
  let (count,): (i64,) = sqlx::query_as(
    "SELECT COUNT(1) FROM stock JOIN slot ON stock.slot_id = slot.id WHERE slot.rack_id = ? AND stock.qty > 0",
  )
  .bind(rack_id)
  .fetch_one(pool)
  .await?;
  Ok(count)
}

pub async fn count_stock_by_slot(pool: &SqlitePool, slot_id: &str) -> Result<i64, AppError> {
  let (count,): (i64,) = sqlx::query_as(
    "SELECT COUNT(1) FROM stock WHERE slot_id = ? AND qty > 0",
  )
  .bind(slot_id)
  .fetch_one(pool)
  .await?;
  Ok(count)
}
