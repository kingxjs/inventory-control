use sqlx::{Row, SqlitePool};

use crate::domain::errors::AppError;

#[derive(Debug)]
pub struct TxnTypeCountRow {
  pub txn_type: String,
  pub total: i64,
}

#[derive(Debug)]
pub struct TxnTrendRow {
  pub day: String,
  pub txn_type: String,
  pub total: i64,
}

#[derive(Debug)]
pub struct WarehouseStockRow {
  pub warehouse_code: Option<String>,
  pub warehouse_name: Option<String>,
  pub total_qty: i64,
}

pub async fn count_txns_by_type(
  pool: &SqlitePool,
  start_at: i64,
  end_at: i64,
) -> Result<Vec<TxnTypeCountRow>, AppError> {
  let rows = sqlx::query(
    "SELECT txn.\"type\" AS txn_type, COUNT(1) AS total \
     FROM txn \
     WHERE occurred_at >= ? AND occurred_at <= ? \
     GROUP BY txn.\"type\"",
  )
  .bind(start_at)
  .bind(end_at)
  .fetch_all(pool)
  .await?;

  Ok(
    rows
      .into_iter()
      .map(|row| TxnTypeCountRow {
        txn_type: row.get("txn_type"),
        total: row.get("total"),
      })
      .collect(),
  )
}

pub async fn list_txn_trend(
  pool: &SqlitePool,
  start_at: i64,
  end_at: i64,
) -> Result<Vec<TxnTrendRow>, AppError> {
  let rows = sqlx::query(
    "SELECT strftime('%Y-%m-%d', occurred_at, 'unixepoch', 'localtime') AS day, \
     txn.\"type\" AS txn_type, COUNT(1) AS total \
     FROM txn \
     WHERE occurred_at >= ? AND occurred_at <= ? \
     GROUP BY day, txn.\"type\" \
     ORDER BY day ASC",
  )
  .bind(start_at)
  .bind(end_at)
  .fetch_all(pool)
  .await?;

  Ok(
    rows
      .into_iter()
      .map(|row| TxnTrendRow {
        day: row.get("day"),
        txn_type: row.get("txn_type"),
        total: row.get("total"),
      })
      .collect(),
  )
}

pub async fn sum_stock_qty(pool: &SqlitePool) -> Result<i64, AppError> {
  let (total,): (Option<i64>,) =
    sqlx::query_as("SELECT SUM(qty) FROM stock")
      .fetch_one(pool)
      .await?;
  Ok(total.unwrap_or(0))
}

pub async fn count_active_items(pool: &SqlitePool) -> Result<i64, AppError> {
  let (count,): (i64,) = sqlx::query_as(
    "SELECT COUNT(1) FROM item WHERE status = 'active'",
  )
  .fetch_one(pool)
  .await?;
  Ok(count)
}

pub async fn count_active_racks(pool: &SqlitePool) -> Result<i64, AppError> {
  let (count,): (i64,) = sqlx::query_as(
    "SELECT COUNT(1) FROM rack WHERE status = 'active'",
  )
  .fetch_one(pool)
  .await?;
  Ok(count)
}

pub async fn count_active_warehouses(
  pool: &SqlitePool,
) -> Result<i64, AppError> {
  let (count,): (i64,) = sqlx::query_as(
    "SELECT COUNT(1) FROM warehouse WHERE status = 'active'",
  )
  .fetch_one(pool)
  .await?;
  Ok(count)
}

pub async fn count_negative_stock(pool: &SqlitePool) -> Result<i64, AppError> {
  let (count,): (i64,) =
    sqlx::query_as("SELECT COUNT(1) FROM stock WHERE qty < 0")
      .fetch_one(pool)
      .await?;
  Ok(count)
}

pub async fn list_stock_by_warehouse(
  pool: &SqlitePool,
) -> Result<Vec<WarehouseStockRow>, AppError> {
  let rows = sqlx::query(
    "SELECT warehouse.code AS warehouse_code, warehouse.name AS warehouse_name, \
     SUM(stock.qty) AS total_qty \
     FROM stock \
     JOIN slot ON stock.slot_id = slot.id \
     JOIN rack ON slot.rack_id = rack.id \
     LEFT JOIN warehouse ON rack.warehouse_id = warehouse.id \
     GROUP BY warehouse.code, warehouse.name \
     ORDER BY total_qty DESC",
  )
  .fetch_all(pool)
  .await?;

  Ok(
    rows
      .into_iter()
      .map(|row| WarehouseStockRow {
        warehouse_code: row.get("warehouse_code"),
        warehouse_name: row.get("warehouse_name"),
        total_qty: row
          .get::<Option<i64>, _>("total_qty")
          .unwrap_or(0),
      })
      .collect(),
  )
}
