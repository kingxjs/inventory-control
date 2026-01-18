use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
  AuthFailed,
  PwdChangeRequired,
  ValidationError,
  NotFound,
  InactiveResource,
  InsufficientStock,
  Conflict,
  Forbidden,
  DbError,
  IoError,
}

#[derive(Debug, Serialize, Error)]
#[error("{code:?}: {message}")]
pub struct AppError {
  pub code: ErrorCode,
  pub message: String,
}

impl AppError {
  pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
    Self {
      code,
      message: message.into(),
    }
  }
}

impl From<sqlx::Error> for AppError {
  fn from(_err: sqlx::Error) -> Self {
    AppError::new(ErrorCode::DbError, "数据库操作失败")
  }
}
