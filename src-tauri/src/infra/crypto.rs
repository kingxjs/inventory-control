use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::rngs::OsRng;

use crate::domain::errors::{AppError, ErrorCode};

pub fn hash_password(plain: &str) -> Result<String, AppError> {
  let salt = SaltString::generate(&mut OsRng);
  let argon2 = Argon2::default();
  let hash = argon2
    .hash_password(plain.as_bytes(), &salt)
    .map_err(|_| AppError::new(ErrorCode::DbError, "密码哈希失败"))?;
  Ok(hash.to_string())
}

pub fn verify_password(hash: &str, plain: &str) -> Result<bool, AppError> {
  let parsed = PasswordHash::new(hash)
    .map_err(|_| AppError::new(ErrorCode::AuthFailed, "密码校验失败"))?;
  let argon2 = Argon2::default();
  Ok(argon2.verify_password(plain.as_bytes(), &parsed).is_ok())
}
