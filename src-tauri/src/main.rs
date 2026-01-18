use inventory_control::api::{app_cmd, audit_cmd, auth_cmd, dashboard_cmd, data_cmd, item_cmd, operator_cmd, photo_cmd, rack_cmd, stock_cmd, system_cmd, txn_cmd, warehouse_cmd};
use inventory_control::infra::db;
use inventory_control::state::AppState;
use tauri::Manager;
use tokio::sync::Mutex;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let handle = app.handle().clone();
      let main_window = app
        .get_webview_window("main")
        .ok_or("主窗口未初始化")?;
      main_window.hide().map_err(|err| err.to_string())?;

      tauri::WebviewWindowBuilder::new(
        app,
        "splashscreen",
        tauri::WebviewUrl::App("splashscreen.html".into()),
      )
      .decorations(false)
      .resizable(false)
      .inner_size(480.0, 320.0)
      .center()
      .build()
      .map_err(|err| err.to_string())?;

      // 启动时初始化数据库与基础数据
      let (pool, _storage_root) =
        tauri::async_runtime::block_on(db::init_db(&handle))
          .map_err(|err| err.to_string())?;

      app.manage(AppState {
        pool,
        write_lock: Mutex::new(()),
        migrating: Mutex::new(false),
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // 审计查询相关命令
      audit_cmd::list_audit_logs,
      audit_cmd::export_audit_logs,
      // 备份/导入导出相关命令
      data_cmd::backup_db,
      data_cmd::restore_db,
      data_cmd::export_items,
      data_cmd::export_txns,
      data_cmd::import_items,
      data_cmd::import_txns,
      // 认证相关命令
      auth_cmd::login,
      auth_cmd::change_password,
      // 人员管理相关命令
      operator_cmd::list_operators,
      operator_cmd::create_operator,
      operator_cmd::update_operator,
      operator_cmd::set_operator_status,
      operator_cmd::reset_operator_password,
      // 结构管理相关命令
      warehouse_cmd::list_warehouses,
      warehouse_cmd::create_warehouse,
      warehouse_cmd::update_warehouse,
      warehouse_cmd::set_warehouse_status,
      rack_cmd::list_racks,
      rack_cmd::create_rack,
      rack_cmd::update_rack,
      rack_cmd::set_rack_status,
      rack_cmd::set_slot_status,
      rack_cmd::list_slots,
      rack_cmd::regenerate_slots,
      // 物品与照片相关命令
      item_cmd::list_items,
      item_cmd::create_item,
      item_cmd::update_item,
      item_cmd::set_item_status,
      photo_cmd::list_photos,
      photo_cmd::add_photos,
      photo_cmd::read_photo_bytes,
      photo_cmd::remove_photo,
      photo_cmd::reorder_photos,
      // 交易相关命令
      txn_cmd::create_inbound,
      txn_cmd::create_outbound,
      txn_cmd::create_move,
      txn_cmd::create_count,
      txn_cmd::reverse_txn,
      txn_cmd::list_txns,
      dashboard_cmd::get_dashboard_overview,
      // 系统设置相关命令
      system_cmd::get_settings,
      system_cmd::set_settings,
      system_cmd::set_storage_root,
      // 库存管理相关命令
      stock_cmd::list_stock_by_slot,
      stock_cmd::list_stock_by_item,
      stock_cmd::export_stock,
      app_cmd::close_splashscreen
    ])
    .run(tauri::generate_context!())
    .expect("tauri runtime error");
}
