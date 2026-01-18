use sqlx::SqlitePool;
use tokio::sync::Mutex;

pub struct AppState {
  pub pool: SqlitePool,
  pub write_lock: Mutex<()>,
  pub migrating: Mutex<bool>,
}
