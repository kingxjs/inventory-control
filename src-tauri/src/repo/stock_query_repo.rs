use sqlx::{Row, SqlitePool, QueryBuilder};

use crate::domain::errors::AppError;

#[derive(Debug, serde::Serialize)]
pub struct StockBySlotRow {
  pub warehouse_id: Option<String>,
  pub warehouse_code: Option<String>,
  pub warehouse_name: Option<String>,
  pub rack_id: String,
  pub rack_code: String,
  pub rack_name: String,
  pub slot_id: String,
  pub slot_code: String,
  pub item_id: String,
  pub item_code: String,
  pub item_name: String,
  pub operator_name: Option<String>,
  pub qty: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct StockByItemRow {
  pub warehouse_id: Option<String>,
  pub warehouse_code: Option<String>,
  pub warehouse_name: Option<String>,
  pub rack_id: String,
  pub rack_code: String,
  pub rack_name: String,
  pub slot_id: String,
  pub slot_code: String,
  pub item_id: String,
  pub item_code: String,
  pub item_name: String,
  pub operator_name: Option<String>,
  pub qty: i64,
}

#[allow(unused_assignments)]
pub async fn list_stock_by_slot(
  pool: &SqlitePool,
  page_index: i64,
  page_size: i64,
  warehouse_id: Option<String>,
  rack_id: Option<String>,
  slot_id: Option<String>,
  item_id: Option<String>,
  operator_id: Option<String>,
) -> Result<Vec<StockBySlotRow>, AppError> {
  let offset = (page_index - 1) * page_size;
  let mut builder = QueryBuilder::new(
    "SELECT warehouse.id AS warehouse_id, warehouse.code AS warehouse_code, warehouse.name AS warehouse_name, rack.id AS rack_id, rack.code AS rack_code, \
     rack.name AS rack_name, slot.id AS slot_id, slot.code AS slot_code, \
     item.id AS item_id, item.item_code AS item_code, item.name AS item_name, \
     (SELECT op.display_name FROM txn AS t \
        JOIN \"operator\" AS op ON t.operator_id = op.id \
        WHERE t.item_id = stock.item_id \
          AND (t.to_slot_id = stock.slot_id OR t.from_slot_id = stock.slot_id) \
        ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT 1) AS operator_name, \
     stock.qty AS qty FROM stock \
     JOIN slot ON stock.slot_id = slot.id \
     JOIN rack ON slot.rack_id = rack.id \
     LEFT JOIN warehouse ON rack.warehouse_id = warehouse.id \
     JOIN item ON stock.item_id = item.id",
  );
  let mut has_where = false;
  if let Some(wid) = warehouse_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    builder.push(" WHERE warehouse.id = ");
    builder.push_bind(wid.to_string());
    has_where = true;
  }
  if let Some(rid) = rack_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND rack.id = "); } else { builder.push(" WHERE rack.id = "); has_where = true; }
    builder.push_bind(rid.to_string());
  }
  if let Some(sid) = slot_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND slot.id = "); } else { builder.push(" WHERE slot.id = "); has_where = true; }
    builder.push_bind(sid.to_string());
  }
  if let Some(iid) = item_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND item.id = "); } else { builder.push(" WHERE item.id = "); has_where = true; }
    builder.push_bind(iid.to_string());
  }
  if let Some(opid) = operator_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where {
      builder.push(" AND EXISTS (SELECT 1 FROM txn t2 WHERE (t2.to_slot_id = stock.slot_id OR t2.from_slot_id = stock.slot_id) AND t2.operator_id = ");
    } else {
      builder.push(" WHERE EXISTS (SELECT 1 FROM txn t2 WHERE (t2.to_slot_id = stock.slot_id OR t2.from_slot_id = stock.slot_id) AND t2.operator_id = ");
      has_where = true;
    }
    builder.push_bind(opid.to_string());
    builder.push(")");
  }
  builder.push(" ORDER BY rack.code, slot.code LIMIT ");
  builder.push_bind(page_size);
  builder.push(" OFFSET ");
  builder.push_bind(offset);
  let rows = builder.build().fetch_all(pool).await?;

  let items = rows
    .into_iter()
    .map(|row| StockBySlotRow {
      warehouse_id: row.get("warehouse_id"),
      warehouse_code: row.get("warehouse_code"),
      warehouse_name: row.get("warehouse_name"),
      rack_id: row.get("rack_id"),
      rack_code: row.get("rack_code"),
      rack_name: row.get("rack_name"),
      slot_id: row.get("slot_id"),
      slot_code: row.get("slot_code"),
      item_id: row.get("item_id"),
      item_code: row.get("item_code"),
      item_name: row.get("item_name"),
      operator_name: row.get("operator_name"),
      qty: row.get("qty"),
    })
    .collect();

  Ok(items)
}

#[allow(unused_assignments)]
pub async fn list_stock_by_item_filtered(
  pool: &SqlitePool,
  page_index: i64,
  page_size: i64,
  warehouse_id: Option<String>,
  rack_id: Option<String>,
  slot_id: Option<String>,
  item_id: Option<String>,
  operator_id: Option<String>,
) -> Result<Vec<StockByItemRow>, AppError> {
  let offset = (page_index - 1) * page_size;
  let mut builder = QueryBuilder::new(
    "SELECT warehouse.id AS warehouse_id, warehouse.code AS warehouse_code, warehouse.name AS warehouse_name, rack.id AS rack_id, rack.code AS rack_code, \
     rack.name AS rack_name, item.id AS item_id, item.item_code AS item_code, \
     item.name AS item_name, slot.id AS slot_id, slot.code AS slot_code, \
     (SELECT op.display_name FROM txn AS t \
        JOIN \"operator\" AS op ON t.operator_id = op.id \
        WHERE t.item_id = stock.item_id \
          AND (t.to_slot_id = stock.slot_id OR t.from_slot_id = stock.slot_id) \
        ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT 1) AS operator_name, \
     stock.qty AS qty FROM stock \
     JOIN item ON stock.item_id = item.id \
     JOIN slot ON stock.slot_id = slot.id \
     JOIN rack ON slot.rack_id = rack.id \
     LEFT JOIN warehouse ON rack.warehouse_id = warehouse.id",
  );
  let mut has_where = false;
  if let Some(wid) = warehouse_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    builder.push(" WHERE warehouse.id = ");
    builder.push_bind(wid.to_string());
    has_where = true;
  }
  if let Some(rid) = rack_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND rack.id = "); } else { builder.push(" WHERE rack.id = "); has_where = true; }
    builder.push_bind(rid.to_string());
  }
  if let Some(sid) = slot_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND slot.id = "); } else { builder.push(" WHERE slot.id = "); has_where = true; }
    builder.push_bind(sid.to_string());
  }
  if let Some(iid) = item_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND item.id = "); } else { builder.push(" WHERE item.id = "); has_where = true; }
    builder.push_bind(iid.to_string());
  }
  if let Some(opid) = operator_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where {
      builder.push(" AND EXISTS (SELECT 1 FROM txn t2 WHERE (t2.to_slot_id = stock.slot_id OR t2.from_slot_id = stock.slot_id) AND t2.operator_id = ");
    } else {
      builder.push(" WHERE EXISTS (SELECT 1 FROM txn t2 WHERE (t2.to_slot_id = stock.slot_id OR t2.from_slot_id = stock.slot_id) AND t2.operator_id = ");
      has_where = true;
    }
    builder.push_bind(opid.to_string());
    builder.push(")");
  }
  builder.push(" ORDER BY item.item_code, slot.code LIMIT ");
  builder.push_bind(page_size);
  builder.push(" OFFSET ");
  builder.push_bind(offset);
  let rows = builder.build().fetch_all(pool).await?;

  let items = rows
    .into_iter()
    .map(|row| StockByItemRow {
      warehouse_id: row.get("warehouse_id"),
      warehouse_code: row.get("warehouse_code"),
      warehouse_name: row.get("warehouse_name"),
      rack_id: row.get("rack_id"),
      rack_code: row.get("rack_code"),
      rack_name: row.get("rack_name"),
      slot_id: row.get("slot_id"),
      slot_code: row.get("slot_code"),
      item_id: row.get("item_id"),
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
    "SELECT  warehouse.id AS warehouse_id, warehouse.code AS warehouse_code, warehouse.name AS warehouse_name, rack.id AS rack_id, rack.code AS rack_code, \
     rack.name AS rack_name, slot.id AS slot_id, slot.code AS slot_code, \
     item.id AS item_id, item.item_code AS item_code,  item.name AS item_name, \
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
      warehouse_id: row.get("warehouse_id"),
      warehouse_code: row.get("warehouse_code"),
      warehouse_name: row.get("warehouse_name"),
      rack_id: row.get("rack_id"),
      rack_code: row.get("rack_code"),
      rack_name: row.get("rack_name"),
      slot_id: row.get("slot_id"),
      slot_code: row.get("slot_code"),
      item_id: row.get("item_id"),
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
    "SELECT  warehouse.id AS warehouse_id, warehouse.code AS warehouse_code, warehouse.name AS warehouse_name, rack.id AS rack_id, rack.code AS rack_code, \
     rack.name AS rack_name, item.id AS item_id, item.item_code AS item_code, \
     item.name AS item_name, slot.id AS slot_id, slot.code AS slot_code, \
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
      warehouse_id: row.get("warehouse_id"),
      warehouse_code: row.get("warehouse_code"),
      warehouse_name: row.get("warehouse_name"),
      rack_id: row.get("rack_id"),
      rack_code: row.get("rack_code"),
      rack_name: row.get("rack_name"),
      slot_id: row.get("slot_id"),
      slot_code: row.get("slot_code"),
      item_id: row.get("item_id"),
      item_code: row.get("item_code"),
      item_name: row.get("item_name"),
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

// Filtered count for stock by slot with optional ids
#[allow(unused_assignments)]
pub async fn count_stock_by_slot_filtered(
  pool: &SqlitePool,
  warehouse_id: Option<String>,
  rack_id: Option<String>,
  slot_id: Option<String>,
  item_id: Option<String>,
  operator_id: Option<String>,
) -> Result<i64, AppError> {
  let mut builder = QueryBuilder::new("SELECT COUNT(1) FROM stock JOIN slot ON stock.slot_id = slot.id JOIN rack ON slot.rack_id = rack.id JOIN item ON stock.item_id = item.id LEFT JOIN warehouse ON rack.warehouse_id = warehouse.id");
  let mut has_where = false;
  if let Some(wid) = warehouse_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    builder.push(" WHERE warehouse.id = ");
    builder.push_bind(wid.to_string());
    has_where = true;
  }
  if let Some(rid) = rack_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND rack.id = "); } else { builder.push(" WHERE rack.id = "); has_where = true; }
    builder.push_bind(rid.to_string());
  }
  if let Some(sid) = slot_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND slot.id = "); } else { builder.push(" WHERE slot.id = "); has_where = true; }
    builder.push_bind(sid.to_string());
  }
  if let Some(iid) = item_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND item.id = "); } else { builder.push(" WHERE item.id = "); has_where = true; }
    builder.push_bind(iid.to_string());
  }
  if let Some(opid) = operator_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND EXISTS (SELECT 1 FROM txn t2 WHERE (t2.to_slot_id = stock.slot_id OR t2.from_slot_id = stock.slot_id) AND t2.operator_id = "); } else { builder.push(" WHERE EXISTS (SELECT 1 FROM txn t2 WHERE (t2.to_slot_id = stock.slot_id OR t2.from_slot_id = stock.slot_id) AND t2.operator_id = "); has_where = true; }
    builder.push_bind(opid.to_string());
    builder.push(")");
  }
  let (count,): (i64,) = builder.build_query_as().fetch_one(pool).await?;
  Ok(count)
}

// Filtered count for stock by item with optional ids
#[allow(unused_assignments)]
pub async fn count_stock_by_item_filtered(
  pool: &SqlitePool,
  warehouse_id: Option<String>,
  rack_id: Option<String>,
  slot_id: Option<String>,
  item_id: Option<String>,
  operator_id: Option<String>,
) -> Result<i64, AppError> {
  let mut builder = QueryBuilder::new("SELECT COUNT(1) FROM stock JOIN item ON stock.item_id = item.id JOIN slot ON stock.slot_id = slot.id JOIN rack ON slot.rack_id = rack.id LEFT JOIN warehouse ON rack.warehouse_id = warehouse.id");
  let mut has_where = false;
  if let Some(wid) = warehouse_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    builder.push(" WHERE warehouse.id = ");
    builder.push_bind(wid.to_string());
    has_where = true;
  }
  if let Some(rid) = rack_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND rack.id = "); } else { builder.push(" WHERE rack.id = "); has_where = true; }
    builder.push_bind(rid.to_string());
  }
  if let Some(sid) = slot_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND slot.id = "); } else { builder.push(" WHERE slot.id = "); has_where = true; }
    builder.push_bind(sid.to_string());
  }
  if let Some(iid) = item_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND item.id = "); } else { builder.push(" WHERE item.id = "); has_where = true; }
    builder.push_bind(iid.to_string());
  }
  if let Some(opid) = operator_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    if has_where { builder.push(" AND EXISTS (SELECT 1 FROM txn t2 WHERE (t2.to_slot_id = stock.slot_id OR t2.from_slot_id = stock.slot_id) AND t2.operator_id = "); } else { builder.push(" WHERE EXISTS (SELECT 1 FROM txn t2 WHERE (t2.to_slot_id = stock.slot_id OR t2.from_slot_id = stock.slot_id) AND t2.operator_id = "); has_where = true; }
    builder.push_bind(opid.to_string());
    builder.push(")");
  }
  let (count,): (i64,) = builder.build_query_as().fetch_one(pool).await?;
  Ok(count)
}
