use serde::Deserialize;
use serde_json::json;
use tauri::State;

use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::api::command_guard;
use crate::services::{permission_service, txn_service};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct InboundInput {
  pub item_code: String,
  pub to_slot_code: String,
  pub qty: i64,
  pub occurred_at: i64,
  // 可选的业务记录操作人（operator.id），若未提供则使用顶层的 actor_operator_id
  pub operator_id: Option<String>,
  pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OutboundInput {
  pub item_code: String,
  pub from_slot_code: String,
  pub qty: i64,
  pub occurred_at: i64,
  // 可选的业务记录操作人（operator.id），若未提供则使用顶层的 actor_operator_id
  pub operator_id: Option<String>,
  pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MoveInput {
  pub item_code: String,
  pub from_slot_code: String,
  pub to_slot_code: String,
  pub qty: i64,
  pub occurred_at: i64,
  // 可选的业务记录操作人（operator.id），若未提供则使用顶层的 actor_operator_id
  pub operator_id: Option<String>,
  pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CountInput {
  pub item_code: String,
  pub slot_code: String,
  pub actual_qty: i64,
  pub occurred_at: i64,
  // 可选的业务记录操作人（operator.id），若未提供则使用顶层的 actor_operator_id
  pub operator_id: Option<String>,
  pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReversalInput {
  pub txn_no: String,
  pub occurred_at: i64,
  // 可选的业务记录操作人（operator.id），若未提供则使用顶层的 actor_operator_id
  pub operator_id: Option<String>,
  pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TxnListInput {
  // actor_operator_id provided as top-level arg
  pub txn_type: Option<String>,
  pub keyword: Option<String>,
  pub item_code: Option<String>,
  pub slot_code: Option<String>,
  pub warehouse_code: Option<String>,
  pub rack_code: Option<String>,
  pub operator_name: Option<String>,
  pub start_at: Option<i64>,
  pub end_at: Option<i64>,
  pub page_index: i64,
  pub page_size: i64,
}

#[tauri::command]
pub async fn create_inbound(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: InboundInput,
) -> Result<String, AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "member"],
  )
  .await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "item_code": input.item_code.clone(),
    "to_slot_code": input.to_slot_code.clone(),
    "qty": input.qty,
    "occurred_at": input.occurred_at,
    "actor_operator_id": actor_operator_id.clone(),
    "operator_id": input.operator_id.clone(),
    "note": input.note.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::TxnInbound,
    None,
    Some(audit_request),
    || async {
      // 使用 input.operator_id（若提供）作为业务记录的 operator_id，否则回退为 actor_operator_id
      let business_operator_id = input.operator_id.clone().unwrap_or_else(|| actor_operator_id.clone());
      txn_service::create_inbound(
        &state.pool,
        &input.item_code,
        &input.to_slot_code,
        input.qty,
        input.occurred_at,
        &business_operator_id,
        input.note.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn create_outbound(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: OutboundInput,
) -> Result<String, AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "member"],
  )
  .await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "item_code": input.item_code.clone(),
    "from_slot_code": input.from_slot_code.clone(),
    "qty": input.qty,
    "occurred_at": input.occurred_at,
    "actor_operator_id": actor_operator_id.clone(),
    "operator_id": input.operator_id.clone(),
    "note": input.note.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::TxnOutbound,
    None,
    Some(audit_request),
    || async {
      let business_operator_id = input.operator_id.clone().unwrap_or_else(|| actor_operator_id.clone());
      txn_service::create_outbound(
        &state.pool,
        &input.item_code,
        &input.from_slot_code,
        input.qty,
        input.occurred_at,
        &business_operator_id,
        input.note.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn create_move(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: MoveInput,
) -> Result<String, AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "member"],
  )
  .await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "item_code": input.item_code.clone(),
    "from_slot_code": input.from_slot_code.clone(),
    "to_slot_code": input.to_slot_code.clone(),
    "qty": input.qty,
    "occurred_at": input.occurred_at,
    "actor_operator_id": actor_operator_id.clone(),
    "operator_id": input.operator_id.clone(),
    "note": input.note.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::TxnMove,
    None,
    Some(audit_request),
    || async {
      let business_operator_id = input.operator_id.clone().unwrap_or_else(|| actor_operator_id.clone());
      txn_service::create_move(
        &state.pool,
        &input.item_code,
        &input.from_slot_code,
        &input.to_slot_code,
        input.qty,
        input.occurred_at,
        &business_operator_id,
        input.note.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn create_count(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: CountInput,
) -> Result<String, AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "member"],
  )
  .await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "item_code": input.item_code.clone(),
    "slot_code": input.slot_code.clone(),
    "actual_qty": input.actual_qty,
    "occurred_at": input.occurred_at,
    "actor_operator_id": actor_operator_id.clone(),
    "operator_id": input.operator_id.clone(),
    "note": input.note.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::TxnCount,
    None,
    Some(audit_request),
    || async {
      let business_operator_id = input.operator_id.clone().unwrap_or_else(|| actor_operator_id.clone());
      txn_service::create_count(
        &state.pool,
        &input.item_code,
        &input.slot_code,
        input.actual_qty,
        input.occurred_at,
        &business_operator_id,
        input.note.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn reverse_txn(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: ReversalInput,
) -> Result<String, AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "txn_no": input.txn_no.clone(),
    "occurred_at": input.occurred_at,
    "actor_operator_id": actor_operator_id.clone(),
    "operator_id": input.operator_id.clone(),
    "note": input.note.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::TxnReversal,
    None,
    Some(audit_request),
    || async {
      let business_operator_id = input.operator_id.clone().unwrap_or_else(|| actor_operator_id.clone());
      txn_service::reverse_txn(
        &state.pool,
        &input.txn_no,
        input.occurred_at,
        &business_operator_id,
        input.note.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn list_txns(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: TxnListInput,
) -> Result<txn_service::TxnListResult, AppError> {
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "viewer", "member"],
  )
  .await?;
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::TxnList,
    None,
    Some(json!({
      "actor_operator_id": actor_operator_id.clone(),
      "txn_type": input.txn_type.clone(),
      "keyword": input.keyword.clone(),
      "item_code": input.item_code.clone(),
      "slot_code": input.slot_code.clone(),
      "warehouse_code": input.warehouse_code.clone(),
      "rack_code": input.rack_code.clone(),
      "operator_name": input.operator_name.clone(),
      "start_at": input.start_at,
      "end_at": input.end_at
    })),
    || async {
      txn_service::list_txns(
        &state.pool,
        input.txn_type.clone(),
        input.keyword.clone(),
        input.item_code.clone(),
        input.slot_code.clone(),
        input.warehouse_code.clone(),
        input.rack_code.clone(),
        input.operator_name.clone(),
        input.start_at,
        input.end_at,
        input.page_index,
        input.page_size,
      )
      .await
    },
  )
  .await
}
