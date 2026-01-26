#[tauri::command]
pub async fn close_splashscreen(_app: tauri::AppHandle) -> Result<(), String> {
    // Android 平台直接返回成功（不需要启动屏逻辑）
    #[cfg(target_os = "android")]
    {
        return Ok(());
    }

    // 桌面平台处理启动屏
    #[cfg(not(target_os = "android"))]
    {
        use tauri::Manager;
        
        // 关闭启动屏窗口
        if let Some(splash_window) = _app.get_webview_window("splashscreen") {
            let _ = splash_window.close();
        }
        
        // 显示并聚焦主窗口
        if let Some(main_window) = _app.get_webview_window("main") {
            let _ = main_window.center();
            let _ = main_window.show();
            let _ = main_window.set_focus();
        }
        
        Ok(())
    }
}