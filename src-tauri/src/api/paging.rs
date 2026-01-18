use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct PageQuery {
  pub page_index: i64,
  pub page_size: i64,
}
