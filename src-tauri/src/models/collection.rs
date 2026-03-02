use serde::{Deserialize, Serialize};
use super::request::ApiRequest;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub folders: Vec<Folder>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub requests: Vec<ApiRequest>,
}