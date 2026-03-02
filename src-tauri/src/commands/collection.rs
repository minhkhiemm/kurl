use crate::models::collection::Collection;
use crate::models::request::ApiRequest;
use crate::db::schema;
use crate::AppState;
use tauri::State;
use uuid::Uuid;
use chrono::Local;

#[tauri::command]
pub async fn create_collection_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<String, String> {
    let collection_id = schema::create_collection(&state.db, &name)
        .await
        .map_err(|e| format!("Failed to create collection: {}", e))?;

    Ok(collection_id.to_string())
}

#[tauri::command]
pub async fn create_folder_cmd(
    state: State<'_, AppState>,
    collection_id: String,
    name: String,
) -> Result<String, String> {
    let col_uuid = Uuid::parse_str(&collection_id)
        .map_err(|e| format!("Invalid collection ID: {}", e))?;

    let folder_id = schema::create_folder(&state.db, col_uuid, &name)
        .await
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    Ok(folder_id.to_string())
}

#[tauri::command]
pub async fn save_request_cmd(
    state: State<'_, AppState>,
    folder_id: String,
    request: ApiRequest,
) -> Result<String, String> {
    let fol_uuid = Uuid::parse_str(&folder_id)
        .map_err(|e| format!("Invalid folder ID: {}", e))?;

    let request_id = schema::save_request(&state.db, fol_uuid, &request)
        .await
        .map_err(|e| format!("Failed to save request: {}", e))?;

    Ok(request_id.to_string())
}

#[tauri::command]
pub async fn load_all_collections_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<Collection>, String> {
    schema::get_all_collections(&state.db)
        .await
        .map_err(|e| format!("Failed to load collections: {}", e))
}

#[tauri::command]
pub async fn delete_collection_cmd(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<(), String> {
    let col_uuid = Uuid::parse_str(&collection_id)
        .map_err(|e| format!("Invalid collection ID: {}", e))?;

    schema::delete_collection(&state.db, col_uuid)
        .await
        .map_err(|e| format!("Failed to delete collection: {}", e))
}

#[tauri::command]
pub async fn delete_folder_cmd(
    state: State<'_, AppState>,
    folder_id: String,
) -> Result<(), String> {
    let fol_uuid = Uuid::parse_str(&folder_id)
        .map_err(|e| format!("Invalid folder ID: {}", e))?;

    schema::delete_folder(&state.db, fol_uuid)
        .await
        .map_err(|e| format!("Failed to delete folder: {}", e))
}

/// Finds or creates a "History" collection with a folder named after today's date,
/// and returns the folder ID. Used by the Cmd+S quick-save shortcut.
#[tauri::command]
pub async fn get_or_create_history_folder_cmd(
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Find or create the "History" collection
    let collections = schema::get_all_collections(&state.db)
        .await
        .map_err(|e| format!("Failed to load collections: {}", e))?;

    let collection_id = match collections.iter().find(|c| c.name == "History") {
        Some(col) => Uuid::parse_str(&col.id).map_err(|e| e.to_string())?,
        None => schema::create_collection(&state.db, "History")
            .await
            .map_err(|e| format!("Failed to create History collection: {}", e))?,
    };

    // Find or create a folder named after today's date (YYYY-MM-DD)
    let today = Local::now().format("%Y-%m-%d").to_string();
    let folders = schema::get_folders_by_collection(&state.db, collection_id)
        .await
        .map_err(|e| format!("Failed to load folders: {}", e))?;

    let folder_id = match folders.iter().find(|f| f.name == today) {
        Some(folder) => Uuid::parse_str(&folder.id).map_err(|e| e.to_string())?,
        None => schema::create_folder(&state.db, collection_id, &today)
            .await
            .map_err(|e| format!("Failed to create today's folder: {}", e))?,
    };

    Ok(folder_id.to_string())
}

#[tauri::command]
pub async fn delete_request_cmd(
    state: State<'_, AppState>,
    request_id: String,
) -> Result<(), String> {
    let req_uuid = Uuid::parse_str(&request_id)
        .map_err(|e| format!("Invalid request ID: {}", e))?;

    schema::delete_request(&state.db, req_uuid)
        .await
        .map_err(|e| format!("Failed to delete request: {}", e))
}

#[tauri::command]
pub async fn rename_request_cmd(
    state: State<'_, AppState>,
    request_id: String,
    new_name: String,
) -> Result<(), String> {
    let req_uuid = Uuid::parse_str(&request_id)
        .map_err(|e| format!("Invalid request ID: {}", e))?;

    schema::rename_request(&state.db, req_uuid, &new_name)
        .await
        .map_err(|e| format!("Failed to rename request: {}", e))
}

#[tauri::command]
pub async fn move_request_cmd(
    state: State<'_, AppState>,
    request_id: String,
    new_folder_id: String,
) -> Result<(), String> {
    let req_uuid = Uuid::parse_str(&request_id)
        .map_err(|e| format!("Invalid request ID: {}", e))?;
    let folder_uuid = Uuid::parse_str(&new_folder_id)
        .map_err(|e| format!("Invalid folder ID: {}", e))?;

    schema::move_request(&state.db, req_uuid, folder_uuid)
        .await
        .map_err(|e| format!("Failed to move request: {}", e))
}

#[tauri::command]
pub async fn rename_collection_cmd(
    state: State<'_, AppState>,
    collection_id: String,
    new_name: String,
) -> Result<(), String> {
    let col_uuid = Uuid::parse_str(&collection_id)
        .map_err(|e| format!("Invalid collection ID: {}", e))?;

    schema::rename_collection(&state.db, col_uuid, &new_name)
        .await
        .map_err(|e| format!("Failed to rename collection: {}", e))
}

#[tauri::command]
pub async fn rename_folder_cmd(
    state: State<'_, AppState>,
    folder_id: String,
    new_name: String,
) -> Result<(), String> {
    let fol_uuid = Uuid::parse_str(&folder_id)
        .map_err(|e| format!("Invalid folder ID: {}", e))?;

    schema::rename_folder(&state.db, fol_uuid, &new_name)
        .await
        .map_err(|e| format!("Failed to rename folder: {}", e))
}
