use sqlx::{Row, SqlitePool};

use crate::domain::errors::AppError;

pub async fn get_meta_value(pool: &SqlitePool, key: &str) -> Result<Option<String>, AppError> {
  let row = sqlx::query("SELECT v FROM app_meta WHERE k = ?")
    .bind(key)
    .fetch_optional(pool)
    .await?;

  Ok(row.map(|row| row.get::<String, _>("v")))
}

pub async fn set_meta_value(pool: &SqlitePool, key: &str, value: &str) -> Result<(), AppError> {
  sqlx::query("INSERT INTO app_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
  Ok(())
}
