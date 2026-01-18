use serde::Deserialize;
use serde_json::json;
use tauri::State;

use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::api::command_guard;
use crate::services::{permission_service, rack_service};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateRackInput {
  pub code: String,
  pub name: String,
  pub warehouse_id: Option<String>,
  pub location: Option<String>,
  pub level_count: i64,
  pub slots_per_level: i64,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct UpdateRackInput {
  pub id: String,
  pub name: String,
  pub warehouse_id: Option<String>,
  pub location: Option<String>,
  pub level_count: i64,
  pub slots_per_level: i64,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct UpdateRackStatusInput {
  pub id: String,
  pub status: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct UpdateSlotStatusInput {
  pub slot_id: String,
  pub status: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct ListRackQuery {
  pub page_index: i64,
  pub page_size: i64,
  // actor_operator_id is now provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct ListSlotQuery {
  pub rack_id: String,
  pub level_no: Option<i64>,
  // actor_operator_id is now provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct RegenSlotInput {
  pub rack_id: String,
  pub rack_code: String,
  pub level_count: i64,
  pub slots_per_level: i64,
  // actor_operator_id provided as top-level arg
}

#[tauri::command]
pub async fn list_racks(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: ListRackQuery,
) -> Result<rack_service::RackListResult, AppError> {
  let audit_request = json!({ "actor_operator_id": actor_operator_id.clone() });
  permission_service::require_role_by_id(&state.pool, &actor_operator_id, &["admin", "keeper", "viewer", "member"]).await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::RackList,
    None,
    Some(audit_request),
    || async { rack_service::list_racks(&state.pool, input.page_index, input.page_size).await },
  )
  .await
}

#[tauri::command]
pub async fn create_rack(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: CreateRackInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "code": input.code.clone(),
    "name": input.name.clone(),
    "warehouse_id": input.warehouse_id.clone(),
    "location": input.location.clone(),
    "level_count": input.level_count,
    "slots_per_level": input.slots_per_level,
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::RackCreate,
    None,
    Some(audit_request),
    || async {
      rack_service::create_rack(
        &state.pool,
        &input.code,
        &input.name,
        input.warehouse_id.clone(),
        input.location.clone(),
        input.level_count,
        input.slots_per_level,
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn update_rack(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: UpdateRackInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "id": input.id.clone(),
    "name": input.name.clone(),
    "warehouse_id": input.warehouse_id.clone(),
    "location": input.location.clone(),
    "level_count": input.level_count,
    "slots_per_level": input.slots_per_level,
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::RackUpdate,
    None,
    Some(audit_request),
    || async {
      rack_service::update_rack(
        &state.pool,
        &input.id,
        &input.name,
        input.warehouse_id.clone(),
        input.location.clone(),
        input.level_count,
        input.slots_per_level,
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn set_rack_status(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: UpdateRackStatusInput,
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
    AuditAction::RackStatus,
    None,
    Some(audit_request),
    || async { rack_service::set_rack_status(&state.pool, &input.id, &input.status).await },
  )
  .await
}

#[tauri::command]
pub async fn set_slot_status(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: UpdateSlotStatusInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "slot_id": input.slot_id.clone(),
    "status": input.status.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::SlotStatus,
    None,
    Some(audit_request),
    || async {
      rack_service::set_slot_status(&state.pool, &input.slot_id, &input.status).await
    },
  )
  .await
}

#[tauri::command]
pub async fn list_slots(
  state: State<'_, AppState>,
  actor_operator_id: String,
  query: ListSlotQuery,
) -> Result<rack_service::SlotListResult, AppError> {
  let audit_request = json!({
    "rack_id": query.rack_id.clone(),
    "level_no": query.level_no,
    "actor_operator_id": actor_operator_id.clone()
  });
  permission_service::require_role_by_id(&state.pool, &actor_operator_id, &["admin", "keeper", "viewer", "member"]).await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::SlotList,
    None,
    Some(audit_request),
    || async { rack_service::list_slots(&state.pool, &query.rack_id, query.level_no).await },
  )
  .await
}

#[tauri::command]
pub async fn regenerate_slots(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: RegenSlotInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let now = chrono::Utc::now().timestamp();
  let audit_request = json!({
    "rack_id": input.rack_id.clone(),
    "rack_code": input.rack_code.clone(),
    "level_count": input.level_count,
    "slots_per_level": input.slots_per_level,
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::SlotRegen,
    None,
    Some(audit_request),
    || async {
      rack_service::regenerate_slots(
        &state.pool,
        &input.rack_id,
        &input.rack_code,
        None,
        input.level_count,
        input.slots_per_level,
        now,
      )
      .await
    },
  )
  .await
}
