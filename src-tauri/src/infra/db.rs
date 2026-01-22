use std::path::PathBuf;

use chrono::Utc;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::domain::errors::{AppError, ErrorCode};
use crate::infra::crypto;

pub async fn init_db(app: &AppHandle) -> Result<(SqlitePool, PathBuf), AppError> {
  let storage_root = app
    .path()
    .app_data_dir()
    .map_err(|_| AppError::new(ErrorCode::IoError, "无法获取应用数据目录"))?;

  // 按规格创建固定子目录
  let db_dir = storage_root.join("db");
  let photos_dir = storage_root.join("photos");
  let exports_dir = storage_root.join("exports");
  let backups_dir = storage_root.join("backups");

  std::fs::create_dir_all(&db_dir)
    .map_err(|_| AppError::new(ErrorCode::IoError, "创建数据库目录失败"))?;
  std::fs::create_dir_all(&photos_dir)
    .map_err(|_| AppError::new(ErrorCode::IoError, "创建照片目录失败"))?;
  std::fs::create_dir_all(&exports_dir)
    .map_err(|_| AppError::new(ErrorCode::IoError, "创建导出目录失败"))?;
  std::fs::create_dir_all(&backups_dir)
    .map_err(|_| AppError::new(ErrorCode::IoError, "创建备份目录失败"))?;

  let db_path = db_dir.join("db.sqlite");

  let options = SqliteConnectOptions::new()
    .filename(&db_path)
    .create_if_missing(true);

  let pool = SqlitePoolOptions::new()
    .max_connections(5)
    .connect_with(options)
    .await?;

  // 执行初始化迁移
  sqlx::migrate!("./migrations")
    .run(&pool)
    .await
    .map_err(|err| AppError::new(ErrorCode::DbError, format!("数据库迁移失败: {}", err)))?;

  init_app_meta(&pool, &storage_root).await?;
  init_admin_operator(&pool).await?;

  Ok((pool, storage_root))
}

async fn init_app_meta(pool: &SqlitePool, storage_root: &PathBuf) -> Result<(), AppError> {
  // 使用拥有所有权的 String 避免将临时值的借用传递给 SQLx（会导致借用超出作用域）
  let root_str = storage_root.to_string_lossy().into_owned();
  let exports_str = storage_root.join("exports").to_string_lossy().into_owned();
  let backups_str = storage_root.join("backups").to_string_lossy().into_owned();

  sqlx::query("INSERT OR IGNORE INTO app_meta (k, v) VALUES (?, ?)")
    .bind("rbac_enabled")
    .bind("0")
    .execute(pool)
    .await?;

  sqlx::query("INSERT OR IGNORE INTO app_meta (k, v) VALUES (?, ?)")
    .bind("storage_root")
    .bind(root_str)
    .execute(pool)
    .await?;

  sqlx::query("INSERT OR IGNORE INTO app_meta (k, v) VALUES (?, ?)")
    .bind("slot_no_pad")
    .bind("2")
    .execute(pool)
    .await?;

  sqlx::query("INSERT OR IGNORE INTO app_meta (k, v) VALUES (?, ?)")
    .bind("low_stock_threshold")
    .bind("0")
    .execute(pool)
    .await?;

  // 新增导出目录与备份目录的配置，便于后续可配置化
  sqlx::query("INSERT OR IGNORE INTO app_meta (k, v) VALUES (?, ?)")
    .bind("exports_dir")
    .bind(exports_str)
    .execute(pool)
    .await?;

  sqlx::query("INSERT OR IGNORE INTO app_meta (k, v) VALUES (?, ?)")
    .bind("backups_dir")
    .bind(backups_str)
    .execute(pool)
    .await?;

  Ok(())
}

async fn init_admin_operator(pool: &SqlitePool) -> Result<(), AppError> {
  let (count,): (i64,) = sqlx::query_as("SELECT COUNT(1) FROM operator")
    .fetch_one(pool)
    .await?;

  if count > 0 {
    return Ok(());
  }

  let now = Utc::now().timestamp();
  let id = Uuid::new_v4().to_string();
  let hash = crypto::hash_password("123456")?;

  sqlx::query(
    "INSERT INTO operator (id, username, display_name, role, status, password_hash, must_change_pwd, created_at) \
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
  .bind(id)
  .bind("admin")
  .bind("管理员")
  .bind("admin")
  .bind("active")
  .bind(hash)
  .bind(1)
  .bind(now)
  .execute(pool)
  .await?;

  Ok(())
}
