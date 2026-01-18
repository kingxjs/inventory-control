use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};
use std::collections::HashMap;

use crate::domain::errors::{AppError, ErrorCode};

#[derive(Debug, serde::Serialize)]
pub struct OperatorRow {
  pub id: String,
  pub username: String,
  pub display_name: String,
  pub role: String,
  pub status: String,
  pub must_change_pwd: bool,
  pub created_at: i64,
}

pub async fn list_operators(
  pool: &SqlitePool,
  status: Option<String>,
  page_index: i64,
  page_size: i64,
) -> Result<Vec<OperatorRow>, AppError> {
  let offset = (page_index - 1) * page_size;
  // 支持按状态过滤
  let rows = if let Some(status) = status {
    sqlx::query(
      "SELECT id, username, display_name, role, status, must_change_pwd, created_at \
       FROM operator WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(status)
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await?
  } else {
    sqlx::query(
      "SELECT id, username, display_name, role, status, must_change_pwd, created_at \
       FROM operator ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await?
  };

  let items = rows
    .into_iter()
    .map(|row| OperatorRow {
      id: row.get("id"),
      username: row.get("username"),
      display_name: row.get("display_name"),
      role: row.get("role"),
      status: row.get("status"),
      must_change_pwd: row.get::<i64, _>("must_change_pwd") == 1,
      created_at: row.get("created_at"),
    })
    .collect();

  Ok(items)
}

pub async fn count_operators(
  pool: &SqlitePool,
  status: Option<String>,
) -> Result<i64, AppError> {
  if let Some(status) = status {
    let (count,): (i64,) =
      sqlx::query_as("SELECT COUNT(1) FROM operator WHERE status = ?")
        .bind(status)
        .fetch_one(pool)
        .await?;
    Ok(count)
  } else {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(1) FROM operator")
      .fetch_one(pool)
      .await?;
    Ok(count)
  }
}

pub async fn count_by_username(pool: &SqlitePool, username: &str) -> Result<i64, AppError> {
  let (count,): (i64,) =
    sqlx::query_as("SELECT COUNT(1) FROM operator WHERE username = ?")
      .bind(username)
      .fetch_one(pool)
      .await?;
  Ok(count)
}

pub async fn get_operator_by_username(
  pool: &SqlitePool,
  username: &str,
) -> Result<Option<OperatorRow>, AppError> {
  let row = sqlx::query(
    "SELECT id, username, display_name, role, status, must_change_pwd, created_at \
     FROM operator WHERE username = ?",
  )
  .bind(username)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| OperatorRow {
    id: row.get("id"),
    username: row.get("username"),
    display_name: row.get("display_name"),
    role: row.get("role"),
    status: row.get("status"),
    must_change_pwd: row.get::<i64, _>("must_change_pwd") == 1,
    created_at: row.get("created_at"),
  }))
}

pub async fn get_operator_by_id(
  pool: &SqlitePool,
  id: &str,
) -> Result<Option<OperatorRow>, AppError> {
  let row = sqlx::query(
    "SELECT id, username, display_name, role, status, must_change_pwd, created_at \n     FROM operator WHERE id = ?",
  )
  .bind(id)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|row| OperatorRow {
    id: row.get("id"),
    username: row.get("username"),
    display_name: row.get("display_name"),
    role: row.get("role"),
    status: row.get("status"),
    must_change_pwd: row.get::<i64, _>("must_change_pwd") == 1,
    created_at: row.get("created_at"),
  }))
}

pub async fn list_operator_names_by_ids(
  pool: &SqlitePool,
  ids: &[String],
) -> Result<HashMap<String, String>, AppError> {
  if ids.is_empty() {
    return Ok(HashMap::new());
  }
  let mut builder: QueryBuilder<Sqlite> =
    QueryBuilder::new("SELECT id, display_name FROM operator WHERE id IN (");
  let mut separated = builder.separated(", ");
  for id in ids {
    separated.push_bind(id);
  }
  separated.push_unseparated(")");
  let rows = builder.build().fetch_all(pool).await?;
  let mut map = HashMap::new();
  for row in rows {
    let id: String = row.get("id");
    let name: String = row.get("display_name");
    map.insert(id, name);
  }
  Ok(map)
}

pub async fn insert_operator(
  pool: &SqlitePool,
  id: &str,
  username: &str,
  display_name: &str,
  role: &str,
  status: &str,
  password_hash: &str,
  must_change_pwd: bool,
  created_at: i64,
) -> Result<(), AppError> {
  sqlx::query(
    "INSERT INTO operator (id, username, display_name, role, status, password_hash, must_change_pwd, created_at) \
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
  .bind(id)
  .bind(username)
  .bind(display_name)
  .bind(role)
  .bind(status)
  .bind(password_hash)
  .bind(if must_change_pwd { 1 } else { 0 })
  .bind(created_at)
  .execute(pool)
  .await?;

  Ok(())
}

pub async fn update_operator(
  pool: &SqlitePool,
  id: &str,
  display_name: &str,
  role: Option<String>,
) -> Result<(), AppError> {
  let Some(role) = role else {
    let result = sqlx::query("UPDATE operator SET display_name = ? WHERE id = ?")
      .bind(display_name)
      .bind(id)
      .execute(pool)
      .await?;
    if result.rows_affected() == 0 {
      return Err(AppError::new(ErrorCode::NotFound, "人员不存在"));
    }
    return Ok(());
  };

  if !matches!(role.as_str(), "admin" | "keeper" | "viewer" | "member") {
    return Err(AppError::new(ErrorCode::ValidationError, "角色非法"));
  }

  let result = sqlx::query("UPDATE operator SET display_name = ?, role = ? WHERE id = ?")
    .bind(display_name)
    .bind(role)
    .bind(id)
    .execute(pool)
    .await?;
  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "人员不存在"));
  }

  Ok(())
}

pub async fn set_operator_status(
  pool: &SqlitePool,
  id: &str,
  status: &str,
) -> Result<(), AppError> {
  if !matches!(status, "active" | "inactive") {
    return Err(AppError::new(ErrorCode::ValidationError, "状态非法"));
  }

  let result = sqlx::query("UPDATE operator SET status = ? WHERE id = ?")
    .bind(status)
    .bind(id)
    .execute(pool)
    .await?;

  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "人员不存在"));
  }

  Ok(())
}

pub async fn reset_operator_password(
  pool: &SqlitePool,
  id: &str,
  password_hash: &str,
  now: i64,
) -> Result<(), AppError> {
  let result = sqlx::query(
    "UPDATE operator SET password_hash = ?, must_change_pwd = 1, pwd_changed_at = ? WHERE id = ?",
  )
  .bind(password_hash)
  .bind(now)
  .bind(id)
  .execute(pool)
  .await?;

  if result.rows_affected() == 0 {
    return Err(AppError::new(ErrorCode::NotFound, "人员不存在"));
  }

  Ok(())
}
