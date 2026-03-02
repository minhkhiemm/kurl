use crate::models::{request::ApiRequest, response::ApiResponse};
use crate::services::http_client;

#[tauri::command]
pub async fn send_request(request: ApiRequest) -> Result<ApiResponse, String> {
    http_client::send_http_request(request).await
}

#[tauri::command]
pub async fn send_multiple_requests(
    requests: Vec<ApiRequest>,
    delay_ms: u64,
) -> Result<Vec<ApiResponse>, String> {
    let mut responses = Vec::new();
    let total = requests.len();

    for (i, request) in requests.into_iter().enumerate() {
        let response = http_client::send_http_request(request).await?;
        responses.push(response);

        if i < total - 1 {
            tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
        }
    }

    Ok(responses)
}