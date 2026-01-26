use tauri::Manager;

#[tauri::command]
pub async fn close_splashscreen(app: tauri::AppHandle) -> Result<(), String> {
    // Android 平台直接返回成功（不需要启动屏逻辑）
    #[cfg(target_os = "android")]
    {
        return Ok(());
    }

    // 桌面平台处理启动屏
    #[cfg(not(target_os = "android"))]
    {
        // 关闭启动屏窗口
        if let Some(splash_window) = app.get_webview_window("splashscreen") {
            // 直接关闭，忽略错误
            let _ = splash_window.close();
        }
        
        // 显示并聚焦主窗口
        if let Some(main_window) = app.get_webview_window("main") {
            // 依次执行，任何一个失败都继续下一个
            let _ = main_window.center();
            let _ = main_window.show();
            let _ = main_window.set_focus();
        }
        
        Ok(())
    }
}