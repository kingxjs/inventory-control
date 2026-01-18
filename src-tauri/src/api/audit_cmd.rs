use serde::Deserialize;
use serde_json::json;
use tauri::State;

use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::api::command_guard;
use crate::services::{audit_service, permission_service};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct AuditListInput {
  pub action: Option<String>,
  pub keyword: Option<String>,
  pub start_at: Option<i64>,
  pub end_at: Option<i64>,
  // actor_operator_id provided as top-level arg
  pub page_index: i64,
  pub page_size: i64,
}

#[derive(Debug, Deserialize)]
pub struct AuditExportInput {
  // actor_operator_id provided as top-level arg
}

#[tauri::command]
pub async fn list_audit_logs(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: AuditListInput,
) -> Result<audit_service::AuditListResult, AppError> {
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let action = input.action;
  let keyword = input.keyword;
  let start_at = input.start_at;
  let end_at = input.end_at;
  let audit_request = json!({
    "action": action.clone(),
    "keyword": keyword.clone(),
    "start_at": start_at,
    "end_at": end_at,
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::AuditList,
    None,
    Some(audit_request),
    || async {
      audit_service::list_audit_logs(
        &state.pool,
        action.clone(),
        keyword.clone(),
        start_at,
        end_at,
        input.page_index,
        input.page_size,
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn export_audit_logs(
  state: State<'_, AppState>,
  actor_operator_id: String,
) -> Result<audit_service::AuditExportResult, AppError> {
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::AuditExport,
    None,
    Some(json!({ "actor_operator_id": actor_operator_id.clone() })),
    || async { audit_service::export_audit_logs(&state.pool).await },
  )
  .await
}
