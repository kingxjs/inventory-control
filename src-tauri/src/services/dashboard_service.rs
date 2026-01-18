use std::collections::HashMap;

use chrono::{Duration, Local, NaiveDate, TimeZone};
use serde::Serialize;
use sqlx::SqlitePool;

use crate::domain::errors::AppError;
use crate::repo::dashboard_repo;

#[derive(Debug, Serialize)]
pub struct DashboardTxnCounts {
  pub inbound: i64,
  pub outbound: i64,
  pub move_count: i64,
  pub count_count: i64,
  pub reversal: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardTrendPoint {
  pub day: String,
  pub inbound: i64,
  pub outbound: i64,
  pub move_count: i64,
  pub count_count: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardWarehouseStock {
  pub warehouse_code: Option<String>,
  pub warehouse_name: Option<String>,
  pub total_qty: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardOverview {
  pub today: DashboardTxnCounts,
  pub total_stock_qty: i64,
  pub active_items: i64,
  pub active_racks: i64,
  pub active_warehouses: i64,
  pub negative_stock: i64,
  pub trend: Vec<DashboardTrendPoint>,
  pub stock_by_warehouse: Vec<DashboardWarehouseStock>,
}

pub async fn get_overview(pool: &SqlitePool) -> Result<DashboardOverview, AppError> {
  let now = Local::now();
  let today = now.date_naive();
  let today_start = to_local_timestamp(today);
  let tomorrow = today.succ_opt().unwrap_or(today);
  let tomorrow_start = to_local_timestamp(tomorrow);
  let today_end = if tomorrow == today {
    today_start + 86_399
  } else {
    tomorrow_start - 1
  };

  let mut today_counts = DashboardTxnCounts {
    inbound: 0,
    outbound: 0,
    move_count: 0,
    count_count: 0,
    reversal: 0,
  };
  let type_rows = dashboard_repo::count_txns_by_type(pool, today_start, today_end).await?;
  for row in type_rows {
    match row.txn_type.as_str() {
      "IN" => today_counts.inbound = row.total,
      "OUT" => today_counts.outbound = row.total,
      "MOVE" => today_counts.move_count = row.total,
      "COUNT" => today_counts.count_count = row.total,
      "REVERSAL" => today_counts.reversal = row.total,
      _ => {}
    }
  }

  let start_day = today.checked_sub_signed(Duration::days(6)).unwrap_or(today);
  let trend_start = to_local_timestamp(start_day);
  let trend_end = today_end;
  let trend_rows = dashboard_repo::list_txn_trend(pool, trend_start, trend_end).await?;
  let mut trend_map: HashMap<(String, String), i64> = HashMap::new();
  for row in trend_rows {
    trend_map.insert((row.day, row.txn_type), row.total);
  }
  let mut trend = Vec::new();
  for offset in 0..7 {
    let day = start_day
      .checked_add_signed(Duration::days(offset))
      .unwrap_or(today);
    let day_key = day.format("%Y-%m-%d").to_string();
    let inbound = *trend_map.get(&(day_key.clone(), "IN".to_string())).unwrap_or(&0);
    let outbound = *trend_map.get(&(day_key.clone(), "OUT".to_string())).unwrap_or(&0);
    let move_count = *trend_map.get(&(day_key.clone(), "MOVE".to_string())).unwrap_or(&0);
    let count_count = *trend_map.get(&(day_key.clone(), "COUNT".to_string())).unwrap_or(&0);
    trend.push(DashboardTrendPoint {
      day: day_key,
      inbound,
      outbound,
      move_count,
      count_count,
    });
  }

  let total_stock_qty = dashboard_repo::sum_stock_qty(pool).await?;
  let active_items = dashboard_repo::count_active_items(pool).await?;
  let active_racks = dashboard_repo::count_active_racks(pool).await?;
  let active_warehouses = dashboard_repo::count_active_warehouses(pool).await?;
  let negative_stock = dashboard_repo::count_negative_stock(pool).await?;
  let stock_rows = dashboard_repo::list_stock_by_warehouse(pool).await?;
  let stock_by_warehouse = stock_rows
    .into_iter()
    .map(|row| DashboardWarehouseStock {
      warehouse_code: row.warehouse_code,
      warehouse_name: row.warehouse_name,
      total_qty: row.total_qty,
    })
    .collect();

  Ok(DashboardOverview {
    today: today_counts,
    total_stock_qty,
    active_items,
    active_racks,
    active_warehouses,
    negative_stock,
    trend,
    stock_by_warehouse,
  })
}

fn to_local_timestamp(day: NaiveDate) -> i64 {
  let naive = day.and_hms_opt(0, 0, 0).unwrap_or_else(|| day.and_hms_opt(0, 0, 0).unwrap());
  Local.from_local_datetime(&naive).unwrap().timestamp()
}
