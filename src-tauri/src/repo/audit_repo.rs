use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};

use crate::domain::errors::AppError;

#[derive(Debug, serde::Serialize)]
pub struct AuditLogRow {
  // 审计日志落库字段
  pub id: String,
  pub created_at: i64,
  pub actor_operator_id: Option<String>,
  pub actor_operator_name: Option<String>,
  pub action: String,
  pub target_type: Option<String>,
  pub target_id: Option<String>,
  pub request_json: Option<String>,
  pub result: String,
  pub error_code: Option<String>,
  pub error_detail: Option<String>,
}

pub async fn insert_audit_log(pool: &SqlitePool, row: AuditLogRow) -> Result<(), AppError> {
  sqlx::query(
    "INSERT INTO audit_log \
     (id, created_at, actor_operator_id, action, target_type, target_id, request_json, result, error_code, error_detail) \
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
  .bind(row.id)
  .bind(row.created_at)
  .bind(row.actor_operator_id)
  .bind(row.action)
  .bind(row.target_type)
  .bind(row.target_id)
  .bind(row.request_json)
  .bind(row.result)
  .bind(row.error_code)
  .bind(row.error_detail)
  .execute(pool)
  .await?;

  Ok(())
}

pub async fn list_audit_logs(
  pool: &SqlitePool,
  action: Option<String>,
  keyword: Option<String>,
  start_at: Option<i64>,
  end_at: Option<i64>,
  page_index: i64,
  page_size: i64,
) -> Result<Vec<AuditLogRow>, AppError> {
  let offset = (page_index - 1) * page_size;
  let mut builder: QueryBuilder<Sqlite> = QueryBuilder::new(
    "SELECT id, created_at, actor_operator_id, action, target_type, target_id, request_json, result, error_code, error_detail \
     FROM audit_log",
  );
  let mut has_where = false;
  let mut push_where = |builder: &mut QueryBuilder<Sqlite>| {
    if has_where {
      builder.push(" AND ");
    } else {
      builder.push(" WHERE ");
      has_where = true;
    }
  };

  if let Some(action) = action {
    push_where(&mut builder);
    builder.push("action = ");
    builder.push_bind(action);
  }

  if let Some(keyword) = keyword {
    let like = format!("%{}%", keyword);
    push_where(&mut builder);
    builder.push("(");
    builder.push("actor_operator_id LIKE ");
    builder.push_bind(like.clone());
    builder.push(" OR target_id LIKE ");
    builder.push_bind(like.clone());
    builder.push(" OR action LIKE ");
    builder.push_bind(like.clone());
    builder.push(" OR target_type LIKE ");
    builder.push_bind(like);
    builder.push(")");
  }

  if let Some(start_at) = start_at {
    push_where(&mut builder);
    builder.push("created_at >= ");
    builder.push_bind(start_at);
  }

  if let Some(end_at) = end_at {
    push_where(&mut builder);
    builder.push("created_at <= ");
    builder.push_bind(end_at);
  }

  builder.push(" ORDER BY created_at DESC LIMIT ");
  builder.push_bind(page_size);
  builder.push(" OFFSET ");
  builder.push_bind(offset);

  let rows = builder.build().fetch_all(pool).await?;

  let items = rows
    .into_iter()
    .map(|row| AuditLogRow {
      id: row.get("id"),
      created_at: row.get("created_at"),
      actor_operator_id: row.get("actor_operator_id"),
      actor_operator_name: None,
      action: row.get("action"),
      target_type: row.get("target_type"),
      target_id: row.get("target_id"),
      request_json: row.get("request_json"),
      result: row.get("result"),
      error_code: row.get("error_code"),
      error_detail: row.get("error_detail"),
    })
    .collect();

  Ok(items)
}

pub async fn list_audit_logs_all(
  pool: &SqlitePool,
  action: Option<String>,
) -> Result<Vec<AuditLogRow>, AppError> {
  let rows = if let Some(action) = action {
    sqlx::query(
      "SELECT id, created_at, actor_operator_id, action, target_type, target_id, request_json, result, error_code, error_detail \
       FROM audit_log WHERE action = ? ORDER BY created_at DESC",
    )
    .bind(action)
    .fetch_all(pool)
    .await?
  } else {
    sqlx::query(
      "SELECT id, created_at, actor_operator_id, action, target_type, target_id, request_json, result, error_code, error_detail \
       FROM audit_log ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?
  };

  let items = rows
    .into_iter()
    .map(|row| AuditLogRow {
      id: row.get("id"),
      created_at: row.get("created_at"),
      actor_operator_id: row.get("actor_operator_id"),
      actor_operator_name: None,
      action: row.get("action"),
      target_type: row.get("target_type"),
      target_id: row.get("target_id"),
      request_json: row.get("request_json"),
      result: row.get("result"),
      error_code: row.get("error_code"),
      error_detail: row.get("error_detail"),
    })
    .collect();

  Ok(items)
}

pub async fn count_audit_logs(
  pool: &SqlitePool,
  action: Option<String>,
  keyword: Option<String>,
  start_at: Option<i64>,
  end_at: Option<i64>,
) -> Result<i64, AppError> {
  let mut builder: QueryBuilder<Sqlite> =
    QueryBuilder::new("SELECT COUNT(1) FROM audit_log");
  let mut has_where = false;
  let mut push_where = |builder: &mut QueryBuilder<Sqlite>| {
    if has_where {
      builder.push(" AND ");
    } else {
      builder.push(" WHERE ");
      has_where = true;
    }
  };

  if let Some(action) = action {
    push_where(&mut builder);
    builder.push("action = ");
    builder.push_bind(action);
  }

  if let Some(keyword) = keyword {
    let like = format!("%{}%", keyword);
    push_where(&mut builder);
    builder.push("(");
    builder.push("actor_operator_id LIKE ");
    builder.push_bind(like.clone());
    builder.push(" OR target_id LIKE ");
    builder.push_bind(like.clone());
    builder.push(" OR action LIKE ");
    builder.push_bind(like.clone());
    builder.push(" OR target_type LIKE ");
    builder.push_bind(like);
    builder.push(")");
  }

  if let Some(start_at) = start_at {
    push_where(&mut builder);
    builder.push("created_at >= ");
    builder.push_bind(start_at);
  }

  if let Some(end_at) = end_at {
    push_where(&mut builder);
    builder.push("created_at <= ");
    builder.push_bind(end_at);
  }

  let (count,): (i64,) = builder.build_query_as().fetch_one(pool).await?;
  Ok(count)
}
