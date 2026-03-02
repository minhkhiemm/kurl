use crate::models::{request::ApiRequest, response::ApiResponse};
use reqwest;
use std::time::Instant;

pub async fn send_http_request(request: ApiRequest) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    let start = Instant::now();

    let mut req_builder = match request.method.as_str() {
        "GET" => client.get(request.url),
        "POST" => client.post(request.url),
        "PUT" => client.put(request.url),
        "DELETE" => client.delete(request.url),
        "PATCH" => client.patch(request.url),
        "HEAD" => client.head(request.url),
        "OPTIONS" => client.request(reqwest::Method::OPTIONS, request.url),
        _ => return Err("Unsupported method".to_string())
    };

    for (key, value) in request.headers {
        req_builder = req_builder.header(&key, &value);
    }
    
    if let Some(body) = request.body {
        req_builder = req_builder.body(body);
    }
    
    if !request.params.is_empty() {
        req_builder = req_builder.query(&request.params);
    }
    
    match req_builder.send().await {
        Ok(response) => {
            let duration = start.elapsed().as_millis();
            let status_code = response.status().as_u16();
            let status_text = response.status().to_string();
            
            let headers = response
                .headers()
                .iter()
                .map(|(key, value)| (key.to_string(), value.to_str().unwrap_or("").to_string()))
                .collect();
            
            let body = response.text().await.unwrap_or_default();
            
            Ok(ApiResponse { duration_ms: duration, status_code, status_text, headers, body })
            
        },
        Err(err) => Err(format!("Error sending request: {}", err))
    }
}