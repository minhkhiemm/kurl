use sqlx::{FromRow, Pool, Postgres};
use uuid::Uuid;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::models::{collection::{Collection, Folder}, request::ApiRequest};

#[derive(Debug, FromRow)]
pub struct DbCollection {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, FromRow)]
pub struct DbFolder {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, FromRow)]
pub struct DbRequest {
    pub id: Uuid,
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: JsonValue,
    pub body: Option<String>,
    pub params: JsonValue,
}

impl DbRequest {
    pub fn to_api_request(&self) -> Result<ApiRequest, serde_json::Error> {
        let headers: HashMap<String, String> = serde_json::from_value(self.headers.clone())?;
        let params: HashMap<String, String> = serde_json::from_value(self.params.clone())?;

        Ok(ApiRequest {
            id: self.id.to_string(),
            name: self.name.clone(),
            method: self.method.clone(),
            url: self.url.clone(),
            headers,
            body: self.body.clone(),
            params,
        })
    }
}

// Database operations
pub async fn create_collection(
    pool: &Pool<Postgres>,
    name: &str,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO collections (id, name) VALUES ($1, $2)"
    )
    .bind(id)
    .bind(name)
    .execute(pool)
    .await?;

    Ok(id)
}

pub async fn get_all_collections(
    pool: &Pool<Postgres>,
) -> Result<Vec<Collection>, sqlx::Error> {
    let db_collections = sqlx::query_as::<_, DbCollection>(
        "SELECT id, name FROM collections ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await?;

    let mut collections = Vec::new();

    for db_col in db_collections {
        let folders = get_folders_by_collection(pool, db_col.id).await?;

        collections.push(Collection {
            id: db_col.id.to_string(),
            name: db_col.name,
            folders,
        });
    }

    Ok(collections)
}

pub async fn get_folders_by_collection(
    pool: &Pool<Postgres>,
    collection_id: Uuid,
) -> Result<Vec<Folder>, sqlx::Error> {
    let db_folders = sqlx::query_as::<_, DbFolder>(
        "SELECT id, name FROM folders WHERE collection_id = $1 ORDER BY created_at ASC"
    )
    .bind(collection_id)
    .fetch_all(pool)
    .await?;

    let mut folders = Vec::new();

    for db_folder in db_folders {
        let requests = get_requests_by_folder(pool, db_folder.id).await?;

        folders.push(Folder {
            id: db_folder.id.to_string(),
            name: db_folder.name,
            requests,
        });
    }

    Ok(folders)
}

pub async fn get_requests_by_folder(
    pool: &Pool<Postgres>,
    folder_id: Uuid,
) -> Result<Vec<ApiRequest>, sqlx::Error> {
    let db_requests = sqlx::query_as::<_, DbRequest>(
        "SELECT id, name, method, url, headers, body, params FROM requests WHERE folder_id = $1 ORDER BY created_at ASC"
    )
    .bind(folder_id)
    .fetch_all(pool)
    .await?;

    let mut requests = Vec::new();
    for db_req in db_requests {
        if let Ok(api_req) = db_req.to_api_request() {
            requests.push(api_req);
        }
    }

    Ok(requests)
}

pub async fn create_folder(
    pool: &Pool<Postgres>,
    collection_id: Uuid,
    name: &str,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO folders (id, collection_id, name) VALUES ($1, $2, $3)"
    )
    .bind(id)
    .bind(collection_id)
    .bind(name)
    .execute(pool)
    .await?;

    Ok(id)
}

pub async fn save_request(
    pool: &Pool<Postgres>,
    folder_id: Uuid,
    request: &ApiRequest,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::parse_str(&request.id)
        .unwrap_or_else(|_| Uuid::new_v4());

    let headers_json = serde_json::to_value(&request.headers)
        .unwrap_or(JsonValue::Object(Default::default()));

    let params_json = serde_json::to_value(&request.params)
        .unwrap_or(JsonValue::Object(Default::default()));

    // Check if request already exists
    let existing = sqlx::query_as::<_, (Uuid,)>(
        "SELECT id FROM requests WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    if existing.is_some() {
        // Update existing request
        sqlx::query(
            r#"
            UPDATE requests
            SET name = $1, method = $2, url = $3, headers = $4, body = $5, params = $6, updated_at = NOW()
            WHERE id = $7
            "#
        )
        .bind(&request.name)
        .bind(&request.method)
        .bind(&request.url)
        .bind(headers_json)
        .bind(&request.body)
        .bind(params_json)
        .bind(id)
        .execute(pool)
        .await?;
    } else {
        // Insert new request
        sqlx::query(
            r#"
            INSERT INTO requests (id, folder_id, name, method, url, headers, body, params)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#
        )
        .bind(id)
        .bind(folder_id)
        .bind(&request.name)
        .bind(&request.method)
        .bind(&request.url)
        .bind(headers_json)
        .bind(&request.body)
        .bind(params_json)
        .execute(pool)
        .await?;
    }

    Ok(id)
}

pub async fn delete_collection(
    pool: &Pool<Postgres>,
    collection_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM collections WHERE id = $1")
        .bind(collection_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn delete_folder(
    pool: &Pool<Postgres>,
    folder_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM folders WHERE id = $1")
        .bind(folder_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn delete_request(
    pool: &Pool<Postgres>,
    request_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM requests WHERE id = $1")
        .bind(request_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn rename_request(
    pool: &Pool<Postgres>,
    request_id: Uuid,
    new_name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE requests SET name = $2, updated_at = NOW() WHERE id = $1")
        .bind(request_id)
        .bind(new_name)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn move_request(
    pool: &Pool<Postgres>,
    request_id: Uuid,
    new_folder_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE requests SET folder_id = $2, updated_at = NOW() WHERE id = $1")
        .bind(request_id)
        .bind(new_folder_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn rename_collection(
    pool: &Pool<Postgres>,
    collection_id: Uuid,
    new_name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE collections SET name = $2, updated_at = NOW() WHERE id = $1")
        .bind(collection_id)
        .bind(new_name)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn rename_folder(
    pool: &Pool<Postgres>,
    folder_id: Uuid,
    new_name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE folders SET name = $2, updated_at = NOW() WHERE id = $1")
        .bind(folder_id)
        .bind(new_name)
        .execute(pool)
        .await?;

    Ok(())
}
