use sqlx::{Row, SqlitePool};

use crate::domain::errors::AppError;

#[derive(Debug, serde::Serialize)]
pub struct StockBySlotRow {
  pub warehouse_code: Option<String>,
  pub warehouse_name: Option<String>,
  pub rack_code: String,
  pub rack_name: String,
  pub slot_code: String,
  pub item_code: String,
  pub item_name: String,
  pub operator_name: Option<String>,
  pub qty: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct StockByItemRow {
  pub warehouse_code: Option<String>,
  pub warehouse_name: Option<String>,
  pub rack_code: String,
  pub rack_name: String,
  pub item_code: String,
  pub item_name: String,
  pub slot_code: String,
  pub operator_name: Option<String>,
  pub qty: i64,
}

pub async fn list_stock_by_slot(
  pool: &SqlitePool,
  page_index: i64,
  page_size: i64,
) -> Result<Vec<StockBySlotRow>, AppError> {
  let offset = (page_index - 1) * page_size;
  let rows = sqlx::query(
    "SELECT warehouse.code AS warehouse_code, warehouse.name AS warehouse_name, rack.code AS rack_code, \
     rack.name AS rack_name, slot.code AS slot_code, \
     item.item_code AS item_code, item.name AS item_name, \
     (SELECT op.display_name FROM txn AS t \
        JOIN \"operator\" AS op ON t.operator_id = op.id \
        WHERE t.item_id = stock.item_id \
          AND (t.to_slot_id = stock.slot_id OR t.from_slot_id = stock.slot_id) \
        ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT 1) AS operator_name, \
     stock.qty AS qty \
     FROM stock \
     JOIN slot ON stock.slot_id = slot.id \
     JOIN rack ON slot.rack_id = rack.id \
     LEFT JOIN warehouse ON rack.warehouse_id = warehouse.id \
     JOIN item ON stock.item_id = item.id \
     ORDER BY rack.code, slot.code LIMIT ? OFFSET ?",
  )
  .bind(page_size)
  .bind(offset)
  .fetch_all(pool)
  .await?;

  let items = rows
    .into_iter()
    .map(|row| StockBySlotRow {
      warehouse_code: row.get("warehouse_code"),
      warehouse_name: row.get("warehouse_name"),
      rack_code: row.get("rack_code"),
      rack_name: row.get("rack_name"),
      slot_code: row.get("slot_code"),
      item_code: row.get("item_code"),
      item_name: row.get("item_name"),
      operator_name: row.get("operator_name"),
      qty: row.get("qty"),
    })
    .collect();

  Ok(items)
}

pub async fn list_stock_by_slot_all(
  pool: &SqlitePool,
) -> Result<Vec<StockBySlotRow>, AppError> {
  let rows = sqlx::query(
    "SELECT warehouse.code AS warehouse_code, warehouse.name AS warehouse_name, rack.code AS rack_code, \
     rack.name AS rack_name, slot.code AS slot_code, \
     item.item_code AS item_code, item.name AS item_name, \
     (SELECT op.display_name FROM txn AS t \
        JOIN \"operator\" AS op ON t.operator_id = op.id \
        WHERE t.item_id = stock.item_id \
          AND (t.to_slot_id = stock.slot_id OR t.from_slot_id = stock.slot_id) \
        ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT 1) AS operator_name, \
     stock.qty AS qty \
     FROM stock \
     JOIN slot ON stock.slot_id = slot.id \
     JOIN rack ON slot.rack_id = rack.id \
     LEFT JOIN warehouse ON rack.warehouse_id = warehouse.id \
     JOIN item ON stock.item_id = item.id \
     ORDER BY rack.code, slot.code",
  )
  .fetch_all(pool)
  .await?;

  let items = rows
    .into_iter()
    .map(|row| StockBySlotRow {
      warehouse_code: row.get("warehouse_code"),
      warehouse_name: row.get("warehouse_name"),
      rack_code: row.get("rack_code"),
      rack_name: row.get("rack_name"),
      slot_code: row.get("slot_code"),
      item_code: row.get("item_code"),
      item_name: row.get("item_name"),
      operator_name: row.get("operator_name"),
      qty: row.get("qty"),
    })
    .collect();

  Ok(items)
}

pub async fn list_stock_by_item(
  pool: &SqlitePool,
  page_index: i64,
  page_size: i64,
) -> Result<Vec<StockByItemRow>, AppError> {
  let offset = (page_index - 1) * page_size;
  let rows = sqlx::query(
    "SELECT warehouse.code AS warehouse_code, warehouse.name AS warehouse_name, rack.code AS rack_code, \
     rack.name AS rack_name, item.item_code AS item_code, \
     item.name AS item_name, slot.code AS slot_code, \
     (SELECT op.display_name FROM txn AS t \
        JOIN \"operator\" AS op ON t.operator_id = op.id \
        WHERE t.item_id = stock.item_id \
          AND (t.to_slot_id = stock.slot_id OR t.from_slot_id = stock.slot_id) \
        ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT 1) AS operator_name, \
     stock.qty AS qty \
     FROM stock \
     JOIN item ON stock.item_id = item.id \
     JOIN slot ON stock.slot_id = slot.id \
     JOIN rack ON slot.rack_id = rack.id \
     LEFT JOIN warehouse ON rack.warehouse_id = warehouse.id \
     ORDER BY item.item_code, slot.code LIMIT ? OFFSET ?",
  )
  .bind(page_size)
  .bind(offset)
  .fetch_all(pool)
  .await?;

  let items = rows
    .into_iter()
    .map(|row| StockByItemRow {
      warehouse_code: row.get("warehouse_code"),
      warehouse_name: row.get("warehouse_name"),
      rack_code: row.get("rack_code"),
      rack_name: row.get("rack_name"),
      item_code: row.get("item_code"),
      item_name: row.get("item_name"),
      slot_code: row.get("slot_code"),
      operator_name: row.get("operator_name"),
      qty: row.get("qty"),
    })
    .collect();

  Ok(items)
}

pub async fn count_stock_by_slot(pool: &SqlitePool) -> Result<i64, AppError> {
  let (count,): (i64,) = sqlx::query_as(
    "SELECT COUNT(1) \
     FROM stock \
     JOIN slot ON stock.slot_id = slot.id \
     JOIN rack ON slot.rack_id = rack.id \
     JOIN item ON stock.item_id = item.id",
  )
  .fetch_one(pool)
  .await?;
  Ok(count)
}

pub async fn count_stock_by_item(pool: &SqlitePool) -> Result<i64, AppError> {
  let (count,): (i64,) = sqlx::query_as(
    "SELECT COUNT(1) \
     FROM stock \
     JOIN item ON stock.item_id = item.id \
     JOIN slot ON stock.slot_id = slot.id",
  )
  .fetch_one(pool)
  .await?;
  Ok(count)
}
