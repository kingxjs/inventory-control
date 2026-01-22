use chrono::Utc;
use sqlx::SqlitePool;

use crate::domain::errors::{AppError, ErrorCode};
use crate::repo::{meta_repo, stock_query_repo};

#[derive(Debug, serde::Serialize)]
pub struct StockBySlotResult {
    pub items: Vec<stock_query_repo::StockBySlotRow>,
    pub total: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct StockByItemResult {
    pub items: Vec<stock_query_repo::StockByItemRow>,
    pub total: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct StockExportResult {
    pub file_path: String,
}

pub async fn list_stock_by_slot(
    pool: &SqlitePool,
    page_index: i64,
    page_size: i64,
    warehouse_id: Option<String>,
    rack_id: Option<String>,
    slot_id: Option<String>,
    item_id: Option<String>,
    operator_id: Option<String>,
) -> Result<StockBySlotResult, AppError> {
    let (page_index, page_size) = normalize_page(page_index, page_size)?;
    let total = stock_query_repo::count_stock_by_slot_filtered(
        pool,
        warehouse_id.clone(),
        rack_id.clone(),
        slot_id.clone(),
        item_id.clone(),
        operator_id.clone(),
    )
    .await?;
    let items = stock_query_repo::list_stock_by_slot(
        pool,
        page_index,
        page_size,
        warehouse_id,
        rack_id,
        slot_id,
        item_id,
        operator_id,
    )
    .await?;
    Ok(StockBySlotResult { items, total })
}

pub async fn list_stock_by_item(
    pool: &SqlitePool,
    page_index: i64,
    page_size: i64,
    warehouse_id: Option<String>,
    rack_id: Option<String>,
    slot_id: Option<String>,
    item_id: Option<String>,
    operator_id: Option<String>,
) -> Result<StockByItemResult, AppError> {
    let (page_index, page_size) = normalize_page(page_index, page_size)?;
    let total = stock_query_repo::count_stock_by_item_filtered(
        pool,
        warehouse_id.clone(),
        rack_id.clone(),
        slot_id.clone(),
        item_id.clone(),
        operator_id.clone(),
    )
    .await?;
    let items = stock_query_repo::list_stock_by_item_filtered(
        pool,
        page_index,
        page_size,
        warehouse_id,
        rack_id,
        slot_id,
        item_id,
        operator_id,
    )
    .await?;
    Ok(StockByItemResult { items, total })
}

pub async fn export_stock(
    pool: &SqlitePool,
    warehouse_id: Option<String>,
    rack_id: Option<String>,
    slot_id: Option<String>,
    item_id: Option<String>,
    operator_id: Option<String>,
) -> Result<StockExportResult, AppError> {
    let storage_root = meta_repo::get_meta_value(pool, "storage_root")
        .await?
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "存储根目录未配置"))?;
    let export_dir = match meta_repo::get_meta_value(pool, "exports_dir").await? {
        Some(dir) if !dir.is_empty() => std::path::PathBuf::from(dir),
        _ => std::path::PathBuf::from(storage_root).join("exports"),
    };
    std::fs::create_dir_all(&export_dir)
        .map_err(|_| AppError::new(ErrorCode::IoError, "创建导出目录失败"))?;

    let now = Utc::now().timestamp();
    let file_path = export_dir.join(format!("库存导出数据_{}.csv", now));
    let mut lines = Vec::new();
    lines.push("仓库,货架,库位,物品,物品编码,数量".to_string());

    // 分页查询，避免一次性加载过多数据
    let page_size = 100;
    let mut page = 1;
    let (_start_page, _page_size_check) = normalize_page(page, page_size)?;
    loop {
        let res = list_stock_by_slot(
            pool,
            page,
            page_size,
            warehouse_id.clone(),
            rack_id.clone(),
            slot_id.clone(),
            item_id.clone(),
            operator_id.clone(),
        )
        .await?;

        if res.items.is_empty() {
            break;
        }

        let fetched_count = res.items.len() as i64;
        for item in res.items {
            lines.push(format!(
                "{},{},{},{},{},{}",
                escape_csv(item.warehouse_name.as_deref().unwrap_or("")),
                escape_csv(&item.rack_name),
                escape_csv(&item.slot_code),
                escape_csv(&item.item_name),
                escape_csv(&item.item_code),
                item.qty
            ));
        }

        // 如果已到达最后一页则停止
        let fetched_until = page.saturating_mul(page_size);
        if fetched_until >= res.total || fetched_count < page_size {
            break;
        }
        page += 1;
    }

    std::fs::write(&file_path, lines.join("\n"))
        .map_err(|_| AppError::new(ErrorCode::IoError, "写入导出文件失败"))?;

    Ok(StockExportResult {
        file_path: file_path.to_string_lossy().to_string(),
    })
}

fn normalize_page(page_index: i64, page_size: i64) -> Result<(i64, i64), AppError> {
    if page_index < 1 || page_size < 1 {
        return Err(AppError::new(ErrorCode::ValidationError, "分页参数非法"));
    }
    Ok((page_index, page_size))
}

fn escape_csv(value: &str) -> String {
    let needs_wrap = value.contains(',') || value.contains('"') || value.contains('\n');
    if !needs_wrap {
        return value.to_string();
    }
    let escaped = value.replace('"', "\"\"");
    format!("\"{}\"", escaped)
}
