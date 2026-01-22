use serde::Deserialize;
use serde_json::json;
use tauri::State;

use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::api::command_guard;
use crate::services::{operator_service, permission_service};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct OperatorListQuery {
  pub keyword: Option<String>,
  pub status: Option<String>,
  // actor_operator_id provided as top-level arg
  pub page_index: i64,
  pub page_size: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateOperatorInput {
  pub username: String,
  pub display_name: String,
  pub role: Option<String>,
  pub password: String,
  pub status: Option<String>,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct UpdateOperatorInput {
  pub id: String,
  pub display_name: String,
  pub role: Option<String>,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct UpdateOperatorStatusInput {
  pub id: String,
  pub status: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct ResetOperatorPasswordInput {
  pub id: String,
  pub new_password: String,
  // actor_operator_id provided as top-level arg
}

#[tauri::command]
pub async fn list_operators(
  state: State<'_, AppState>,
  actor_operator_id: String,
  query: OperatorListQuery,
) -> Result<operator_service::OperatorListResult, AppError> {
  let status = query.status;
  let audit_request = json!({
    "status": status.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::OperatorList,
    None,
    Some(audit_request),
    || async {
      operator_service::list_operators(
        &state.pool,
        query.keyword.clone(),
        status.clone(),
        query.page_index,
        query.page_size,
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn create_operator(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: CreateOperatorInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  // 写锁保护写操作
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "username": input.username.clone(),
    "display_name": input.display_name.clone(),
    "role": input.role.clone(),
    "password": null,
    "status": input.status.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::OperatorCreate,
    None,
    Some(audit_request),
    || async {
      operator_service::create_operator(
        &state.pool,
        &input.username,
        &input.display_name,
        input.role.clone(),
        &input.password,
        input.status.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn update_operator(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: UpdateOperatorInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  // 写锁保护写操作
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "id": input.id.clone(),
    "display_name": input.display_name.clone(),
    "role": input.role.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::OperatorUpdate,
    None,
    Some(audit_request),
    || async {
      operator_service::update_operator(
        &state.pool,
        &input.id,
        &input.display_name,
        input.role.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn set_operator_status(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: UpdateOperatorStatusInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  // 写锁保护写操作
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "id": input.id.clone(),
    "status": input.status.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::OperatorStatus,
    None,
    Some(audit_request),
    || async {
      operator_service::set_operator_status(&state.pool, &input.id, &input.status).await
    },
  )
  .await
}

#[tauri::command]
pub async fn reset_operator_password(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: ResetOperatorPasswordInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  // 写锁保护写操作
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "id": input.id.clone(),
    "new_password": null,
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::AuthResetPassword,
    None,
    Some(audit_request),
    || async {
      operator_service::reset_operator_password(
        &state.pool,
        &input.id,
        &input.new_password,
      )
      .await
    },
  )
  .await
}

#[derive(Debug, Deserialize)]
pub struct GetOperatorInput {
  pub id: String,
}

#[tauri::command]
pub async fn get_operator(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: GetOperatorInput,
) -> Result<Option<crate::repo::operator_repo::OperatorRow>, AppError> {
  // 允许常规角色读取（供选择器使用）
  crate::services::permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "viewer", "member"],
  )
  .await?;

  let audit_request = json!({ "id": input.id.clone(), "actor_operator_id": actor_operator_id.clone() });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::OperatorList,
    None,
    Some(audit_request),
    || async { crate::repo::operator_repo::get_operator_by_id(&state.pool, &input.id).await },
  )
  .await
}
