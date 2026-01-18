use chrono::Utc;
use sqlx::{Row, SqlitePool};

use crate::domain::errors::{AppError, ErrorCode};
use crate::infra::crypto;

/// 登录返回结构
#[derive(Debug, serde::Serialize)]
pub struct LoginResult {
  // 操作人 id
  pub actor_operator_id: String,
  // 操作人用户名
  pub username: String,
  // 角色
  pub role: String,
  // 是否必须改密
  pub must_change_pwd: bool,
}

pub async fn login(
  pool: &SqlitePool,
  username: &str,
  password: &str,
) -> Result<LoginResult, AppError> {
  // 按用户名查找并校验密码
  let row = sqlx::query(
    "SELECT id, username, role, password_hash, must_change_pwd, status \
     FROM operator WHERE username = ?",
  )
  .bind(username)
  .fetch_optional(pool)
  .await?;

  let Some(row) = row else {
    return Err(AppError::new(ErrorCode::AuthFailed, "账号或密码错误"));
  };

  let status: String = row.get("status");
  if status != "active" {
    return Err(AppError::new(ErrorCode::InactiveResource, "账号已停用"));
  }

  let password_hash: String = row.get("password_hash");
  let ok = crypto::verify_password(&password_hash, password)?;
  if !ok {
    return Err(AppError::new(ErrorCode::AuthFailed, "账号或密码错误"));
  }

  let must_change_pwd: i64 = row.get("must_change_pwd");
  let id: String = row.get("id");
  let username: String = row.get("username");
  let role: String = row.get("role");

  Ok(LoginResult {
    actor_operator_id: id,
    username,
    role,
    must_change_pwd: must_change_pwd == 1,
  })
}

pub async fn change_password(
  pool: &SqlitePool,
  actor_operator_id: &str,
  old_password: &str,
  new_password: &str,
) -> Result<(), AppError> {
  let row = sqlx::query("SELECT password_hash FROM operator WHERE id = ?")
    .bind(actor_operator_id)
    .fetch_optional(pool)
    .await?;

  let Some(row) = row else {
    return Err(AppError::new(ErrorCode::NotFound, "用户不存在"));
  };

  let hash: String = row.get("password_hash");
  if !crypto::verify_password(&hash, old_password)? {
    return Err(AppError::new(ErrorCode::AuthFailed, "旧密码错误"));
  }

  let new_hash = crypto::hash_password(new_password)?;
  let now = Utc::now().timestamp();

  sqlx::query(
    "UPDATE operator SET password_hash = ?, must_change_pwd = 0, pwd_changed_at = ? WHERE id = ?",
  )
  .bind(new_hash)
  .bind(now)
  .bind(actor_operator_id)
  .execute(pool)
  .await?;

  Ok(())
}
