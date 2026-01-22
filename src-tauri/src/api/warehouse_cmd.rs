use serde::Deserialize;
use serde_json::json;
use tauri::State;

use crate::api::command_guard;
use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::services::{permission_service, warehouse_service};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateWarehouseInput {
  pub code: String,
  pub name: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct UpdateWarehouseInput {
  pub id: String,
  pub name: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct UpdateWarehouseStatusInput {
  pub id: String,
  pub status: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct ListWarehouseQuery {
  pub keyword: Option<String>,
  pub status: Option<String>,
  pub page_index: i64,
  pub page_size: i64,
  // actor_operator_id provided as top-level arg
}

#[tauri::command]
pub async fn list_warehouses(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: ListWarehouseQuery,
) -> Result<warehouse_service::WarehouseListResult, AppError> {
  let audit_request = json!({ "actor_operator_id": actor_operator_id.clone() });
  permission_service::require_role_by_id(&state.pool, &actor_operator_id, &["admin", "keeper", "viewer", "member"]).await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::WarehouseList,
    None,
    Some(audit_request),
    || async {
      warehouse_service::list_warehouses(
        &state.pool,
        input.keyword.clone(),
        input.status.clone(),
        input.page_index,
        input.page_size,
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn create_warehouse(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: CreateWarehouseInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "code": input.code.clone(),
    "name": input.name.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::WarehouseCreate,
    None,
    Some(audit_request),
    || async { warehouse_service::create_warehouse(&state.pool, &input.code, &input.name).await },
  )
  .await
}

#[tauri::command]
pub async fn update_warehouse(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: UpdateWarehouseInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "id": input.id.clone(),
    "name": input.name.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::WarehouseUpdate,
    None,
    Some(audit_request),
    || async { warehouse_service::update_warehouse(&state.pool, &input.id, &input.name).await },
  )
  .await
}

#[tauri::command]
pub async fn set_warehouse_status(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: UpdateWarehouseStatusInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "id": input.id.clone(),
    "status": input.status.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::WarehouseStatus,
    None,
    Some(audit_request),
    || async {
      warehouse_service::set_warehouse_status(&state.pool, &input.id, &input.status).await
    },
  )
  .await
}

#[derive(Debug, Deserialize)]
pub struct GetWarehouseInput {
  pub id: Option<String>,
  pub code: Option<String>,
}

#[tauri::command]
pub async fn get_warehouse(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: GetWarehouseInput,
) -> Result<Option<crate::repo::warehouse_repo::WarehouseRow>, AppError> {
  permission_service::require_role_by_id(&state.pool, &actor_operator_id, &["admin", "keeper", "viewer", "member"]).await?;
  let audit_request = json!({ "id": input.id.clone(), "code": input.code.clone(), "actor_operator_id": actor_operator_id.clone() });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::WarehouseList,
    None,
    Some(audit_request),
    || async {
      if let Some(id) = input.id {
        crate::repo::warehouse_repo::get_warehouse_by_id(&state.pool, &id).await
      } else if let Some(code) = input.code {
        crate::repo::warehouse_repo::get_warehouse_by_code(&state.pool, &code).await
      } else {
        Ok(None)
      }
    },
  )
  .await
}
