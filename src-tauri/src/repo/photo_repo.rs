use sqlx::{Row, SqlitePool};

use crate::domain::errors::{AppError, ErrorCode};

#[derive(Debug, serde::Serialize)]
pub struct PhotoRow {
  pub id: String,
  pub data_id: String,
  pub photo_type: String,
  pub file_path: String,
  pub mime: Option<String>,
  pub sort_no: i64,
  pub created_at: i64,
}

pub async fn list_photos(
  pool: &SqlitePool,
  photo_type: &str,
  data_id: &str,
) -> Result<Vec<PhotoRow>, AppError> {
  let rows = sqlx::query(
    "SELECT id, data_id, type, file_path, mime, sort_no, created_at \
     FROM media_attachment WHERE type = ? AND data_id = ? ORDER BY sort_no, created_at",
  )
  .bind(photo_type)
  .bind(data_id)
  .fetch_all(pool)
  .await?;

  let items = rows
    .into_iter()
    .map(|row| PhotoRow {
      id: row.get("id"),
      data_id: row.get("data_id"),
      photo_type: row.get("type"),
      file_path: row.get("file_path"),
      mime: row.get("mime"),
      sort_no: row.get("sort_no"),
      created_at: row.get("created_at"),
    })
    .collect();

  Ok(items)
}

pub async fn list_all_photos(pool: &SqlitePool) -> Result<Vec<PhotoRow>, AppError> {
  let rows = sqlx::query(
    "SELECT id, data_id, type, file_path, mime, sort_no, created_at FROM media_attachment",
  )
  .fetch_all(pool)
  .await?;

  let items = rows
    .into_iter()
    .map(|row| PhotoRow {
      id: row.get("id"),
      data_id: row.get("data_id"),
      photo_type: row.get("type"),
      file_path: row.get("file_path"),
      mime: row.get("mime"),
      sort_no: row.get("sort_no"),
      created_at: row.get("created_at"),
    })
    .collect();

  Ok(items)
}

pub async fn update_photo_path(
  pool: &SqlitePool,
  photo_id: &str,
  file_path: &str,
) -> Result<(), AppError> {
  sqlx::query("UPDATE media_attachment SET file_path = ? WHERE id = ?")
    .bind(file_path)
    .bind(photo_id)
    .execute(pool)
    .await?;
  Ok(())
}

pub async fn insert_photo(
  pool: &SqlitePool,
  id: &str,
  photo_type: &str,
  data_id: &str,
  file_path: &str,
  mime: Option<String>,
  sort_no: i64,
  created_at: i64,
) -> Result<(), AppError> {
  sqlx::query(
    "INSERT INTO media_attachment (id, data_id, type, file_path, mime, sort_no, created_at) \
     VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
  .bind(id)
  .bind(data_id)
  .bind(photo_type)
  .bind(file_path)
  .bind(mime)
  .bind(sort_no)
  .bind(created_at)
  .execute(pool)
  .await?;

  Ok(())
}

pub async fn delete_photo(pool: &SqlitePool, photo_id: &str) -> Result<PhotoRow, AppError> {
  let row = sqlx::query(
    "SELECT id, data_id, type, file_path, mime, sort_no, created_at \
    FROM media_attachment WHERE id = ?",
  )
  .bind(photo_id)
  .fetch_optional(pool)
  .await?;

  let Some(row) = row else {
    return Err(AppError::new(ErrorCode::NotFound, "照片不存在"));
  };

  Ok(PhotoRow {
    id: row.get("id"),
    data_id: row.get("data_id"),
    photo_type: row.get("type"),
    file_path: row.get("file_path"),
    mime: row.get("mime"),
    sort_no: row.get("sort_no"),
    created_at: row.get("created_at"),
  })
}

pub async fn remove_photo(
  pool: &SqlitePool,
  photo_id: &str,
  photo_type: &str,
  data_id: &str,
) -> Result<PhotoRow, AppError> {
  let photo = delete_photo(pool, photo_id).await?;
  if photo.photo_type != photo_type || photo.data_id != data_id {
    return Err(AppError::new(ErrorCode::ValidationError, "照片归属不匹配"));
  }
  sqlx::query("DELETE FROM media_attachment WHERE id = ?")
    .bind(photo_id)
    .execute(pool)
    .await?;
  Ok(photo)
}

pub async fn update_photo_sort(
  pool: &SqlitePool,
  photo_id: &str,
  sort_no: i64,
) -> Result<(), AppError> {
  sqlx::query("UPDATE media_attachment SET sort_no = ? WHERE id = ?")
    .bind(sort_no)
    .bind(photo_id)
    .execute(pool)
    .await?;
  Ok(())
}
