use crate::models::request::{ApiRequest, HttpMethod};
use std::collections::HashMap;
use uuid::Uuid;

/// Returns true for flags that consume the next token as their value.
fn is_value_flag(token: &str) -> bool {
    matches!(
        token,
        "--max-time"
            | "-m"
            | "--connect-timeout"
            | "--output"
            | "-o"
            | "--proxy"
            | "-x"
            | "--cert"
            | "--key"
            | "--cacert"
            | "--capath"
            | "--write-out"
            | "-w"
            | "--retry"
            | "--retry-delay"
            | "--retry-max-time"
            | "--resolve"
            | "--interface"
            | "--local-port"
            | "--limit-rate"
            | "--ciphers"
            | "--upload-file"
            | "-T"
            | "--form"
            | "-F"
            | "--stderr"
            | "--proto"
            | "--proto-redir"
            | "--dns-servers"
            | "--expect100-timeout"
            | "--happy-eyeballs-timeout-ms"
            | "--max-redirs"
            | "--noproxy"
            | "--range"
            | "-r"
            | "--speed-limit"
            | "-Y"
            | "--speed-time"
            | "-y"
            | "--time-cond"
            | "-z"
            | "--unix-socket"
            | "--abstract-unix-socket"
    )
}

/// Returns true for flags that stand alone (no value argument).
fn is_no_value_flag(token: &str) -> bool {
    matches!(
        token,
        "--location"
            | "-L"
            | "--location-trusted"
            | "--compressed"
            | "--silent"
            | "-s"
            | "--show-error"
            | "-S"
            | "--verbose"
            | "-v"
            | "--insecure"
            | "-k"
            | "--include"
            | "-i"
            | "--no-buffer"
            | "-N"
            | "--raw"
            | "--tr-encoding"
            | "--ssl"
            | "--ssl-reqd"
            | "--globoff"
            | "-g"
            | "--ipv4"
            | "-4"
            | "--ipv6"
            | "-6"
            | "--fail"
            | "-f"
            | "--fail-early"
            | "--path-as-is"
            | "--disable-eprt"
            | "--disable-epsv"
            | "--remote-name"
            | "-O"
            | "--remote-header-name"
            | "-J"
            | "--remote-name-all"
            | "--create-dirs"
            | "--crlf"
            | "--tcp-nodelay"
            | "--tcp-fastopen"
            | "--compressed-ssh"
            | "--anyauth"
            | "--basic"
            | "--digest"
            | "--negotiate"
            | "--ntlm"
            | "--ntlm-wb"
            | "--http0.9"
            | "--http1.0"
            | "-0"
            | "--http1.1"
            | "--http2"
            | "--http2-prior-knowledge"
            | "--http3"
            | "--progress-bar"
            | "-#"
            | "--no-keepalive"
            | "--no-sessionid"
            | "--no-alpn"
            | "--no-npn"
            | "--tlsv1"
            | "--tlsv1.0"
            | "--tlsv1.1"
            | "--tlsv1.2"
            | "--tlsv1.3"
            | "--sslv2"
            | "--sslv3"
    )
}

fn parse_method(s: &str) -> HttpMethod {
    match s.to_uppercase().as_str() {
        "GET" => HttpMethod::GET,
        "POST" => HttpMethod::POST,
        "PUT" => HttpMethod::PUT,
        "DELETE" => HttpMethod::DELETE,
        "PATCH" => HttpMethod::PATCH,
        "HEAD" => HttpMethod::HEAD,
        "OPTIONS" => HttpMethod::OPTIONS,
        _ => HttpMethod::GET,
    }
}

#[tauri::command]
pub fn parse_curl(curl_command: String) -> Result<ApiRequest, String> {
    let mut method = HttpMethod::GET;
    let mut method_explicitly_set = false;
    let mut url = String::new();
    let mut headers = HashMap::new();
    let mut body: Option<String> = None;

    // Normalize: remove line continuation backslashes (backslash + newline)
    let normalized = curl_command.replace("\\\n", " ").replace("\\\r\n", " ");

    let tokens = tokenize(&normalized)?;

    let mut i = 0;
    while i < tokens.len() {
        let token = &tokens[i];

        match token.as_str() {
            "curl" => {}
            "-X" | "--request" => {
                if i + 1 < tokens.len() {
                    method = parse_method(&tokens[i + 1]);
                    method_explicitly_set = true;
                    i += 1;
                }
            }
            "-H" | "--header" => {
                if i + 1 < tokens.len() {
                    let header = &tokens[i + 1];
                    if let Some(colon_pos) = header.find(':') {
                        let key = header[..colon_pos].trim();
                        let value = header[colon_pos + 1..].trim();
                        headers.insert(key.to_string(), value.to_string());
                    }
                    i += 1;
                }
            }
            "-b" | "--cookie" => {
                if i + 1 < tokens.len() {
                    headers.insert("Cookie".to_string(), tokens[i + 1].clone());
                    i += 1;
                }
            }
            "-d" | "--data" | "--data-raw" | "--data-binary" | "--data-urlencode"
            | "--data-ascii" | "--json" => {
                if i + 1 < tokens.len() {
                    body = Some(tokens[i + 1].clone());
                    if !method_explicitly_set {
                        method = HttpMethod::POST;
                    }
                    if token == "--json" {
                        headers
                            .entry("Content-Type".to_string())
                            .or_insert_with(|| "application/json".to_string());
                        headers
                            .entry("Accept".to_string())
                            .or_insert_with(|| "application/json".to_string());
                    }
                    i += 1;
                }
            }
            "-u" | "--user" => {
                if i + 1 < tokens.len() {
                    let auth = &tokens[i + 1];
                    let encoded = base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        auth.as_bytes(),
                    );
                    headers.insert("Authorization".to_string(), format!("Basic {}", encoded));
                    i += 1;
                }
            }
            "-A" | "--user-agent" => {
                if i + 1 < tokens.len() {
                    headers.insert("User-Agent".to_string(), tokens[i + 1].clone());
                    i += 1;
                }
            }
            "-e" | "--referer" => {
                if i + 1 < tokens.len() {
                    headers.insert("Referer".to_string(), tokens[i + 1].clone());
                    i += 1;
                }
            }
            "--url" => {
                if i + 1 < tokens.len() {
                    url = tokens[i + 1].clone();
                    i += 1;
                }
            }
            "-I" | "--head" => {
                if !method_explicitly_set {
                    method = HttpMethod::HEAD;
                    method_explicitly_set = true;
                }
            }
            _ => {
                if is_no_value_flag(token) {
                    // Skip, no value to consume
                } else if is_value_flag(token) {
                    // Skip the flag and its value
                    i += 1;
                } else if token.starts_with("http://") || token.starts_with("https://") {
                    url = token.clone();
                } else if token.starts_with("-X") && token.len() > 2 {
                    // Combined form: -XPOST, -XPUT, etc.
                    method = parse_method(&token[2..]);
                    method_explicitly_set = true;
                }
                // Ignore other unrecognized tokens
            }
        }
        i += 1;
    }

    if url.is_empty() {
        return Err("No URL found in curl command".to_string());
    }

    let (clean_url, params) = extract_query_params(&url);

    Ok(ApiRequest {
        id: Uuid::new_v4().to_string(),
        name: "Imported from cURL".to_string(),
        method: method.as_str().to_string(),
        url: clean_url,
        headers,
        body,
        params,
    })
}

/// Split a URL into its base and a HashMap of query parameters.
fn extract_query_params(url: &str) -> (String, HashMap<String, String>) {
    let mut params = HashMap::new();

    if let Some(q_pos) = url.find('?') {
        let base = url[..q_pos].to_string();
        let query = &url[q_pos + 1..];

        for pair in query.split('&') {
            if pair.is_empty() {
                continue;
            }
            if let Some(eq_pos) = pair.find('=') {
                let key = percent_decode(&pair[..eq_pos]);
                let value = percent_decode(&pair[eq_pos + 1..]);
                params.insert(key, value);
            } else {
                // Key with no value
                params.insert(percent_decode(pair), String::new());
            }
        }

        (base, params)
    } else {
        (url.to_string(), params)
    }
}

/// Minimal percent-decode: replace %XX sequences and + as space.
fn percent_decode(s: &str) -> String {
    let s = s.replace('+', " ");
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '%' {
            let h1 = chars.next();
            let h2 = chars.next();
            if let (Some(a), Some(b)) = (h1, h2) {
                if let Ok(byte) = u8::from_str_radix(&format!("{}{}", a, b), 16) {
                    result.push(byte as char);
                    continue;
                }
                // Not a valid hex pair — push literally
                result.push('%');
                result.push(a);
                result.push(b);
            } else {
                result.push('%');
            }
        } else {
            result.push(ch);
        }
    }

    result
}

/// Tokenize a curl command, respecting quoted strings.
///
/// Follows bash quoting rules:
/// - Single quotes: everything is literal, no escape sequences
/// - Double quotes: backslash escapes `"`, `\`, `$`, and `` ` ``; `\n`/`\t`/`\r` expand
/// - Unquoted: backslash escapes the next character
fn tokenize(input: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::new();
    let mut current_token = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;
    let mut chars = input.chars().peekable();
    let mut escape_next = false;

    while let Some(ch) = chars.next() {
        if escape_next {
            match ch {
                'n' if in_double_quote => current_token.push('\n'),
                't' if in_double_quote => current_token.push('\t'),
                'r' if in_double_quote => current_token.push('\r'),
                _ => current_token.push(ch),
            }
            escape_next = false;
            continue;
        }

        // Inside single quotes: everything is literal (no escapes, no special chars)
        if in_single_quote {
            if ch == '\'' {
                in_single_quote = false;
            } else {
                current_token.push(ch);
            }
            continue;
        }

        match ch {
            '\\' => {
                escape_next = true;
            }
            '\'' if !in_double_quote => {
                in_single_quote = true;
                // If we have accumulated unquoted text, push it first
                if !current_token.is_empty() {
                    tokens.push(current_token.clone());
                    current_token.clear();
                }
            }
            '"' => {
                if in_double_quote {
                    in_double_quote = false;
                } else {
                    in_double_quote = true;
                    if !current_token.is_empty() {
                        tokens.push(current_token.clone());
                        current_token.clear();
                    }
                }
            }
            ' ' | '\t' | '\n' | '\r' if !in_double_quote => {
                if !current_token.is_empty() {
                    tokens.push(current_token.clone());
                    current_token.clear();
                }
            }
            _ => {
                current_token.push(ch);
            }
        }
    }

    if !current_token.is_empty() {
        tokens.push(current_token);
    }

    if in_single_quote || in_double_quote {
        return Err("Unclosed quote in curl command".to_string());
    }

    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_query_params() {
        let curl = "curl 'https://api.example.com/search?q=hello+world&page=2&limit=10'";
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.url, "https://api.example.com/search");
        assert_eq!(result.params.get("q").unwrap(), "hello world");
        assert_eq!(result.params.get("page").unwrap(), "2");
        assert_eq!(result.params.get("limit").unwrap(), "10");
    }

    #[test]
    fn test_parse_url_no_params() {
        let curl = "curl 'https://api.example.com/users'";
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.url, "https://api.example.com/users");
        assert!(result.params.is_empty());
    }

    #[test]
    fn test_parse_percent_encoded_params() {
        let curl = "curl 'https://api.example.com/search?filter=name%3Dfoo&sort=asc'";
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.url, "https://api.example.com/search");
        assert_eq!(result.params.get("filter").unwrap(), "name=foo");
        assert_eq!(result.params.get("sort").unwrap(), "asc");
    }

    #[test]
    fn test_tokenize_simple() {
        let input = "curl http://example.com -H 'Content-Type: application/json'";
        let tokens = tokenize(input).unwrap();
        assert_eq!(tokens.len(), 4);
        assert_eq!(tokens[0], "curl");
        assert_eq!(tokens[1], "http://example.com");
        assert_eq!(tokens[2], "-H");
        assert_eq!(tokens[3], "Content-Type: application/json");
    }

    #[test]
    fn test_tokenize_with_json_data() {
        let input = r#"curl http://example.com --data-raw '{"name": "test", "value": 123}'"#;
        let tokens = tokenize(input).unwrap();
        assert_eq!(tokens.last().unwrap(), r#"{"name": "test", "value": 123}"#);
    }

    #[test]
    fn test_tokenize_with_escaped_quotes() {
        let input = r#"curl http://example.com --data-raw "{\"name\": \"test\"}""#;
        let tokens = tokenize(input).unwrap();
        assert_eq!(tokens.last().unwrap(), r#"{"name": "test"}"#);
    }

    #[test]
    fn test_parse_multiline_curl() {
        let curl = r#"curl 'https://api-test.example.com/v2/payees' \
  -H 'accept: */*' \
  -H 'authorization: Bearer token123' \
  --data-raw '{"test": "value"}'"#;

        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.url, "https://api-test.example.com/v2/payees");
        assert_eq!(result.headers.get("accept").unwrap(), "*/*");
        assert_eq!(
            result.headers.get("authorization").unwrap(),
            "Bearer token123"
        );
        assert_eq!(result.body.unwrap(), r#"{"test": "value"}"#);
        assert_eq!(result.method, "POST");
    }

    #[test]
    fn test_parse_with_cookies() {
        let curl = r#"curl 'https://example.com' -b 'session_id=abc123; user=test'"#;
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(
            result.headers.get("Cookie").unwrap(),
            "session_id=abc123; user=test"
        );
    }

    #[test]
    fn test_parse_complex_headers() {
        let curl = r#"curl 'https://example.com' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'"#;
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(
            result.headers.get("user-agent").unwrap(),
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        );
    }

    #[test]
    fn test_parse_complex_json_body() {
        let curl = r#"curl 'https://api.example.com/endpoint' \
  -H 'content-type: application/json' \
  --data-raw '{"account_number":"100000000","address":"test address","is_business":false,"postal_code":"12345","purpose":"rent"}'"#;

        let result = parse_curl(curl.to_string()).unwrap();
        let body = result.body.unwrap();
        assert!(body.contains("account_number"));
        assert!(body.contains("100000000"));
        assert!(body.contains("is_business"));
        assert!(body.contains("false"));
    }

    #[test]
    fn test_parse_real_world_example() {
        let curl = r#"curl 'https://example.com/v2/payees' \
  -H 'accept: */*' \
  -H 'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' \
  -H 'content-type: text/plain;charset=UTF-8' \
  --data-raw '{"account_number":"100000000","email":"test@example.com","is_business":false}'"#;

        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.url, "https://example.com/v2/payees");
        assert_eq!(result.method, "POST");
        assert_eq!(result.headers.get("accept").unwrap(), "*/*");
        assert!(result
            .headers
            .get("authorization")
            .unwrap()
            .starts_with("Bearer"));

        let body = result.body.unwrap();
        assert!(body.contains("account_number"));
        assert!(body.contains("is_business"));
        assert!(body.contains("false"));
    }

    #[test]
    fn test_parse_full_real_world_example() {
        let curl = r#"curl 'https://example.com/v2/payees' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb3IiOjQwMCwidWlkIjo0NjYwNSwidiI6IjF8MTMyMTM4fDQ2NjA1fF98MXwxfDF8MXw4MXwxfDB8MXxffDN8MjY0ODA0NjN8MHxmZXRjaCJ9.QHfv-_8eSO3Fm8n_KM7bcOO_lBLn8HuBC5SyCnrojNI' \
  -H 'content-type: text/plain;charset=UTF-8' \
  -b 'prism_1000306138=ce8d3479-d18d-412e-bb60-673a998f660b; intercom-device-id-jes2hif1=2a562a6c-21d7-4013-b402-7d4a87716846' \
  -H 'origin: https://example.com' \
  --data-raw '{"account_number":"100000000","address":"ansdks","bank_id":1,"bank_raw_name":"DBS","bank_swift_code":"DBSSSGSGXXX","country_code":"SG","country_id":1,"currency_code":"SGD","currency_id":1,"default_amount":1000000,"default_comments":"note","email":"khiem+international@example.com","is_business":false,"paid_currency_id":1,"postal_code":"iosda","purpose":"rent","recipient_name":"name","supporting_documents":["tenancy_agreement__1772260779__60__ZnJlZSAoMSkgKDEpICgxKS5qcGc="],"unit_number":"1","rental_due_date":1,"tenancy_expiry_date":"2026-02-26T05:00:00.000Z"}'"#;

        let result = parse_curl(curl.to_string()).unwrap();

        println!("URL: {}", result.url);
        println!("Method: {}", result.method);
        println!("Headers count: {}", result.headers.len());

        if let Some(ref body) = result.body {
            println!("Body length: {}", body.len());
            println!("Body: {}", body);

            // Verify body is not duplicated
            let expected_len = r#"{"account_number":"100000000","address":"ansdks","bank_id":1,"bank_raw_name":"DBS","bank_swift_code":"DBSSSGSGXXX","country_code":"SG","country_id":1,"currency_code":"SGD","currency_id":1,"default_amount":1000000,"default_comments":"note","email":"khiem+international@example.com","is_business":false,"paid_currency_id":1,"postal_code":"iosda","purpose":"rent","recipient_name":"name","supporting_documents":["tenancy_agreement__1772260779__60__ZnJlZSAoMSkgKDEpICgxKS5qcGc="],"unit_number":"1","rental_due_date":1,"tenancy_expiry_date":"2026-02-26T05:00:00.000Z"}"#.len();

            assert_eq!(
                body.len(),
                expected_len,
                "Body length mismatch - possible duplication"
            );
        }

        assert_eq!(result.url, "https://example.com/v2/payees");
        assert_eq!(result.method, "POST");
        assert_eq!(result.headers.get("accept").unwrap(), "*/*");
        assert_eq!(result.headers.get("Cookie").unwrap(), "prism_1000306138=ce8d3479-d18d-412e-bb60-673a998f660b; intercom-device-id-jes2hif1=2a562a6c-21d7-4013-b402-7d4a87716846");

        let body = result.body.unwrap();
        assert!(body.contains("account_number"));
        assert!(body.contains("supporting_documents"));
        assert!(body.contains("tenancy_agreement__1772260779__60__ZnJlZSAoMSkgKDEpICgxKS5qcGc="));
    }

    #[test]
    fn test_parse_location_flag_with_multiline_json_body() {
        let curl = r#"curl --location 'https://example.com/v2/payment_requests' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb3IiOjQwMCwidWlkIjo0NzI3NCwidiI6IjF8MTMxNzk1fDQ3Mjc0fF98MXwxfDF8MXwyMDF8MXwwfDF8X3wyfDMzNTIxNDg3fDB8ZmV0Y2gifQ.2uKakBTOWXMLIwrVuqb_TJZ3PXeB0ikV6E2TN65K_5M' \
--data '{
    "purpose": "rent salary invoice self_transfer salary_business insurance",
    "payees": [
        {
            "id": 0,
            "amount": 0,
            "recipient_name": "",
            "items": [
                {
                    "name": "",
                    "quantity": 0,
                    "unit_price": 0
                }
            ],
            "incentives": [
                {
                    "incentive_type_id": "",
                    "rate": 0
                }
            ]
        }
    ],
    "frequency": "weekly monthly biweekly quarterly biannually",
    "card_brand_id": 0
}'"#;

        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.url, "https://example.com/v2/payment_requests");
        assert_eq!(result.method, "POST");
        assert_eq!(
            result.headers.get("Content-Type").unwrap(),
            "application/json"
        );
        assert!(result
            .headers
            .get("Authorization")
            .unwrap()
            .starts_with("Bearer"));

        let body = result.body.unwrap();
        let parsed: serde_json::Value =
            serde_json::from_str(&body).expect("Body should be valid JSON");
        assert_eq!(
            parsed["purpose"],
            "rent salary invoice self_transfer salary_business insurance"
        );
        assert!(parsed["payees"].is_array());
        assert_eq!(parsed["payees"][0]["id"], 0);
        assert!(parsed["payees"][0]["items"].is_array());
        assert!(parsed["payees"][0]["incentives"].is_array());
        assert_eq!(parsed["card_brand_id"], 0);
    }

    #[test]
    fn test_parse_combined_method_flag() {
        let curl = "curl -XPUT 'https://example.com/resource/1' -d '{\"name\":\"updated\"}'";
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.method, "PUT");
        assert_eq!(result.url, "https://example.com/resource/1");
    }

    #[test]
    fn test_parse_head_flag() {
        let curl = "curl -I 'https://example.com'";
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.method, "HEAD");
    }

    #[test]
    fn test_parse_url_flag() {
        let curl = "curl --url 'https://example.com/api' -H 'Accept: application/json'";
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.url, "https://example.com/api");
    }

    #[test]
    fn test_parse_json_flag() {
        let curl = r#"curl 'https://example.com/api' --json '{"key":"value"}'"#;
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.method, "POST");
        assert_eq!(
            result.headers.get("Content-Type").unwrap(),
            "application/json"
        );
        assert_eq!(result.headers.get("Accept").unwrap(), "application/json");
        assert_eq!(result.body.unwrap(), r#"{"key":"value"}"#);
    }

    #[test]
    fn test_parse_skips_value_flags() {
        let curl = "curl --max-time 30 --connect-timeout 10 -o /dev/null 'https://example.com'";
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.url, "https://example.com");
    }

    #[test]
    fn test_parse_explicit_method_overrides_data_default() {
        let curl = r#"curl -X PUT 'https://example.com' -d '{"update":true}'"#;
        let result = parse_curl(curl.to_string()).unwrap();
        assert_eq!(result.method, "PUT");
    }

    #[test]
    fn test_tokenize_backslash_literal_in_single_quotes() {
        let input = r#"curl 'https://example.com' -d '{"path":"C:\\Users\\test"}'"#;
        let tokens = tokenize(input).unwrap();
        let body = tokens.last().unwrap();
        assert_eq!(body, r#"{"path":"C:\\Users\\test"}"#);
    }
}
