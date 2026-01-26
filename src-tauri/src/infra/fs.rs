use std::fs;
use std::path::{Path, PathBuf};

#[cfg(not(target_os = "android"))]
use std::process::Command;

use crate::domain::errors::{AppError, ErrorCode};

pub fn ensure_dir(path: &Path) -> Result<(), AppError> {
  fs::create_dir_all(path).map_err(|_| AppError::new(ErrorCode::IoError, "创建目录失败"))?;
  Ok(())
}

pub fn is_dir_writable(path: &Path) -> Result<bool, AppError> {
  if !path.exists() {
    return Ok(false);
  }
  if !path.is_dir() {
    return Ok(false);
  }

  let test_file = path.join(".write_test");
  match fs::write(&test_file, b"test") {
    Ok(_) => {
      let _ = fs::remove_file(test_file);
      Ok(true)
    }
    Err(_) => Ok(false),
  }
}

pub fn move_or_copy_dir(src: &Path, dest: &Path) -> Result<(), AppError> {
  if let Ok(()) = fs::rename(src, dest) {
    return Ok(());
  }

  copy_dir_recursive(src, dest)?;
  remove_dir_recursive(src)?;
  Ok(())
}

pub fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), AppError> {
  ensure_dir(dest)?;
  for entry in fs::read_dir(src).map_err(|_| AppError::new(ErrorCode::IoError, "读取目录失败"))? {
    let entry = entry.map_err(|_| AppError::new(ErrorCode::IoError, "读取目录失败"))?;
    let path = entry.path();
    let target = dest.join(entry.file_name());
    if path.is_dir() {
      copy_dir_recursive(&path, &target)?;
    } else {
      fs::copy(&path, &target).map_err(|_| AppError::new(ErrorCode::IoError, "复制文件失败"))?;
    }
  }
  Ok(())
}

pub fn remove_dir_recursive(path: &Path) -> Result<(), AppError> {
  if !path.exists() {
    return Ok(());
  }
  fs::remove_dir_all(path).map_err(|_| AppError::new(ErrorCode::IoError, "删除目录失败"))?;
  Ok(())
}

pub fn normalize_path(path: &str) -> Result<PathBuf, AppError> {
  let path = PathBuf::from(path);
  if !path.is_absolute() {
    return Err(AppError::new(ErrorCode::ValidationError, "路径必须为绝对路径"));
  }
  Ok(path)
}

pub fn ensure_dir_ready(path: &Path) -> Result<(), AppError> {
  if !path.exists() {
    ensure_dir(path)?;
  }
  if !path.is_dir() {
    return Err(AppError::new(ErrorCode::ValidationError, "目标路径不是目录"));
  }
  Ok(())
}

pub fn ensure_dir_empty_or_allowed(path: &Path, allowed: &[&str]) -> Result<(), AppError> {
  let entries = fs::read_dir(path).map_err(|_| AppError::new(ErrorCode::IoError, "读取目录失败"))?;
  for entry in entries {
    let entry = entry.map_err(|_| AppError::new(ErrorCode::IoError, "读取目录失败"))?;
    let name = entry.file_name();
    let name = name.to_string_lossy();
    if !allowed.iter().any(|item| *item == name) {
      return Err(AppError::new(
        ErrorCode::ValidationError,
        "目标目录非空且包含非受控内容",
      ));
    }
  }
  Ok(())
}

pub fn ensure_not_sensitive_dir(path: &Path) -> Result<(), AppError> {
  if is_sensitive_dir(path) {
    return Err(AppError::new(
      ErrorCode::ValidationError,
      "目标目录属于系统敏感路径",
    ));
  }
  Ok(())
}

fn is_sensitive_dir(path: &Path) -> bool {
  if path.parent().is_none() {
    return true;
  }
  let raw = path.to_string_lossy().to_lowercase();
  if raw.ends_with(":\\") {
    return true;
  }
  let forbidden = [
    "/system",
    "/windows",
    "/applications",
    "/library",
    "/usr",
    "/bin",
    "/etc",
    "/var",
    "c:\\windows",
    "c:\\program files",
    "c:\\program files (x86)",
  ];
  forbidden.iter().any(|prefix| {
    raw == *prefix
      || raw.starts_with(&format!("{}/", prefix))
      || raw.starts_with(&format!("{}\\", prefix))
  })
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    // 验证路径存在
    if !Path::new(&path).exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    // 验证是目录
    if !Path::new(&path).is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

// 新增：打开文件夹并选中文件
#[tauri::command]
pub fn reveal_in_folder(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    
    // 验证路径存在
    if !path.exists() {
        return Err(format!("Path does not exist: {}", file_path));
    }

    #[cfg(target_os = "windows")]
    {
        // 使用 /select 参数选中文件
        Command::new("explorer")
            .args(&["/select,", &file_path])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        // 使用 -R 参数在 Finder 中显示并选中文件
        Command::new("open")
            .args(&["-R", &file_path])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Linux 上不同文件管理器支持不同，这里尝试几种常见的
        // 先尝试使用 dbus 调用文件管理器
        let result = Command::new("dbus-send")
            .args(&[
                "--session",
                "--dest=org.freedesktop.FileManager1",
                "--type=method_call",
                "/org/freedesktop/FileManager1",
                "org.freedesktop.FileManager1.ShowItems",
                &format!("array:string:file://{}", file_path),
                "string:",
            ])
            .spawn();

        if result.is_err() {
            // 如果 dbus 失败，回退到打开父文件夹
            if let Some(parent) = path.parent() {
                Command::new("xdg-open")
                    .arg(parent)
                    .spawn()
                    .map_err(|e| format!("Failed to open parent folder: {}", e))?;
            } else {
                return Err("Cannot determine parent folder".to_string());
            }
        }
    }

    Ok(())
}