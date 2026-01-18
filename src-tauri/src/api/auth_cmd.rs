use serde_json::json;
use tauri::State;

use crate::domain::audit::AuditAction;
use crate::domain::errors::AppError;
use crate::api::command_guard;
use crate::services::auth_service::{self, LoginResult};
use crate::state::AppState;

#[tauri::command]
pub async fn login(
  state: State<'_, AppState>,
  username: String,
  password: String,
) -> Result<LoginResult, AppError> {
  let audit_request = json!({ "username": username.clone() });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::AuthLogin,
    None,
    Some(audit_request),
    || async { auth_service::login(&state.pool, &username, &password).await },
  )
  .await
}

#[tauri::command]
pub async fn logout(
  state: State<'_, AppState>,
  #[allow(non_snake_case)]
  actorOperatorId: String,
) -> Result<(), AppError> {
  let audit_request = json!({ "actor_operator_id": actorOperatorId.clone() });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::AuthLogout,
    Some(actorOperatorId),
    Some(audit_request),
    || async { Ok(()) },
  )
  .await
}

#[tauri::command]
pub async fn change_password(
  state: State<'_, AppState>,
  #[allow(non_snake_case)]
  actorOperatorId: String,
  #[allow(non_snake_case)]
  oldPassword: String,
  #[allow(non_snake_case)]
  newPassword: String,
) -> Result<(), AppError> {
  command_guard::ensure_not_migrating(&state).await?;
  // 写锁保护写操作
  let _guard = state.write_lock.lock().await;
  let actor_id = actorOperatorId.clone();
  let audit_request = json!({
    "actor_operator_id": actorOperatorId.clone()
  });
  command_guard::run_with_audit(
    &state.pool,
    AuditAction::AuthChangePassword,
    Some(actor_id),
    Some(audit_request),
    || async {
      auth_service::change_password(
        &state.pool,
        &actorOperatorId,
        &oldPassword,
        &newPassword,
      )
      .await
    },
  )
  .await
}
