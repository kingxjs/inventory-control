use serde::Deserialize;
use serde_json::json;
use tauri::State;

use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::api::command_guard;
use crate::services::{item_service, permission_service};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListItemQuery {
  pub keyword: Option<String>,
  pub page_index: i64,
  pub page_size: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateItemInput {
  pub item_code: String,
  pub name: String,
  pub model: Option<String>,
  pub spec: Option<String>,
  pub uom: Option<String>,
  pub remark: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItemInput {
  pub id: String,
  pub name: String,
  pub model: Option<String>,
  pub spec: Option<String>,
  pub uom: Option<String>,
  pub remark: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItemStatusInput {
  pub id: String,
  pub status: String,
}

#[tauri::command]
pub async fn list_items(
  state: State<'_, AppState>,
  actor_operator_id: String,
  query: ListItemQuery,
) -> Result<item_service::ItemListResult, AppError> {
  let ListItemQuery { keyword, page_index, page_size } = query;
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "viewer", "member"],
  )
  .await?;
  let audit_request = json!({ "keyword": keyword.clone(), "actor_operator_id": actor_operator_id.clone() });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::ItemList,
    None,
    Some(audit_request),
    || async {
      item_service::list_items(&state.pool, keyword.clone(), page_index, page_size).await
    },
  )
  .await
}

#[tauri::command]
pub async fn create_item(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: CreateItemInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(&state.pool, &actor_operator_id, &["admin", "keeper"]).await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "item_code": input.item_code.clone(),
    "name": input.name.clone(),
    "model": input.model.clone(),
    "spec": input.spec.clone(),
    "uom": input.uom.clone(),
    "remark": input.remark.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::ItemCreate,
    None,
    Some(audit_request),
    || async {
      item_service::create_item(
        &state.pool,
        &input.item_code,
        &input.name,
        input.model.clone(),
        input.spec.clone(),
        input.uom.clone(),
        input.remark.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn update_item(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: UpdateItemInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(&state.pool, &actor_operator_id, &["admin", "keeper"]).await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "id": input.id.clone(),
    "name": input.name.clone(),
    "model": input.model.clone(),
    "spec": input.spec.clone(),
    "uom": input.uom.clone(),
    "remark": input.remark.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::ItemUpdate,
    None,
    Some(audit_request),
    || async {
      item_service::update_item(
        &state.pool,
        &input.id,
        &input.name,
        input.model.clone(),
        input.spec.clone(),
        input.uom.clone(),
        input.remark.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn set_item_status(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: UpdateItemStatusInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(&state.pool, &actor_operator_id, &["admin", "keeper"]).await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "id": input.id.clone(),
    "status": input.status.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::ItemStatus,
    None,
    Some(audit_request),
    || async { item_service::set_item_status(&state.pool, &input.id, &input.status).await },
  )
  .await
}
