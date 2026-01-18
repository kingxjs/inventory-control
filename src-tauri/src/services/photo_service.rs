use std::path::{Path, PathBuf};

use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::{meta_repo, photo_repo};

#[derive(Debug, serde::Serialize)]
pub struct PhotoListResult {
  pub items: Vec<photo_repo::PhotoRow>,
}

pub async fn list_photos(
  pool: &SqlitePool,
  photo_type: &str,
  data_id: &str,
) -> Result<PhotoListResult, AppError> {
  let items = photo_repo::list_photos(pool, photo_type, data_id).await?;
  Ok(PhotoListResult { items })
}

pub async fn add_photos(
  pool: &SqlitePool,
  photo_type: &str,
  data_id: &str,
  src_paths: Vec<String>,
) -> Result<(), AppError> {
  let storage_root = get_storage_root(pool).await?;
  let photo_dir = storage_root
    .join("photos")
    .join(photo_type)
    .join(data_id);
  std::fs::create_dir_all(&photo_dir)
    .map_err(|_| AppError::new(ErrorCode::IoError, "创建照片目录失败"))?;

  let now = Utc::now().timestamp();
  let mut sort_no = 0;
  let existing = photo_repo::list_photos(pool, photo_type, data_id).await?;
  if let Some(last) = existing.last() {
    sort_no = last.sort_no + 1;
  }

  for src in src_paths {
    let src_path = Path::new(&src);
    if !src_path.exists() {
      return Err(AppError::new(ErrorCode::ValidationError, "照片路径不存在"));
    }

    let ext = src_path
      .extension()
      .and_then(|ext| ext.to_str())
      .unwrap_or("bin");
    let file_name = format!("{}.{}", Uuid::new_v4(), ext);
    let dest_path = photo_dir.join(file_name);
    std::fs::copy(src_path, &dest_path)
      .map_err(|_| AppError::new(ErrorCode::IoError, "复制照片失败"))?;

    let relative_path = format!(
      "photos/{}/{}/{}",
      photo_type,
      data_id,
      dest_path.file_name().unwrap().to_string_lossy()
    );
    photo_repo::insert_photo(
      pool,
      &Uuid::new_v4().to_string(),
      photo_type,
      data_id,
      &relative_path,
      None,
      sort_no,
      now,
    )
    .await?;
    sort_no += 1;
  }

  Ok(())
}

pub async fn remove_photo(
  pool: &SqlitePool,
  photo_type: &str,
  data_id: &str,
  photo_id: &str,
) -> Result<(), AppError> {
  let photo = photo_repo::remove_photo(pool, photo_id, photo_type, data_id).await?;
  let storage_root = get_storage_root(pool).await?;
  let full_path = storage_root.join(photo.file_path);

  if full_path.exists() {
    std::fs::remove_file(&full_path)
      .map_err(|_| AppError::new(ErrorCode::IoError, "删除照片失败"))?;
  }

  Ok(())
}

pub async fn read_photo_bytes(path: &str) -> Result<Vec<u8>, AppError> {
  let bytes = tokio::fs::read(path)
    .await
    .map_err(|_| AppError::new(ErrorCode::IoError, "读取图片失败"))?;
  Ok(bytes)
}

pub async fn reorder_photos(
  pool: &SqlitePool,
  _photo_type: &str,
  _data_id: &str,
  photo_ids: Vec<String>,
) -> Result<(), AppError> {
  for (index, photo_id) in photo_ids.iter().enumerate() {
    photo_repo::update_photo_sort(pool, photo_id, index as i64).await?;
  }

  Ok(())
}

async fn get_storage_root(pool: &SqlitePool) -> Result<PathBuf, AppError> {
  let root = meta_repo::get_meta_value(pool, "storage_root")
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "存储根目录未配置"))?;
  Ok(PathBuf::from(root))
}
