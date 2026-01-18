use serde::Deserialize;
use serde_json::json;
use tauri::State;

use crate::api::command_guard;
use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::services::{permission_service, photo_service};
use crate::state::AppState;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PhotoType {
  Item,
  Txn,
}

impl PhotoType {
  fn as_str(self) -> &'static str {
    match self {
      PhotoType::Item => "item",
      PhotoType::Txn => "txn",
    }
  }

  fn audit_list(self) -> AuditAction {
    match self {
      PhotoType::Item => AuditAction::MediaAttachmentItemList,
      PhotoType::Txn => AuditAction::MediaAttachmentTxnList,
    }
  }

  fn audit_add(self) -> AuditAction {
    match self {
      PhotoType::Item => AuditAction::MediaAttachmentItemAdd,
      PhotoType::Txn => AuditAction::MediaAttachmentTxnAdd,
    }
  }

  fn audit_remove(self) -> AuditAction {
    match self {
      PhotoType::Item => AuditAction::MediaAttachmentItemRemove,
      PhotoType::Txn => AuditAction::MediaAttachmentTxnRemove,
    }
  }

  fn audit_reorder(self) -> AuditAction {
    match self {
      PhotoType::Item => AuditAction::MediaAttachmentItemReorder,
      PhotoType::Txn => AuditAction::MediaAttachmentTxnPathRewrite,
    }
  }
}

#[derive(Debug, Deserialize)]
pub struct PhotoListQuery {
  pub photo_type: PhotoType,
  pub data_id: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct AddPhotosInput {
  pub photo_type: PhotoType,
  pub data_id: String,
  pub src_paths: Vec<String>,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct RemovePhotoInput {
  pub photo_type: PhotoType,
  pub data_id: String,
  pub photo_id: String,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct ReorderPhotosInput {
  pub photo_type: PhotoType,
  pub data_id: String,
  pub photo_ids_in_order: Vec<String>,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct ReadPhotoInput {
  pub path: String,
  // actor_operator_id provided as top-level arg
}

#[tauri::command]
pub async fn list_photos(
  state: State<'_, AppState>,
  actor_operator_id: String,
  query: PhotoListQuery,
) -> Result<photo_service::PhotoListResult, AppError> {
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "viewer", "member"],
  )
  .await?;
  let audit_request = json!({
    "photo_type": query.photo_type.as_str(),
    "data_id": query.data_id.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    query.photo_type.audit_list(),
    None,
    Some(audit_request),
    || async {
      photo_service::list_photos(
        &state.pool,
        query.photo_type.as_str(),
        &query.data_id,
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn add_photos(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: AddPhotosInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "member"],
  )
  .await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "photo_type": input.photo_type.as_str(),
    "data_id": input.data_id.clone(),
    "src_paths": input.src_paths.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    input.photo_type.audit_add(),
    None,
    Some(audit_request),
    || async {
      photo_service::add_photos(
        &state.pool,
        input.photo_type.as_str(),
        &input.data_id,
        input.src_paths.clone(),
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn remove_photo(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: RemovePhotoInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "member"],
  )
  .await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "photo_type": input.photo_type.as_str(),
    "data_id": input.data_id.clone(),
    "photo_id": input.photo_id.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    input.photo_type.audit_remove(),
    None,
    Some(audit_request),
    || async {
      photo_service::remove_photo(
        &state.pool,
        input.photo_type.as_str(),
        &input.data_id,
        &input.photo_id,
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn read_photo_bytes(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: ReadPhotoInput,
) -> Result<Vec<u8>, AppError> {
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "viewer", "member"],
  )
  .await?;
  photo_service::read_photo_bytes(&input.path).await
}

#[tauri::command]
pub async fn reorder_photos(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: ReorderPhotosInput,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  permission_service::require_role_by_id(
    &state.pool,
    &actor_operator_id,
    &["admin", "keeper", "member"],
  )
  .await?;
  let _guard = state.write_lock.lock().await;
  let audit_request = json!({
    "photo_type": input.photo_type.as_str(),
    "data_id": input.data_id.clone(),
    "photo_ids_in_order": input.photo_ids_in_order.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    input.photo_type.audit_reorder(),
    None,
    Some(audit_request),
    || async {
      photo_service::reorder_photos(
        &state.pool,
        input.photo_type.as_str(),
        &input.data_id,
        input.photo_ids_in_order.clone(),
      )
      .await
    },
  )
  .await
}
