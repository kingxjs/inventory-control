use serde_json::json;
use tauri::State;

use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::api::command_guard;
use crate::services::{permission_service, stock_service};
use crate::state::AppState;

#[derive(Debug, serde::Deserialize)]
pub struct StockQueryInput {
  // actor_operator_id provided as top-level arg
  pub page_index: i64,
  pub page_size: i64,
}

#[tauri::command]
pub async fn list_stock_by_slot(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: StockQueryInput,
) -> Result<stock_service::StockBySlotResult, AppError> {
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "viewer", "member"],
  )
  .await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::StockListBySlot,
    None,
    Some(json!({ "actor_operator_id": actor_operator_id.clone() })),
    || async {
      stock_service::list_stock_by_slot(&state.pool, input.page_index, input.page_size).await
    },
  )
  .await
}

#[tauri::command]
pub async fn list_stock_by_item(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: StockQueryInput,
) -> Result<stock_service::StockByItemResult, AppError> {
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "viewer", "member"],
  )
  .await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::StockListByItem,
    None,
    Some(json!({ "actor_operator_id": actor_operator_id.clone() })),
    || async {
      stock_service::list_stock_by_item(&state.pool, input.page_index, input.page_size).await
    },
  )
  .await
}

#[tauri::command]
pub async fn export_stock(
  state: State<'_, AppState>,
  actor_operator_id: String,
) -> Result<stock_service::StockExportResult, AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "viewer", "member"],
  )
  .await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::StockExport,
    None,
    Some(json!({ "actor_operator_id": actor_operator_id.clone() })),
    || async { stock_service::export_stock(&state.pool).await },
  )
  .await
}
