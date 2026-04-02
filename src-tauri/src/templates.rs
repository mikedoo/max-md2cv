use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::Manager;

#[derive(Serialize, Clone)]
pub struct TemplateInfo {
    pub id: String,
    pub name: String,
    pub css: String,
}

/// Scan built-in resource templates and user-custom templates from appDataDir.
/// User templates take precedence over built-ins with the same id.
#[tauri::command]
pub async fn list_templates(app: tauri::AppHandle) -> Result<Vec<TemplateInfo>, String> {
    let mut templates: Vec<TemplateInfo> = Vec::new();

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    let builtin_path = resource_dir.join("templates");
    if builtin_path.exists() {
        load_templates_from_dir(&builtin_path, &mut templates)?;
    }

    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let dev_source_path = Path::new(&manifest_dir)
            .parent()
            .map(|root| root.join("src").join("assets").join("templates"));
        if let Some(dev_path) = dev_source_path {
            if dev_path.exists() {
                load_templates_overriding(&dev_path, &mut templates)?;
            }
        }
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let user_path = app_data_dir.join("templates");
    if !user_path.exists() {
        let _ = fs::create_dir_all(&user_path);
    }
    if user_path.exists() {
        load_templates_overriding(&user_path, &mut templates)?;
    }

    Ok(templates)
}

/// Write (or overwrite) a template CSS file in the user's AppData/templates directory.
#[tauri::command]
pub async fn save_template(
    app: tauri::AppHandle,
    id: String,
    css: String,
) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let user_path = app_data_dir.join("templates");
    if !user_path.exists() {
        fs::create_dir_all(&user_path)
            .map_err(|e| format!("Failed to create templates dir: {}", e))?;
    }
    let file_path = user_path.join(format!("{}.css", id));
    fs::write(&file_path, &css)
        .map_err(|e| format!("Failed to write template {:?}: {}", file_path, e))?;
    Ok(())
}

fn load_templates_from_dir(dir: &Path, templates: &mut Vec<TemplateInfo>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read dir {:?}: {}", dir, e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("css") {
            let css_content =
                fs::read_to_string(&path).map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
            let name = extract_meta(&css_content, "name").unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            });
            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();
            if !templates.iter().any(|template| template.id == id) {
                templates.push(TemplateInfo {
                    id,
                    name,
                    css: css_content,
                });
            }
        }
    }
    Ok(())
}

/// Same as `load_templates_from_dir` but user entries *replace* any existing entry with the same id.
fn load_templates_overriding(
    dir: &Path,
    templates: &mut Vec<TemplateInfo>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read dir {:?}: {}", dir, e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("css") {
            let css_content =
                fs::read_to_string(&path).map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
            let name = extract_meta(&css_content, "name").unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            });
            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();
            templates.retain(|template| template.id != id);
            templates.push(TemplateInfo {
                id,
                name,
                css: css_content,
            });
        }
    }
    Ok(())
}

/// Parse `/* @key: value */` style metadata from CSS content.
fn extract_meta(css: &str, key: &str) -> Option<String> {
    let pattern = format!("@{}:", key);
    for line in css.lines() {
        let trimmed = line.trim();
        if let Some(pos) = trimmed.find(&pattern) {
            let after = &trimmed[pos + pattern.len()..];
            let value = after.replace("*/", "").trim().to_string();
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}
