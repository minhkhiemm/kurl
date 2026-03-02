use kurl_lib::commands::parser::parse_curl;

#[test]
fn test_real_world_curl() {
    let curl = r#"curl 'https://api-test.ipaymy.com/v2/payees' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb3IiOjQwMCwidWlkIjo0NjYwNSwidiI6IjF8MTMyMTM4fDQ2NjA1fF98MXwxfDF8MXw4MXwxfDB8MXxffDN8MjY0ODA0NjN8MHxmZXRjaCJ9.QHfv-_8eSO3Fm8n_KM7bcOO_lBLn8HuBC5SyCnrojNI' \
  -H 'content-type: text/plain;charset=UTF-8' \
  -b 'prism_1000306138=ce8d3479-d18d-412e-bb60-673a998f660b; intercom-device-id-jes2hif1=2a562a6c-21d7-4013-b402-7d4a87716846' \
  -H 'origin: https://handshake-test.ipaymy.com' \
  --data-raw '{"account_number":"100000000","address":"ansdks","bank_id":1,"bank_raw_name":"DBS","bank_swift_code":"DBSSSGSGXXX","country_code":"SG","country_id":1,"currency_code":"SGD","currency_id":1,"default_amount":1000000,"default_comments":"note","email":"khiem+international@ipaymy.com","is_business":false,"paid_currency_id":1,"postal_code":"iosda","purpose":"rent","recipient_name":"name","supporting_documents":["tenancy_agreement__1772260779__60__ZnJlZSAoMSkgKDEpICgxKS5qcGc="],"unit_number":"1","rental_due_date":1,"tenancy_expiry_date":"2026-02-26T05:00:00.000Z"}'"#;

    let result = parse_curl(curl.to_string()).unwrap();

    println!("URL: {}", result.url);
    println!("Method: {}", result.method);
    println!("Headers: {:#?}", result.headers);
    println!("Body length: {:?}", result.body.as_ref().map(|b| b.len()));
    if let Some(body) = &result.body {
        println!("Body: {}", body);

        // Check if body is duplicated
        let half_len = body.len() / 2;
        if body.len() > 0 && body.len() % 2 == 0 {
            let first_half = &body[0..half_len];
            let second_half = &body[half_len..];
            if first_half == second_half {
                panic!("Body is duplicated!");
            }
        }
    }

    assert_eq!(result.url, "https://api-test.ipaymy.com/v2/payees");
    assert_eq!(result.method, "POST");
}
