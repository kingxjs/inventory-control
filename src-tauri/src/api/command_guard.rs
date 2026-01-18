// 审计与迁移拦截的统一入口
use serde_json::Value;
use sqlx::SqlitePool;

use crate::domain::audit::AuditAction;
use crate::domain::errors::{AppError, ErrorCode};
// operator_repo 不再用于通过用户名解析 actor id
use crate::services::audit_service;
use crate::state::AppState;

/// 统一执行入口：执行业务逻辑并记录审计
pub async fn run_with_audit<T, F, Fut>(
  pool: &SqlitePool,
  action: AuditAction,
  actor_operator_id: Option<String>,
  request_json: Option<Value>,
  operation: F,
) -> Result<T, AppError>
where
  F: FnOnce() -> Fut,
  Fut: std::future::Future<Output = Result<T, AppError>>,
{
  let result = operation().await;
  let audit_result = result.as_ref().map(|_| ()).map_err(|err| err);
  let (target_type, target_id) = infer_audit_target(action, request_json.as_ref());
  let resolved_actor_operator_id =
    resolve_actor_operator_id(pool, actor_operator_id, request_json.as_ref()).await;
  if let Err(err) = audit_service::write_audit(
    pool,
    action,
    resolved_actor_operator_id,
    target_type,
    target_id,
    request_json,
    audit_result,
  )
  .await
  {
    // 审计写入失败时：成功结果返回审计错误，失败结果保留业务错误
    if result.is_ok() {
      return Err(map_audit_error(err));
    }
  }

  result
}

/// 存储迁移期间阻断写操作
pub async fn ensure_not_migrating(state: &AppState) -> Result<(), AppError> {
  let migrating = state.migrating.lock().await;
  if *migrating {
    return Err(AppError::new(
      ErrorCode::Conflict,
      "存储迁移中，暂不可执行该操作",
    ));
  }
  Ok(())
}

/// 根据动作与请求参数推断审计目标
fn infer_audit_target(
  action: AuditAction,
  request_json: Option<&Value>,
) -> (Option<String>, Option<String>) {
  // 审计目标推断：尽可能给出类型与标识
  let (target_type, keys) = match action {
    AuditAction::AuthLogin
    | AuditAction::AuthLogout
    | AuditAction::AuthChangePassword
    | AuditAction::AuthResetPassword
    | AuditAction::OperatorList
    | AuditAction::OperatorCreate
    | AuditAction::OperatorUpdate
    | AuditAction::OperatorStatus => {
      ("operator", &["id", "username", "actor_operator_id"][..])
    }
    AuditAction::WarehouseList
    | AuditAction::WarehouseCreate
    | AuditAction::WarehouseUpdate
    | AuditAction::WarehouseStatus => ("warehouse", &["id", "code"][..]),
    AuditAction::RackList
    | AuditAction::RackCreate
    | AuditAction::RackUpdate
    | AuditAction::RackStatus => ("rack", &["id", "code"][..]),
    AuditAction::SlotList
    | AuditAction::SlotRegen
    | AuditAction::SlotStatus => ("slot", &["slot_id", "rack_id", "rack_code"][..]),
    AuditAction::ItemList
    | AuditAction::ItemCreate
    | AuditAction::ItemUpdate
    | AuditAction::ItemStatus => ("item", &["id", "item_code"][..]),
    AuditAction::MediaAttachmentItemAdd
    | AuditAction::MediaAttachmentItemList
    | AuditAction::MediaAttachmentItemRemove
    | AuditAction::MediaAttachmentItemReorder
    | AuditAction::MediaAttachmentItemPathRewrite => ("media_attachment", &["photo_id", "item_id"][..]),
    AuditAction::MediaAttachmentTxnAdd
    | AuditAction::MediaAttachmentTxnList
    | AuditAction::MediaAttachmentTxnRemove
    | AuditAction::MediaAttachmentTxnPathRewrite => ("media_attachment", &["photo_id", "txn_no"][..]),
    AuditAction::TxnInbound
    | AuditAction::TxnOutbound
    | AuditAction::TxnMove
    | AuditAction::TxnCount
    | AuditAction::TxnReversal
    | AuditAction::TxnList => ("txn", &["txn_no", "ref_txn_id"][..]),
    AuditAction::SystemSettingsUpdate
    | AuditAction::SystemSettingsRead
    | AuditAction::SystemStorageRootChange => ("system", &["new_path", "action"][..]),
    AuditAction::AuditList | AuditAction::AuditExport => ("audit", &["action"][..]),
    AuditAction::StockListBySlot
    | AuditAction::StockListByItem
    | AuditAction::StockExport => ("stock", &["item_code", "slot_code"][..]),
    AuditAction::DbBackup
    | AuditAction::DbRestore
    | AuditAction::ItemExport
    | AuditAction::ItemImport
    | AuditAction::TxnExport
    | AuditAction::TxnImport => ("data", &["file_path"][..]),
    AuditAction::DashboardOverview => ("dashboard", &["actor_operator_id"][..]),
  };

  let target_id = request_json
    .and_then(|value| value.as_object())
    .and_then(|map| {
      keys
        .iter()
        .find_map(|key| map.get(*key).and_then(|val| val.as_str()))
        .map(|val| val.to_string())
    });

  (Some(target_type.to_string()), target_id)
}

async fn resolve_actor_operator_id(
  _pool: &SqlitePool,
  actor_operator_id: Option<String>,
  request_json: Option<&Value>,
) -> Option<String> {
  if actor_operator_id.is_some() {
    return actor_operator_id;
  }
  let actor_id = request_json
    .and_then(|value| value.as_object())
    .and_then(|map| map.get("actor_operator_id"))
    .and_then(|val| val.as_str())
    .map(|val| val.to_string());
  if actor_id.is_some() {
    return actor_id;
  }
  // 不再支持通过用户名回退解析 actor_operator_id。
  // 若未显式提供 actor_operator_id，则返回 None。
  None
}

/// 审计失败时统一错误返回
fn map_audit_error(err: AppError) -> AppError {
  // 统一审计失败错误信息，避免泄露底层细节
  let code = match err.code {
    ErrorCode::IoError => ErrorCode::IoError,
    _ => ErrorCode::DbError,
  };
  AppError::new(code, "审计写入失败")
}
