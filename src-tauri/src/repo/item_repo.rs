use sqlx::{Row, SqlitePool};

use crate::domain::errors::{AppError, ErrorCode};

#[derive(Debug, serde::Serialize)]
pub struct ItemRow {
  pub id: String,
  pub item_code: String,
  pub name: String,
  pub model: Option<String>,
  pub spec: Option<String>,
  pub uom: Option<String>,
  pub stock_qty: i64,
  pub status: String,
  pub remark: Option<String>,
  pub created_at: i64,
}

pub async fn list_items(
  pool: &SqlitePool,
  keyword: Option<String>,
  page_index: i64,
  page_size: i64,
) -> Result<Vec<ItemRow>, AppError> {
  let offset = (page_index - 1) * page_size;
  let rows = if let Some(keyword) = keyword {
    let like = format!("%{}%", keyword);
    sqlx::query(
      "SELECT item.id, item.item_code, item.name, item.model, item.spec, item.uom, \
       COALESCE(SUM(stock.qty), 0) AS stock_qty, item.status, item.remark, item.created_at \
       FROM item \
       LEFT JOIN stock ON stock.item_id = item.id \
       WHERE item.item_code LIKE ? OR item.name LIKE ? OR item.model LIKE ? \
       GROUP BY item.id \
       ORDER BY item.created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(&like)
    .bind(&like)
    .bind(&like)
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await?
  } else {
    sqlx::query(
      "SELECT item.id, item.item_code, item.name, item.model, item.spec, item.uom, \
       COALESCE(SUM(stock.qty), 0) AS stock_qty, item.status, item.remark, item.created_at \
       FROM item \
       LEFT JOIN stock ON stock.item_id = item.id \
       GROUP BY item.id \
       ORDER BY item.created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await?
  };

  let items = rows
    .into_iter()
    .map(|row| ItemRow {
      id: row.get("id"),
      item_code: row.get("item_code"),
      name: row.get("name"),
      model: row.get("model"),
      spec: row.get("spec"),
      uom: row.get("uom"),
      stock_qty: row.get("stock_qty"),
      status: row.get("status"),
      remark: row.get("remark"),
      created_at: row.get("created_at"),
    })
    .collect();

  Ok(items)
}

pub async fn list_items_all(pool: &SqlitePool) -> Result<Vec<ItemRow>, AppError> {
  let rows = sqlx::query(
    "SELECT item.id, item.item_code, item.name, item.model, item.spec, item.uom, \
     COALESCE(SUM(stock.qty), 0) AS stock_qty, item.status, item.remark, item.created_at \
     FROM item \
     LEFT JOIN stock ON stock.item_id = item.id \
     GROUP BY item.id \
     ORDER BY item.created_at DESC",
  )
  .fetch_all(pool)
  .await?;

  let items = rows
    .into_iter()
    .map(|row| ItemRow {
      id: row.get("id"),
      item_code: row.get("item_code"),
      name: row.get("name"),
      model: row.get("model"),
      spec: row.get("spec"),
      uom: row.get("uom"),
      stock_qty: row.get("stock_qty"),
      status: row.get("status"),
      remark: row.get("remark"),
      created_at: row.get("created_at"),
    })
    .collect();

  Ok(items)
}

pub async fn count_items(
  pool: &SqlitePool,
  keyword: Option<String>,
) -> Result<i64, AppError> {
  if let Some(keyword) = keyword {
    let like = format!("%{}%", keyword);
    let (count,): (i64,) = sqlx::query_as(
      "SELECT COUNT(1) FROM item WHERE item_code LIKE ? OR name LIKE ? OR model LIKE ?",
    )
    .bind(&like)
    .bind(&like)
    .bind(&like)
    .fetch_one(pool)
    .await?;
    Ok(count)
  } else {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(1) FROM item")
      .fetch_one(pool)
      .await?;
    Ok(count)
  }
}

pub async fn get_item_by_id(pool: &SqlitePool, id: &str) -> Result<Option<ItemRow>, AppError> {
  let row = sqlx::query(
    "SELECT item.id, item.item_code, item.name, item.model, item.spec, item.uom, \
     COALESCE(SUM(stock.qty), 0) AS stock_qty, item.status, item.remark, item.created_at \
     FROM item \
     LEFT JOIN stock ON stock.item_id = item.id \
     WHERE item.id = ? \
     GROUP BY item.id",
  )
  .bind(id)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| ItemRow {
    id: row.get("id"),
    item_code: row.get("item_code"),
    name: row.get("name"),
    model: row.get("model"),
    spec: row.get("spec"),
    uom: row.get("uom"),
    stock_qty: row.get("stock_qty"),
    status: row.get("status"),
    remark: row.get("remark"),
    created_at: row.get("created_at"),
  }))
}

pub async fn count_by_item_code(pool: &SqlitePool, item_code: &str) -> Result<i64, AppError> {
  let (count,): (i64,) = sqlx::query_as("SELECT COUNT(1) FROM item WHERE item_code = ?")
    .bind(item_code)
    .fetch_one(pool)
    .await?;
  Ok(count)
}

pub async fn get_item_by_code(
  pool: &SqlitePool,
  item_code: &str,
) -> Result<Option<ItemRow>, AppError> {
  let row = sqlx::query(
    "SELECT item.id, item.item_code, item.name, item.model, item.spec, item.uom, \
     COALESCE(SUM(stock.qty), 0) AS stock_qty, item.status, item.remark, item.created_at \
     FROM item \
     LEFT JOIN stock ON stock.item_id = item.id \
     WHERE item.item_code = ? \
     GROUP BY item.id",
  )
  .bind(item_code)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| ItemRow {
    id: row.get("id"),
    item_code: row.get("item_code"),
    name: row.get("name"),
    model: row.get("model"),
    spec: row.get("spec"),
    uom: row.get("uom"),
    stock_qty: row.get("stock_qty"),
    status: row.get("status"),
    remark: row.get("remark"),
    created_at: row.get("created_at"),
  }))
}

pub async fn insert_item(
  pool: &SqlitePool,
  id: &str,
  item_code: &str,
  name: &str,
  model: Option<String>,
  spec: Option<String>,
  uom: Option<String>,
  status: &str,
  remark: Option<String>,
  created_at: i64,
) -> Result<(), AppError> {
  sqlx::query(
    "INSERT INTO item (id, item_code, name, model, spec, uom, status, remark, created_at) \
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
  .bind(id)
  .bind(item_code)
  .bind(name)
  .bind(model)
  .bind(spec)
  .bind(uom)
  .bind(status)
  .bind(remark)
  .bind(created_at)
  .execute(pool)
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
  let result = sqlx::query(
    "UPDATE item SET name = ?, model = ?, spec = ?, uom = ?, remark = ? WHERE id = ?",
  )
  .bind(name)
  .bind(model)
  .bind(spec)
  .bind(uom)
  .bind(remark)
  .bind(id)
  .execute(pool)
  .await?;

  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "物品不存在"));
  }

  Ok(())
}

pub async fn set_item_status(pool: &SqlitePool, id: &str, status: &str) -> Result<(), AppError> {
  let result = sqlx::query("UPDATE item SET status = ? WHERE id = ?")
    .bind(status)
    .bind(id)
    .execute(pool)
    .await?;

  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "物品不存在"));
  }

  Ok(())
}
