use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::errors::{AppError, ErrorCode};
use crate::infra::crypto;
use crate::repo::operator_repo::{self, OperatorRow};
use crate::repo::meta_repo;

#[derive(Debug, serde::Serialize)]
pub struct OperatorListResult {
  pub items: Vec<OperatorRow>,
  pub total: i64,
}

pub async fn list_operators(
  pool: &SqlitePool,
  status: Option<String>,
  page_index: i64,
  page_size: i64,
) -> Result<OperatorListResult, AppError> {
  let (page_index, page_size) = normalize_page(page_index, page_size)?;
  let total = operator_repo::count_operators(pool, status.clone()).await?;
  let items = operator_repo::list_operators(pool, status, page_index, page_size).await?;
  Ok(OperatorListResult { items, total })
}

pub async fn create_operator(
  pool: &SqlitePool,
  username: &str,
  display_name: &str,
  role: Option<String>,
  password: &str,
  status: Option<String>,
) -> Result<(), AppError> {
  if username.trim().is_empty() || display_name.trim().is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "用户名或姓名不能为空"));
  }

  let role = if rbac_enabled(pool).await? {
    role.unwrap_or_else(|| "admin".to_string())
  } else {
    "admin".to_string()
  };
  if !matches!(role.as_str(), "admin" | "keeper" | "viewer" | "member") {
    return Err(AppError::new(ErrorCode::ValidationError, "角色非法"));
  }

  let status = status.unwrap_or_else(|| "active".to_string());
  if !matches!(status.as_str(), "active" | "inactive") {
    return Err(AppError::new(ErrorCode::ValidationError, "状态非法"));
  }

  let count = operator_repo::count_by_username(pool, username).await?;
  if count > 0 {
    return Err(AppError::new(ErrorCode::Conflict, "用户名已存在"));
  }

  let now = Utc::now().timestamp();
  let id = Uuid::new_v4().to_string();
  let password_trimmed = password.trim();
  if role != "member" && password_trimmed.is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "初始密码不能为空"));
  }
  let (password_hash, must_change_pwd) = if password_trimmed.is_empty() {
    (crypto::hash_password(&Uuid::new_v4().to_string())?, false)
  } else {
    (crypto::hash_password(password_trimmed)?, true)
  };

  operator_repo::insert_operator(
    pool,
    &id,
    username,
    display_name,
    &role,
    &status,
    &password_hash,
    must_change_pwd,
    now,
  )
  .await?;

  Ok(())
}

pub async fn update_operator(
  pool: &SqlitePool,
  id: &str,
  display_name: &str,
  role: Option<String>,
) -> Result<(), AppError> {
  if display_name.trim().is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "姓名不能为空"));
  }

  let role = if rbac_enabled(pool).await? { role } else { None };
  operator_repo::update_operator(pool, id, display_name, role).await?;
  Ok(())
}

pub async fn set_operator_status(
  pool: &SqlitePool,
  id: &str,
  status: &str,
) -> Result<(), AppError> {
  operator_repo::set_operator_status(pool, id, status).await?;
  Ok(())
}

pub async fn reset_operator_password(
  pool: &SqlitePool,
  id: &str,
  new_password: &str,
) -> Result<(), AppError> {
  if new_password.trim().is_empty() {
    return Err(AppError::new(ErrorCode::ValidationError, "新密码不能为空"));
  }

  let now = Utc::now().timestamp();
  let password_hash = crypto::hash_password(new_password)?;
  operator_repo::reset_operator_password(pool, id, &password_hash, now).await?;
  Ok(())
}

async fn rbac_enabled(pool: &SqlitePool) -> Result<bool, AppError> {
  let rbac = meta_repo::get_meta_value(pool, "rbac_enabled")
    .await?
    .unwrap_or_else(|| "0".to_string());
  Ok(rbac == "1")
}

fn normalize_page(page_index: i64, page_size: i64) -> Result<(i64, i64), AppError> {
  if page_index < 1 || page_size < 1 {
    return Err(AppError::new(ErrorCode::ValidationError, "分页参数非法"));
  }
  Ok((page_index, page_size))
}
