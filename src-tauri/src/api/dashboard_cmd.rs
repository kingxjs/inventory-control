use serde::Deserialize;
use serde_json::json;
use tauri::State;

use crate::api::command_guard;
use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::services::{dashboard_service, permission_service};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct DashboardOverviewQuery {
  // actor_operator_id provided as top-level arg
}

#[tauri::command]
pub async fn get_dashboard_overview(
  state: State<'_, AppState>,
  actor_operator_id: String,
  _query: DashboardOverviewQuery,
) -> Result<dashboard_service::DashboardOverview, AppError> {
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "viewer"],
  )
  .await?;
  let audit_request = json!({
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::DashboardOverview,
    None,
    Some(audit_request),
    || async { dashboard_service::get_overview(&state.pool).await },
  )
  .await
}
