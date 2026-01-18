use sqlx::SqlitePool;

use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::{meta_repo, operator_repo};

/// 按 operator id 要求管理员权限
pub async fn require_admin_by_id(pool: &SqlitePool, actor_operator_id: &str) -> Result<(), AppError> {
  require_role_by_id(pool, actor_operator_id, &["admin"]).await
}

/// 按 operator id 要求角色（id 形式）
pub async fn require_role_by_id(
  pool: &SqlitePool,
  actor_operator_id: &str,
  allow_roles: &[&str],
) -> Result<(), AppError> {
  if !rbac_enabled(pool).await? {
    return Ok(());
  }
  let operator = operator_repo::get_operator_by_id(pool, actor_operator_id)
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "操作人不存在"))?;
  if operator.status != "active" {
    return Err(AppError::new(ErrorCode::InactiveResource, "操作人已停用"));
  }
  if !allow_roles.iter().any(|role| *role == operator.role) {
    return Err(AppError::new(ErrorCode::Forbidden, "无权限执行该操作"));
  }
  Ok(())
}

/// 读取 RBAC 开关
async fn rbac_enabled(pool: &SqlitePool) -> Result<bool, AppError> {
  let rbac = meta_repo::get_meta_value(pool, "rbac_enabled")
    .await?
    .unwrap_or_else(|| "0".to_string());
  Ok(rbac == "1")
}
