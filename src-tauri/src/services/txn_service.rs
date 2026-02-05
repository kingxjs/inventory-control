use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::{item_repo, operator_repo, rack_repo, stock_repo, txn_repo, warehouse_repo};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::repo::meta_repo;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use std::path::PathBuf;
use csv::WriterBuilder;

pub async fn create_inbound(
  pool: &SqlitePool,
  item_id: &str,
  to_slot_id: &str,
  qty: i64,
  occurred_at: i64,
  actor_operator_id: &str,
  note: Option<String>,
) -> Result<String, AppError> {
  if qty <= 0 {
    return Err(AppError::new(ErrorCode::ValidationError, "数量必须为正整数"));
  }

  let operator = require_active_operator_by_id(pool, actor_operator_id).await?;

  let now = Utc::now().timestamp();
  let item_id = item_id.to_string();
  let operator_id = operator.id.clone();
  let slot_id = to_slot_id.to_string();
  let txn_id = Uuid::new_v4().to_string();
  let txn_no = format!("T{}", Uuid::new_v4());

  let mut tx = pool.begin().await?;

  let row = txn_repo::TxnRow {
    id: txn_id,
    txn_no: txn_no.clone(),
    txn_type: "IN".to_string(),
    occurred_at,
    created_at: now,
    operator_id: operator_id.clone(),
    item_id: item_id.clone(),
    from_slot_id: None,
    to_slot_id: Some(slot_id.clone()),
    qty,
    actual_qty: None,
    ref_txn_id: None,
    note,
  };
  txn_repo::insert_txn(&mut tx, &row).await?;

  let current = stock_repo::get_stock_tx(&mut tx, &item_id, &slot_id).await?;
  let next_qty = current.map(|s| s.qty).unwrap_or(0) + qty;
  stock_repo::upsert_stock_tx(&mut tx, &item_id, &slot_id, next_qty, now).await?;

  tx.commit().await?;
  Ok(txn_no)
}

pub async fn create_outbound(
  pool: &SqlitePool,
  item_id: &str,
  from_slot_id: &str,
  qty: i64,
  occurred_at: i64,
  actor_operator_id: &str,
  note: Option<String>,
) -> Result<String, AppError> {
  if qty <= 0 {
    return Err(AppError::new(ErrorCode::ValidationError, "数量必须为正整数"));
  }

  let operator = require_active_operator_by_id(pool, actor_operator_id).await?;

  let now = Utc::now().timestamp();
  let item_id = item_id.to_string();
  let operator_id = operator.id.clone();
  let slot_id = from_slot_id.to_string();
  let txn_id = Uuid::new_v4().to_string();
  let txn_no = format!("T{}", Uuid::new_v4());

  let mut tx = pool.begin().await?;

  let current = stock_repo::get_stock_tx(&mut tx, &item_id, &slot_id).await?;
  let current_qty = current.map(|s| s.qty).unwrap_or(0);
  if current_qty < qty {
    return Err(AppError::new(ErrorCode::InsufficientStock, "库存不足"));
  }
  let next_qty = current_qty - qty;

  let row = txn_repo::TxnRow {
    id: txn_id,
    txn_no: txn_no.clone(),
    txn_type: "OUT".to_string(),
    occurred_at,
    created_at: now,
    operator_id: operator_id.clone(),
    item_id: item_id.clone(),
    from_slot_id: Some(slot_id.clone()),
    to_slot_id: None,
    qty,
    actual_qty: None,
    ref_txn_id: None,
    note,
  };
  txn_repo::insert_txn(&mut tx, &row).await?;
  stock_repo::upsert_stock_tx(&mut tx, &item_id, &slot_id, next_qty, now).await?;

  tx.commit().await?;
  Ok(txn_no)
}

pub async fn create_move(
  pool: &SqlitePool,
  item_id: &str,
  from_slot_id: &str,
  to_slot_id: &str,
  qty: i64,
  occurred_at: i64,
  actor_operator_id: &str,
  note: Option<String>,
) -> Result<String, AppError> {
  if qty <= 0 {
    return Err(AppError::new(ErrorCode::ValidationError, "数量必须为正整数"));
  }
  if from_slot_id == to_slot_id {
    return Err(AppError::new(ErrorCode::ValidationError, "来源与目标库位不能相同"));
  }

  let operator = require_active_operator_by_id(pool, actor_operator_id).await?;

  let now = Utc::now().timestamp();
  let item_id = item_id.to_string();
  let operator_id = operator.id.clone();
  let from_slot_id_local = from_slot_id.to_string();
  let to_slot_id_local = to_slot_id.to_string();
  let txn_id = Uuid::new_v4().to_string();
  let txn_no = format!("T{}", Uuid::new_v4());

  let mut tx = pool.begin().await?;

  let current = stock_repo::get_stock_tx(&mut tx, &item_id, &from_slot_id_local).await?;
  let current_qty = current.map(|s| s.qty).unwrap_or(0);
  if current_qty < qty {
    return Err(AppError::new(ErrorCode::InsufficientStock, "库存不足"));
  }

  let row = txn_repo::TxnRow {
    id: txn_id,
    txn_no: txn_no.clone(),
    txn_type: "MOVE".to_string(),
    occurred_at,
    created_at: now,
    operator_id: operator_id.clone(),
    item_id: item_id.clone(),
    from_slot_id: Some(from_slot_id_local.clone()),
    to_slot_id: Some(to_slot_id_local.clone()),
    qty,
    actual_qty: None,
    ref_txn_id: None,
    note,
  };
  txn_repo::insert_txn(&mut tx, &row).await?;

  let from_next = current_qty - qty;
  stock_repo::upsert_stock_tx(&mut tx, &item_id, &from_slot_id_local, from_next, now).await?;
  let to_current = stock_repo::get_stock_tx(&mut tx, &item_id, &to_slot_id_local).await?;
  let to_next = to_current.map(|s| s.qty).unwrap_or(0) + qty;
  stock_repo::upsert_stock_tx(&mut tx, &item_id, &to_slot_id_local, to_next, now).await?;

  tx.commit().await?;
  Ok(txn_no)
}

pub async fn create_count(
  pool: &SqlitePool,
  item_id: &str,
  slot_id: &str,
  actual_qty: i64,
  occurred_at: i64,
  actor_operator_id: &str,
  note: Option<String>,
) -> Result<String, AppError> {
  if actual_qty < 0 {
    return Err(AppError::new(ErrorCode::ValidationError, "实盘数量不能为负数"));
  }

  let operator = require_active_operator_by_id(pool, actor_operator_id).await?;

  let now = Utc::now().timestamp();
  let item_id = item_id.to_string();
  let operator_id = operator.id.clone();
  let slot_id_local = slot_id.to_string();
  let count_txn_id = Uuid::new_v4().to_string();
  let adjust_txn_id = Uuid::new_v4().to_string();
  let count_txn_no = format!("T{}", Uuid::new_v4());
  let adjust_txn_no = format!("T{}", Uuid::new_v4());

  let mut tx = pool.begin().await?;

  let current = stock_repo::get_stock_tx(&mut tx, &item_id, &slot_id_local).await?;
  let current_qty = current.map(|s| s.qty).unwrap_or(0);
  let delta = actual_qty - current_qty;

  let count_row = txn_repo::TxnRow {
    id: count_txn_id,
    txn_no: count_txn_no.clone(),
    txn_type: "COUNT".to_string(),
    occurred_at,
    created_at: now,
    operator_id: operator_id.clone(),
    item_id: item_id.clone(),
    from_slot_id: Some(slot_id_local.clone()),
    to_slot_id: None,
    qty: 0,
    actual_qty: Some(actual_qty),
    ref_txn_id: None,
    note: note.clone(),
  };
  txn_repo::insert_txn(&mut tx, &count_row).await?;

  let adjust_row = txn_repo::TxnRow {
    id: adjust_txn_id,
    txn_no: adjust_txn_no,
    txn_type: "ADJUST".to_string(),
    occurred_at,
    created_at: now,
    operator_id: operator_id.clone(),
    item_id: item_id.clone(),
    from_slot_id: Some(slot_id_local.clone()),
    to_slot_id: None,
    qty: delta,
    actual_qty: None,
    ref_txn_id: None,
    note,
  };
  txn_repo::insert_txn(&mut tx, &adjust_row).await?;

  stock_repo::upsert_stock_tx(&mut tx, &item_id, &slot_id_local, actual_qty, now).await?;

  tx.commit().await?;
  Ok(count_txn_no)
}

pub async fn reverse_txn(
  pool: &SqlitePool,
  txn_no: &str,
  occurred_at: i64,
  actor_operator_id: &str,
  note: Option<String>,
) -> Result<String, AppError> {
  let operator = require_active_operator_by_id(pool, actor_operator_id).await?;
  let target = txn_repo::get_txn_by_no(pool, txn_no).await?;
  let Some(target) = target else {
    return Err(AppError::new(ErrorCode::NotFound, "流水不存在"));
  };

  if target.txn_type == "REVERSAL" || target.txn_type == "COUNT" {
    return Err(AppError::new(ErrorCode::ValidationError, "该流水不允许冲正"));
  }
  if txn_repo::has_reversal(pool, &target.id).await? {
    return Err(AppError::new(ErrorCode::Conflict, "该流水已冲正"));
  }

  let now = Utc::now().timestamp();
  let operator_id = operator.id.clone();
  let reversal_id = Uuid::new_v4().to_string();
  let reversal_no = format!("T{}", Uuid::new_v4());

  let mut tx = pool.begin().await?;

  match target.txn_type.as_str() {
    "IN" => {
      let to_slot = target
        .to_slot_id
        .as_ref()
        .ok_or_else(|| AppError::new(ErrorCode::ValidationError, "入库流水缺少目标库位"))?;
      apply_stock_delta(&mut tx, &target.item_id, to_slot, -target.qty, now).await?;
    }
    "OUT" => {
      let from_slot = target
        .from_slot_id
        .as_ref()
        .ok_or_else(|| AppError::new(ErrorCode::ValidationError, "出库流水缺少来源库位"))?;
      apply_stock_delta(&mut tx, &target.item_id, from_slot, target.qty, now).await?;
    }
    "MOVE" => {
      let from_slot = target
        .from_slot_id
        .as_ref()
        .ok_or_else(|| AppError::new(ErrorCode::ValidationError, "移库流水缺少来源库位"))?;
      let to_slot = target
        .to_slot_id
        .as_ref()
        .ok_or_else(|| AppError::new(ErrorCode::ValidationError, "移库流水缺少目标库位"))?;
      apply_stock_delta(&mut tx, &target.item_id, from_slot, target.qty, now).await?;
      apply_stock_delta(&mut tx, &target.item_id, to_slot, -target.qty, now).await?;
    }
    "ADJUST" => {
      let slot = target
        .from_slot_id
        .as_ref()
        .ok_or_else(|| AppError::new(ErrorCode::ValidationError, "调整流水缺少库位"))?;
      apply_stock_delta(&mut tx, &target.item_id, slot, -target.qty, now).await?;
    }
    _ => {
      return Err(AppError::new(ErrorCode::ValidationError, "该流水不允许冲正"));
    }
  }

  let reversal_row = txn_repo::TxnRow {
    id: reversal_id,
    txn_no: reversal_no.clone(),
    txn_type: "REVERSAL".to_string(),
    occurred_at,
    created_at: now,
    operator_id: operator_id.clone(),
    item_id: target.item_id,
    from_slot_id: target.from_slot_id,
    to_slot_id: target.to_slot_id,
    qty: target.qty,
    actual_qty: None,
    ref_txn_id: Some(target.id),
    note,
  };
  txn_repo::insert_txn(&mut tx, &reversal_row).await?;

  tx.commit().await?;
  Ok(reversal_no)
}

#[derive(Debug, serde::Serialize)]
pub struct TxnListResult {
  pub items: Vec<txn_repo::TxnListRow>,
  pub total: i64,
}

pub async fn list_txns(
  pool: &SqlitePool,
  txn_type: Option<String>,
  keyword: Option<String>,
  item_id: Option<String>,
  slot_id: Option<String>,
  warehouse_id: Option<String>,
  rack_id: Option<String>,
  operator_id: Option<String>,
  start_at: Option<i64>,
  end_at: Option<i64>,
  page_index: i64,
  page_size: i64,
) -> Result<TxnListResult, AppError> {
  let (page_index, page_size) = normalize_page(page_index, page_size)?;
  let items = txn_repo::list_txns(
    pool,
    txn_type.clone(),
    keyword.clone(),
    item_id.clone(),
    slot_id.clone(),
    warehouse_id.clone(),
    rack_id.clone(),
    operator_id.clone(),
    start_at,
    end_at,
    page_index,
    page_size,
  )
  .await?;
  let total = txn_repo::count_txns_filtered(
    pool,
    txn_type,
    keyword,
    item_id,
    slot_id,
    warehouse_id,
    rack_id,
    operator_id,
    start_at,
    end_at,
  )
  .await?;
  Ok(TxnListResult { items, total })
}

#[derive(Debug, serde::Serialize)]
pub struct TxnExportResult {
  pub file_path: String,
}

pub async fn export_txns(
  pool: &SqlitePool,
  txn_type: Option<String>,
  keyword: Option<String>,
  item_id: Option<String>,
  slot_id: Option<String>,
  warehouse_id: Option<String>,
  rack_id: Option<String>,
  operator_id: Option<String>,
  start_at: Option<i64>,
  end_at: Option<i64>
) -> Result<TxnExportResult, AppError> {
  // 在移动端使用临时文件，桌面端使用导出目录
  #[cfg(any(target_os = "android", target_os = "ios"))]
  let file_path = {
      let temp_dir = std::env::temp_dir();
      let now = Utc::now().timestamp();
      temp_dir.join(format!("流水导出数据_{}.csv", now))
  };
  
  #[cfg(not(any(target_os = "android", target_os = "ios")))]
  let file_path = {
      let storage_root = meta_repo::get_meta_value(pool, "storage_root")
          .await?
          .ok_or_else(|| AppError::new(ErrorCode::NotFound, "存储根目录未配置"))?;
      let export_dir = match meta_repo::get_meta_value(pool, "exports_dir").await? {
          Some(dir) if !dir.is_empty() => PathBuf::from(dir),
          _ => PathBuf::from(storage_root).join("exports"),
      };
      std::fs::create_dir_all(&export_dir)
          .map_err(|_| AppError::new(ErrorCode::IoError, "创建导出目录失败"))?;
      let now = Utc::now().timestamp();
      export_dir.join(format!("流水导出数据_{}.csv", now))
  };
  let mut writer = WriterBuilder::new()
    .has_headers(true)
    .from_path(&file_path)
    .map_err(|_| AppError::new(ErrorCode::IoError, "创建导出文件失败"))?;

  writer
    .write_record([
      "类型",
      "仓库",
      "货架",
      "来源库位",
      "目标库位",
      "物品",
      "物品编码",
      "数量",
      "实盘数量",
      "发生时间",
      "记录人",
      "备注",
      "关联流水号",
    ])
    .map_err(|_| AppError::new(ErrorCode::IoError, "写入导出文件失败"))?;
  let page_size  = 100;
  // 使用分页查询 list_txns 导出，避免一次性加载所有数据
  let (_start_page, _ps) = normalize_page(1, page_size)?;
  let mut page = 1;
  loop {
    let res = list_txns(
      pool,
      txn_type.clone(),
      keyword.clone(),
      item_id.clone(),
      slot_id.clone(),
      warehouse_id.clone(),
      rack_id.clone(),
      operator_id.clone(),
      start_at,
      end_at,
      page,
      page_size,
    )
    .await?;

    if res.items.is_empty() {
      break;
    }

    let fetched_count = res.items.len() as i64;
    for txn in res.items {
      // 映射类型显示名
      let txn_type_display = match txn.txn_type.as_str() {
        "IN" => "入库",
        "OUT" => "出库",
        "MOVE" => "移库",
        "COUNT" => "盘点",
        "ADJUST" => "调整",
        "REVERSAL" => "冲正",
        other => other,
      };

      // 尝试从来源库位获取货架/仓库信息，若无则使用目标库位
      let mut warehouse_name = String::new();
      let mut rack_name = String::new();
      if let Some(from_slot_id) = &txn.from_slot_id {
        if let Some(slot) = rack_repo::get_slot_by_id(pool, from_slot_id).await? {
          if let Some(rack) = rack_repo::get_rack_by_id(pool, &slot.rack_id).await? {
            rack_name = rack.name.clone();
            if let Some(wid) = rack.warehouse_id.clone() {
              if let Some(wh) = warehouse_repo::get_warehouse_by_id(pool, &wid).await? {
                warehouse_name = wh.name.clone();
              }
            }
          } else if let Some(wid) = slot.warehouse_id.clone() {
            if let Some(wh) = warehouse_repo::get_warehouse_by_id(pool, &wid).await? {
              warehouse_name = wh.name.clone();
            }
          }
        }
      }
      if warehouse_name.is_empty() && rack_name.is_empty() {
        if let Some(to_slot_id) = &txn.to_slot_id {
          if let Some(slot) = rack_repo::get_slot_by_id(pool, to_slot_id).await? {
            if let Some(rack) = rack_repo::get_rack_by_id(pool, &slot.rack_id).await? {
              rack_name = rack.name.clone();
              if let Some(wid) = rack.warehouse_id.clone() {
                if let Some(wh) = warehouse_repo::get_warehouse_by_id(pool, &wid).await? {
                  warehouse_name = wh.name.clone();
                }
              }
            } else if let Some(wid) = slot.warehouse_id.clone() {
              if let Some(wh) = warehouse_repo::get_warehouse_by_id(pool, &wid).await? {
                warehouse_name = wh.name.clone();
              }
            }
          }
        }
      }

      writer
        .write_record([
          txn_type_display.to_string(),
          warehouse_name,
          rack_name,
          txn.from_slot_code.unwrap_or_default(),
          txn.to_slot_code.unwrap_or_default(),
          txn.item_name,
          txn.item_code,
          txn.qty.to_string(),
          txn.actual_qty.map(|v| v.to_string()).unwrap_or_default(),
          txn.occurred_at.to_string(),
          txn.operator_name,
          txn.note.unwrap_or_default(),
          txn.ref_txn_no.unwrap_or_default(),
        ])
        .map_err(|_| AppError::new(ErrorCode::IoError, "写入导出文件失败"))?;
    }

    let fetched_until = page.saturating_mul(page_size);
    if fetched_until >= res.total || fetched_count < page_size {
      break;
    }
    page += 1;
  }

  writer
    .flush()
    .map_err(|_| AppError::new(ErrorCode::IoError, "写入导出文件失败"))?;

  Ok(TxnExportResult {
    file_path: file_path.to_string_lossy().to_string(),
  })
}

async fn require_active_operator_by_id(
  pool: &SqlitePool,
  operator_id: &str,
) -> Result<operator_repo::OperatorRow, AppError> {
  let operator = operator_repo::get_operator_by_id(pool, operator_id)
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "记录人不存在"))?;

  if operator.status != "active" {
    return Err(AppError::new(ErrorCode::InactiveResource, "记录人已停用"));
  }

  Ok(operator)
}

#[allow(dead_code)]
async fn require_active_item(
  pool: &SqlitePool,
  item_code: &str,
) -> Result<item_repo::ItemRow, AppError> {
  let item = item_repo::get_item_by_code(pool, item_code)
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "物品不存在"))?;

  if item.status != "active" {
    return Err(AppError::new(ErrorCode::InactiveResource, "物品已停用"));
  }

  Ok(item)
}

#[allow(dead_code)]
async fn require_active_slot(
  pool: &SqlitePool,
  slot_code: &str,
) -> Result<rack_repo::SlotRow, AppError> {
  let slot = rack_repo::get_slot_by_code(pool, slot_code)
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "库位不存在"))?;

  if slot.status != "active" {
    return Err(AppError::new(ErrorCode::InactiveResource, "库位已停用"));
  }

  Ok(slot)
}

#[allow(dead_code)]
async fn require_active_item_by_id(
  pool: &SqlitePool,
  item_id: &str,
) -> Result<item_repo::ItemRow, AppError> {
  let item = item_repo::get_item_by_id(pool, item_id)
    .await?
    .ok_or_else(|| AppError::new(ErrorCode::NotFound, "物品不存在"))?;

  if item.status != "active" {
    return Err(AppError::new(ErrorCode::InactiveResource, "物品已停用"));
  }
  Ok(item)
}

fn normalize_page(page_index: i64, page_size: i64) -> Result<(i64, i64), AppError> {
  if page_index < 1 || page_size < 1 {
    return Err(AppError::new(ErrorCode::ValidationError, "分页参数非法"));
  }
  Ok((page_index, page_size))
}

async fn apply_stock_delta(
  tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
  item_id: &str,
  slot_id: &str,
  delta: i64,
  now: i64,
) -> Result<(), AppError> {
  let current = stock_repo::get_stock_tx(tx, item_id, slot_id).await?;
  let current_qty = current.map(|s| s.qty).unwrap_or(0);
  let next_qty = current_qty + delta;
  if next_qty < 0 {
    return Err(AppError::new(ErrorCode::InsufficientStock, "库存不足"));
  }

  stock_repo::upsert_stock_tx(tx, item_id, slot_id, next_qty, now).await?;
  Ok(())
}
