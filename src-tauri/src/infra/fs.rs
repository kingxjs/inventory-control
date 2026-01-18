use std::fs;
use std::path::{Path, PathBuf};

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
