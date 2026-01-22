use tauri::Manager;

#[tauri::command]
pub async fn close_splashscreen(window: tauri::WebviewWindow) -> Result<(), String> {
  let app = window.app_handle();
  if let Some(splash) = app.get_webview_window("splashscreen") {
    splash.close().map_err(|err| err.to_string())?;
  }
  if let Some(main) = app.get_webview_window("main") {
    // 在显示前先居中窗口
    main.center().map_err(|err| err.to_string())?;
    main.show().map_err(|err| err.to_string())?;
    main.set_focus().map_err(|err| err.to_string())?;
  }
  Ok(())
}