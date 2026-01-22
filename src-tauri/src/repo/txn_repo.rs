// Txn repository - cleaned and consolidated
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool, Transaction};

use crate::domain::errors::{AppError, ErrorCode};

#[derive(Debug, Clone, serde::Serialize)]
pub struct TxnRow {
    pub id: String,
    pub txn_no: String,
    pub txn_type: String,
    pub occurred_at: i64,
    pub created_at: i64,
    pub operator_id: String,
    pub item_id: String,
    pub from_slot_id: Option<String>,
    pub to_slot_id: Option<String>,
    pub qty: i64,
    pub actual_qty: Option<i64>,
    pub ref_txn_id: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TxnListRow {
    pub id: String,
    pub txn_no: String,
    pub txn_type: String,
    pub occurred_at: i64,
    pub created_at: i64,
    pub operator_id: String,
    pub operator_name: String,
    pub item_id: String,
    pub item_code: String,
    pub item_name: String,
    pub from_slot_id: Option<String>,
    pub from_slot_code: Option<String>,
    pub to_slot_id: Option<String>,
    pub to_slot_code: Option<String>,
    pub qty: i64,
    pub actual_qty: Option<i64>,
    pub ref_txn_id: Option<String>,
    pub has_reversal: bool,
    pub ref_txn_no: Option<String>,
    pub ref_txn_type: Option<String>,
    pub ref_item_id: Option<String>,
    pub ref_item_name: Option<String>,
    pub ref_operator_id: Option<String>,
    pub ref_operator_name: Option<String>,
    pub ref_from_slot_id: Option<String>,
    pub ref_from_slot_code: Option<String>,
    pub ref_to_slot_id: Option<String>,
    pub ref_to_slot_code: Option<String>,
    pub ref_qty: Option<i64>,
    pub ref_actual_qty: Option<i64>,
    pub ref_occurred_at: Option<i64>,
    pub ref_note: Option<String>,
    pub note: Option<String>,
}

pub async fn insert_txn(
    tx: &mut Transaction<'_, sqlx::Sqlite>,
    row: &TxnRow,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO txn (id, txn_no, type, occurred_at, created_at, operator_id, item_id, from_slot_id, to_slot_id, qty, actual_qty, ref_txn_id, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&row.id)
    .bind(&row.txn_no)
    .bind(&row.txn_type)
    .bind(row.occurred_at)
    .bind(row.created_at)
    .bind(&row.operator_id)
    .bind(&row.item_id)
    .bind(&row.from_slot_id)
    .bind(&row.to_slot_id)
    .bind(row.qty)
    .bind(row.actual_qty)
    .bind(&row.ref_txn_id)
    .bind(&row.note)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

pub async fn get_txn_by_no(pool: &SqlitePool, txn_no: &str) -> Result<Option<TxnRow>, AppError> {
    let row = sqlx::query(
        "SELECT id, txn_no, type, occurred_at, created_at, operator_id, item_id, from_slot_id, to_slot_id, qty, actual_qty, ref_txn_id, note FROM txn WHERE txn_no = ?"
    )
    .bind(txn_no)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|row| TxnRow {
        id: row.get("id"),
        txn_no: row.get("txn_no"),
        txn_type: row.get("type"),
        occurred_at: row.get("occurred_at"),
        created_at: row.get("created_at"),
        operator_id: row.get("operator_id"),
        item_id: row.get("item_id"),
        from_slot_id: row.get("from_slot_id"),
        to_slot_id: row.get("to_slot_id"),
        qty: row.get("qty"),
        actual_qty: row.get("actual_qty"),
        ref_txn_id: row.get("ref_txn_id"),
        note: row.get("note"),
    }))
}

pub async fn has_reversal(pool: &SqlitePool, ref_txn_id: &str) -> Result<bool, AppError> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(1) FROM txn WHERE ref_txn_id = ? AND type = 'REVERSAL'")
        .bind(ref_txn_id)
        .fetch_one(pool)
        .await?;
    Ok(count > 0)
}

pub async fn get_txn_by_id(pool: &SqlitePool, id: &str) -> Result<TxnRow, AppError> {
    let row = sqlx::query(
        "SELECT id, txn_no, type, occurred_at, created_at, operator_id, item_id, from_slot_id, to_slot_id, qty, actual_qty, ref_txn_id, note FROM txn WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Err(AppError::new(ErrorCode::NotFound, "流水不存在"));
    };

    Ok(TxnRow {
        id: row.get("id"),
        txn_no: row.get("txn_no"),
        txn_type: row.get("type"),
        occurred_at: row.get("occurred_at"),
        created_at: row.get("created_at"),
        operator_id: row.get("operator_id"),
        item_id: row.get("item_id"),
        from_slot_id: row.get("from_slot_id"),
        to_slot_id: row.get("to_slot_id"),
        qty: row.get("qty"),
        actual_qty: row.get("actual_qty"),
        ref_txn_id: row.get("ref_txn_id"),
        note: row.get("note"),
    })
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
) -> Result<Vec<TxnListRow>, AppError> {
    let offset = (page_index - 1) * page_size;

    let sql = r#"SELECT txn.id, txn.txn_no, txn."type" AS txn_type, txn.occurred_at, txn.created_at,
     op.id AS operator_id, op.display_name AS operator_name, it.id AS item_id, it.item_code AS item_code, it.name AS item_name,
     fs.id AS from_slot_id, fs.code AS from_slot_code, ts.id AS to_slot_id, ts.code AS to_slot_code,
     txn.qty, txn.actual_qty, txn.ref_txn_id,
     EXISTS (SELECT 1 FROM txn AS rev WHERE rev.ref_txn_id = txn.id AND rev.type = 'REVERSAL') AS has_reversal,
     ref.txn_no AS ref_txn_no, ref."type" AS ref_txn_type, ref_it.id AS ref_item_id, ref_it.name AS ref_item_name,
     ref_op.id AS ref_operator_id, ref_op.display_name AS ref_operator_name, ref_fs.id AS ref_from_slot_id,
     ref_fs.code AS ref_from_slot_code, ref_ts.id AS ref_to_slot_id, ref_ts.code AS ref_to_slot_code,
     ref.qty AS ref_qty, ref.actual_qty AS ref_actual_qty, ref.occurred_at AS ref_occurred_at, ref.note AS ref_note,
     txn.note
     FROM txn
     JOIN "operator" AS op ON txn.operator_id = op.id
     JOIN item AS it ON txn.item_id = it.id
     LEFT JOIN slot AS fs ON txn.from_slot_id = fs.id
     LEFT JOIN slot AS ts ON txn.to_slot_id = ts.id
     LEFT JOIN rack AS fr ON fs.rack_id = fr.id
     LEFT JOIN rack AS tr ON ts.rack_id = tr.id
     LEFT JOIN txn AS ref ON txn.ref_txn_id = ref.id
     LEFT JOIN "operator" AS ref_op ON ref.operator_id = ref_op.id
     LEFT JOIN item AS ref_it ON ref.item_id = ref_it.id
     LEFT JOIN slot AS ref_fs ON ref.from_slot_id = ref_fs.id
     LEFT JOIN slot AS ref_ts ON ref.to_slot_id = ref_ts.id"#;

    let mut builder: QueryBuilder<Sqlite> = QueryBuilder::new(sql);
    let mut has_where = false;
    let mut push_where = |b: &mut QueryBuilder<Sqlite>| {
        if has_where {
            b.push(" AND ");
        } else {
            b.push(" WHERE ");
            has_where = true;
        }
    };

    if let Some(txn_type) = txn_type {
        push_where(&mut builder);
        builder.push("txn.\"type\" = ");
        builder.push_bind(txn_type);
    }

    if let Some(keyword) = keyword {
        let like = format!("%{}%", keyword);
        push_where(&mut builder);
        builder.push("(");
        builder.push("txn.txn_no LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR it.item_code LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR it.name LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR op.display_name LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR fs.code LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR ts.code LIKE ");
        builder.push_bind(like);
        builder.push(")");
    }

    if let Some(item_id) = item_id {
        push_where(&mut builder);
        builder.push("it.id = ");
        builder.push_bind(item_id);
    }

    if let Some(operator_id) = operator_id {
        push_where(&mut builder);
        builder.push("op.id = ");
        builder.push_bind(operator_id);
    }

    if let Some(slot_id) = slot_id {
        push_where(&mut builder);
        builder.push("(fs.id = ");
        builder.push_bind(slot_id.clone());
        builder.push(" OR ts.id = ");
        builder.push_bind(slot_id);
        builder.push(")");
    }

    if let Some(warehouse_id) = warehouse_id {
        push_where(&mut builder);
        builder.push("(fr.warehouse_id = ");
        builder.push_bind(warehouse_id.clone());
        builder.push(" OR tr.warehouse_id = ");
        builder.push_bind(warehouse_id);
        builder.push(")");
    }

    if let Some(rack_id) = rack_id {
        push_where(&mut builder);
        builder.push("(fr.id = ");
        builder.push_bind(rack_id.clone());
        builder.push(" OR tr.id = ");
        builder.push_bind(rack_id);
        builder.push(")");
    }

    if let Some(start_at) = start_at {
        push_where(&mut builder);
        builder.push("txn.occurred_at >= ");
        builder.push_bind(start_at);
    }

    if let Some(end_at) = end_at {
        push_where(&mut builder);
        builder.push("txn.occurred_at <= ");
        builder.push_bind(end_at);
    }

    builder.push(" ORDER BY txn.created_at DESC LIMIT ");
    builder.push_bind(page_size);
    builder.push(" OFFSET ");
    builder.push_bind(offset);

    let rows = builder.build().fetch_all(pool).await?;

    let items = rows
        .into_iter()
        .map(|row| TxnListRow {
            id: row.get("id"),
            txn_no: row.get("txn_no"),
            txn_type: row.get("txn_type"),
            occurred_at: row.get("occurred_at"),
            created_at: row.get("created_at"),
            operator_id: row.get("operator_id"),
            operator_name: row.get("operator_name"),
            item_id: row.get("item_id"),
            item_code: row.get("item_code"),
            item_name: row.get("item_name"),
            from_slot_id: row.get("from_slot_id"),
            from_slot_code: row.get("from_slot_code"),
            to_slot_id: row.get("to_slot_id"),
            to_slot_code: row.get("to_slot_code"),
            qty: row.get("qty"),
            actual_qty: row.get("actual_qty"),
            ref_txn_id: row.get("ref_txn_id"),
            has_reversal: row.get::<i64, _>("has_reversal") > 0,
            ref_txn_no: row.get("ref_txn_no"),
            ref_txn_type: row.get("ref_txn_type"),
            ref_item_id: row.get("ref_item_id"),
            ref_item_name: row.get("ref_item_name"),
            ref_operator_id: row.get("ref_operator_id"),
            ref_operator_name: row.get("ref_operator_name"),
            ref_from_slot_id: row.get("ref_from_slot_id"),
            ref_from_slot_code: row.get("ref_from_slot_code"),
            ref_to_slot_id: row.get("ref_to_slot_id"),
            ref_to_slot_code: row.get("ref_to_slot_code"),
            ref_qty: row.get("ref_qty"),
            ref_actual_qty: row.get("ref_actual_qty"),
            ref_occurred_at: row.get("ref_occurred_at"),
            ref_note: row.get("ref_note"),
            note: row.get("note"),
        })
        .collect();

    Ok(items)
}

pub async fn count_txns_filtered(
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
) -> Result<i64, AppError> {
    let sql = r#"SELECT COUNT(1) FROM txn
     JOIN "operator" AS op ON txn.operator_id = op.id
     JOIN item AS it ON txn.item_id = it.id
     LEFT JOIN slot AS fs ON txn.from_slot_id = fs.id
     LEFT JOIN slot AS ts ON txn.to_slot_id = ts.id
     LEFT JOIN rack AS fr ON fs.rack_id = fr.id
     LEFT JOIN rack AS tr ON ts.rack_id = tr.id"#;

    let mut builder: QueryBuilder<Sqlite> = QueryBuilder::new(sql);
    let mut has_where = false;
    let mut push_where = |b: &mut QueryBuilder<Sqlite>| {
        if has_where {
            b.push(" AND ");
        } else {
            b.push(" WHERE ");
            has_where = true;
        }
    };

    if let Some(txn_type) = txn_type {
        push_where(&mut builder);
        builder.push("txn.\"type\" = ");
        builder.push_bind(txn_type);
    }

    if let Some(keyword) = keyword {
        let like = format!("%{}%", keyword);
        push_where(&mut builder);
        builder.push("(");
        builder.push("txn.txn_no LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR it.item_code LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR it.name LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR op.display_name LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR fs.code LIKE ");
        builder.push_bind(like.clone());
        builder.push(" OR ts.code LIKE ");
        builder.push_bind(like);
        builder.push(")");
    }

    if let Some(item_id) = item_id {
        push_where(&mut builder);
        builder.push("it.id = ");
        builder.push_bind(item_id);
    }

    if let Some(operator_id) = operator_id {
        push_where(&mut builder);
        builder.push("op.id = ");
        builder.push_bind(operator_id);
    }

    if let Some(slot_id) = slot_id {
        push_where(&mut builder);
        builder.push("(fs.id = ");
        builder.push_bind(slot_id.clone());
        builder.push(" OR ts.id = ");
        builder.push_bind(slot_id);
        builder.push(")");
    }

    if let Some(warehouse_id) = warehouse_id {
        push_where(&mut builder);
        builder.push("(fr.warehouse_id = ");
        builder.push_bind(warehouse_id.clone());
        builder.push(" OR tr.warehouse_id = ");
        builder.push_bind(warehouse_id);
        builder.push(")");
    }

    if let Some(rack_id) = rack_id {
        push_where(&mut builder);
        builder.push("(fr.id = ");
        builder.push_bind(rack_id.clone());
        builder.push(" OR tr.id = ");
        builder.push_bind(rack_id);
        builder.push(")");
    }

    if let Some(start_at) = start_at {
        push_where(&mut builder);
        builder.push("txn.occurred_at >= ");
        builder.push_bind(start_at);
    }

    if let Some(end_at) = end_at {
        push_where(&mut builder);
        builder.push("txn.occurred_at <= ");
        builder.push_bind(end_at);
    }

    let (count,): (i64,) = builder.build_query_as::<(i64,)>().fetch_one(pool).await?;
    Ok(count)
}

pub async fn count_txns(pool: &SqlitePool) -> Result<i64, AppError> {
    count_txns_filtered(pool, None, None, None, None, None, None, None, None, None).await
}

#[derive(Debug)]
pub struct TxnExportRow {
    pub txn_type: String,
    pub item_code: String,
    pub from_slot_code: Option<String>,
    pub to_slot_code: Option<String>,
    pub qty: i64,
    pub actual_qty: Option<i64>,
    pub occurred_at: i64,
    pub operator_username: String,
    pub note: Option<String>,
    pub ref_txn_no: Option<String>,
}

pub async fn list_txns_export(pool: &SqlitePool) -> Result<Vec<TxnExportRow>, AppError> {
    let rows = sqlx::query(
        "SELECT txn.type AS txn_type, item.item_code AS item_code, from_slot.code AS from_slot_code, to_slot.code AS to_slot_code, txn.qty AS qty, txn.actual_qty AS actual_qty, txn.occurred_at AS occurred_at, operator.username AS operator_username, txn.note AS note, ref.txn_no AS ref_txn_no FROM txn JOIN item ON txn.item_id = item.id JOIN operator ON txn.operator_id = operator.id LEFT JOIN slot AS from_slot ON txn.from_slot_id = from_slot.id LEFT JOIN slot AS to_slot ON txn.to_slot_id = to_slot.id LEFT JOIN txn AS ref ON txn.ref_txn_id = ref.id ORDER BY txn.created_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let items = rows
        .into_iter()
        .map(|row| TxnExportRow {
            txn_type: row.get("txn_type"),
            item_code: row.get("item_code"),
            from_slot_code: row.get("from_slot_code"),
            to_slot_code: row.get("to_slot_code"),
            qty: row.get("qty"),
            actual_qty: row.get("actual_qty"),
            occurred_at: row.get("occurred_at"),
            operator_username: row.get("operator_username"),
            note: row.get("note"),
            ref_txn_no: row.get("ref_txn_no"),
        })
        .collect();

    Ok(items)
}
