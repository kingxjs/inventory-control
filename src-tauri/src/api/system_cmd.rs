use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::domain::audit::AuditAction;
use crate::domain::errors::{AppError, ErrorCode};
use crate::api::command_guard;
use crate::services::{permission_service, system_service};
use crate::state::AppState;
use crate::infra::fs;
use crate::repo::meta_repo;

#[derive(Debug, Deserialize)]
pub struct SetSettingsInput {
  pub rbac_enabled: Option<bool>,
  pub slot_no_pad: Option<i64>,
  pub low_stock_threshold: Option<i64>,
  // actor_operator_id provided as top-level arg
}

#[derive(Debug, Deserialize)]
pub struct SetStorageRootInput {
  pub new_path: String,
  // actor_operator_id provided as top-level arg
}

#[tauri::command]
pub async fn get_settings(
  state: State<'_, AppState>,
) -> Result<system_service::SettingsDto, AppError> {
  system_service::get_settings(&state.pool).await
}

#[tauri::command]
pub async fn set_settings(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: SetSettingsInput,
) -> Result<(), AppError> {
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  let audit_request = json!({
    "rbac_enabled": input.rbac_enabled,
    "slot_no_pad": input.slot_no_pad,
    "low_stock_threshold": input.low_stock_threshold,
    "actor_operator_id": actor_operator_id.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::SystemSettingsUpdate,
    None,
    Some(audit_request),
    || async {
      system_service::set_settings(
        &state.pool,
        input.rbac_enabled,
        input.slot_no_pad,
        input.low_stock_threshold,
      )
      .await
    },
  )
  .await
}

#[tauri::command]
pub async fn set_storage_root(
  app_handle: AppHandle,
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: SetStorageRootInput,
) -> Result<(), AppError> {
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;
  emit_migration_progress(&app_handle, "prepare", "start", "开始迁移");
  {
    let mut migrating = state.migrating.lock().await;
    *migrating = true;
  }
  emit_migration_progress(&app_handle, "lock", "done", "已锁定写入");

  let audit_request = json!({
    "new_path": input.new_path.clone(),
    "actor_operator_id": actor_operator_id.clone()
  });
  emit_migration_progress(&app_handle, "migrate", "start", "开始迁移文件");
  let result = command_guard::run_with_audit(
    &state.pool,
    AuditAction::SystemStorageRootChange,
    None,
    Some(audit_request),
    || async {
      system_service::set_storage_root(
        &state.pool,
        &input.new_path,
        &actor_operator_id,
      )
      .await
    },
  )
  .await;
  if result.is_err() {
    emit_migration_progress(&app_handle, "migrate", "error", "迁移失败");
  } else {
    emit_migration_progress(&app_handle, "verify", "done", "迁移完成并校验");
    emit_migration_progress(&app_handle, "reconnect", "done", "已重连数据库");
    emit_migration_progress(&app_handle, "finish", "done", "迁移结束");
  }

  let mut migrating = state.migrating.lock().await;
  *migrating = false;

  result
}

#[derive(Debug, Deserialize)]
pub struct SetDirInput {
  pub new_path: String,
}

#[tauri::command]
pub async fn set_exports_dir(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: SetDirInput,
) -> Result<(), AppError> {
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;

  let new_root = fs::normalize_path(&input.new_path)?;
  fs::ensure_not_sensitive_dir(&new_root)?;
  fs::ensure_dir_ready(&new_root)?;
  if !fs::is_dir_writable(&new_root)? {
    return Err(AppError::new(ErrorCode::ValidationError, "目标目录不可写"));
  }

  let audit_request = json!({"new_path": input.new_path.clone(), "actor_operator_id": actor_operator_id.clone()});
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::SystemSettingsUpdate,
    None,
    Some(audit_request),
    || async {
      meta_repo::set_meta_value(&state.pool, "exports_dir", &input.new_path).await
    },
  )
  .await
}

#[tauri::command]
pub async fn set_backups_dir(
  state: State<'_, AppState>,
  actor_operator_id: String,
  input: SetDirInput,
) -> Result<(), AppError> {
  let _guard = state.write_lock.lock().await;
  permission_service::require_admin_by_id(&state.pool, &actor_operator_id).await?;

  let new_root = fs::normalize_path(&input.new_path)?;
  fs::ensure_not_sensitive_dir(&new_root)?;
  fs::ensure_dir_ready(&new_root)?;
  if !fs::is_dir_writable(&new_root)? {
    return Err(AppError::new(ErrorCode::ValidationError, "目标目录不可写"));
  }

  let audit_request = json!({"new_path": input.new_path.clone(), "actor_operator_id": actor_operator_id.clone()});
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::SystemSettingsUpdate,
    None,
    Some(audit_request),
    || async {
      meta_repo::set_meta_value(&state.pool, "backups_dir", &input.new_path).await
    },
  )
  .await
}

fn emit_migration_progress(
  app_handle: &AppHandle,
  step: &str,
  status: &str,
  message: &str,
) {
  let _ = app_handle.emit(
    "storage_migration_progress",
    json!({ "step": step, "status": status, "message": message }),
  );
}

#[derive(Debug, Deserialize)]
pub struct ShareFileInput {
  pub file_path: String,
}

#[tauri::command]
pub async fn share_file(
  _state: State<'_, AppState>,
  input: ShareFileInput,
) -> Result<(), AppError> {
  // 仅在移动端（Android/iOS）启用分享功能
  #[cfg(any(target_os = "android", target_os = "ios"))]
  {
    // 使用系统分享功能
    // TODO: 集成 tauri-plugin-share 或使用原生分享 API
    // 目前返回成功，前端会处理文件路径
    Ok(())
  }
  
  #[cfg(not(any(target_os = "android", target_os = "ios")))]
  {
    Err(AppError::new(
      ErrorCode::ValidationError,
      "分享功能仅在移动端可用"
    ))
  }
}
