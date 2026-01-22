use serde::Deserialize;
use serde_json::json;
use tauri::State;

use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::api::command_guard;
use crate::services::{import_export_service, permission_service, system_service};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ImportInput {
  pub file_path: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct RestoreInput {
  pub file_path: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct ExportInput {
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct BackupInput {
  // actor_operator_id provided as top-level arg
}

#[tauri::command]
pub async fn backup_db(
  state: State<'_, AppState>,
  actor_operator_id: String,
) -> Result<String, AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::DbBackup,
    None,
    Some(json!({ "actor_operator_id": actor_operator_id.clone() })),
    || async { system_service::backup_db(&state.pool).await },
  )
  .await
}

#[tauri::command]
pub async fn restore_db(state: State<'_, AppState>, actor_operator_id: String, input: RestoreInput) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "file_path": input.file_path.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::DbRestore,
    None,
    Some(audit_request),
    || async { system_service::restore_db(&state.pool, &input.file_path).await },
  )
  .await
}

#[tauri::command]
pub async fn export_items(
  state: State<'_, AppState>,
  actor_operator_id: String,
) -> Result<import_export_service::ExportResult, AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(&state.pool, &actor_operator_id, &["admin", "keeper", "viewer"]).await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::ItemExport,
    None,
    Some(json!({ "actor_operator_id": actor_operator_id.clone() })),
    || async { import_export_service::export_items(&state.pool).await },
  )
  .await
}



#[tauri::command]
pub async fn import_items(state: State<'_, AppState>, actor_operator_id: String, input: ImportInput) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "file_path": input.file_path.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::ItemImport,
    None,
    Some(audit_request),
    || async { import_export_service::import_items(&state.pool, &input.file_path).await },
  )
  .await
}

#[tauri::command]
pub async fn import_txns(state: State<'_, AppState>, actor_operator_id: String, input: ImportInput) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "file_path": input.file_path.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::TxnImport,
    None,
    Some(audit_request),
    || async { import_export_service::import_txns(&state.pool, &input.file_path).await },
  )
  .await
}
