use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};

use crate::domain::errors::{AppError, ErrorCode};

#[derive(Debug, serde::Serialize)]
pub struct WarehouseRow {
  pub id: String,
  pub code: String,
  pub name: String,
  pub status: String,
  pub created_at: i64,
}

pub async fn list_warehouses(
  pool: &SqlitePool,
  keyword: Option<String>,
  status: Option<String>,
  page_index: i64,
  page_size: i64,
) -> Result<Vec<WarehouseRow>, AppError> {
  let offset = (page_index - 1) * page_size;
  let mut builder: QueryBuilder<Sqlite> =
    QueryBuilder::new("SELECT id, code, name, status, created_at FROM warehouse");
  let mut has_where = false;
  if let Some(status) = status {
    builder.push(" WHERE status = ").push_bind(status);
    has_where = true;
  }
  if let Some(keyword) = keyword {
    let like = format!("%{}%", keyword);
    if has_where {
      builder.push(" AND ");
    } else {
      builder.push(" WHERE ");
    }
    builder
      .push("(code LIKE ")
      .push_bind(like.clone())
      .push(" OR name LIKE ")
      .push_bind(like)
      .push(")");
  }
  builder
    .push(" ORDER BY created_at DESC LIMIT ")
    .push_bind(page_size)
    .push(" OFFSET ")
    .push_bind(offset);

  let rows = builder.build().fetch_all(pool).await?;

  let items = rows
    .into_iter()
    .map(|row| WarehouseRow {
      id: row.get("id"),
      code: row.get("code"),
      name: row.get("name"),
      status: row.get("status"),
      created_at: row.get("created_at"),
    })
    .collect();

  Ok(items)
}

pub async fn count_warehouses(pool: &SqlitePool) -> Result<i64, AppError> {
  count_warehouses_with_filter(pool, None, None).await
}

pub async fn count_warehouses_with_filter(
  pool: &SqlitePool,
  keyword: Option<String>,
  status: Option<String>,
) -> Result<i64, AppError> {
  let mut builder: QueryBuilder<Sqlite> =
    QueryBuilder::new("SELECT COUNT(1) FROM warehouse");
  let mut has_where = false;
  if let Some(status) = status {
    builder.push(" WHERE status = ").push_bind(status);
    has_where = true;
  }
  if let Some(keyword) = keyword {
    let like = format!("%{}%", keyword);
    if has_where {
      builder.push(" AND ");
    } else {
      builder.push(" WHERE ");
    }
    builder
      .push("(code LIKE ")
      .push_bind(like.clone())
      .push(" OR name LIKE ")
      .push_bind(like)
      .push(")");
  }
  let (count,): (i64,) = builder.build_query_as().fetch_one(pool).await?;
  Ok(count)
}

pub async fn get_warehouse_by_id(
  pool: &SqlitePool,
  id: &str,
) -> Result<Option<WarehouseRow>, AppError> {
  let row = sqlx::query(
    "SELECT id, code, name, status, created_at \
     FROM warehouse WHERE id = ?",
  )
  .bind(id)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| WarehouseRow {
    id: row.get("id"),
    code: row.get("code"),
    name: row.get("name"),
    status: row.get("status"),
    created_at: row.get("created_at"),
  }))
}

pub async fn get_warehouse_by_code(
  pool: &SqlitePool,
  code: &str,
) -> Result<Option<WarehouseRow>, AppError> {
  let row = sqlx::query(
    "SELECT id, code, name, status, created_at \
     FROM warehouse WHERE code = ?",
  )
  .bind(code)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| WarehouseRow {
    id: row.get("id"),
    code: row.get("code"),
    name: row.get("name"),
    status: row.get("status"),
    created_at: row.get("created_at"),
  }))
}

pub async fn insert_warehouse(
  pool: &SqlitePool,
  id: &str,
  code: &str,
  name: &str,
  status: &str,
  created_at: i64,
) -> Result<(), AppError> {
  sqlx::query(
    "INSERT INTO warehouse (id, code, name, status, created_at) VALUES (?, ?, ?, ?, ?)",
  )
  .bind(id)
  .bind(code)
  .bind(name)
  .bind(status)
  .bind(created_at)
  .execute(pool)
  .await?;

  Ok(())
}

pub async fn update_warehouse(
  pool: &SqlitePool,
  id: &str,
  name: &str,
) -> Result<(), AppError> {
  let result = sqlx::query("UPDATE warehouse SET name = ? WHERE id = ?")
    .bind(name)
    .bind(id)
    .execute(pool)
    .await?;

  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "仓库不存在"));
  }

  Ok(())
}

pub async fn set_warehouse_status(
  pool: &SqlitePool,
  id: &str,
  status: &str,
) -> Result<(), AppError> {
  let result = sqlx::query("UPDATE warehouse SET status = ? WHERE id = ?")
    .bind(status)
    .bind(id)
    .execute(pool)
    .await?;

  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "仓库不存在"));
  }

  Ok(())
}
