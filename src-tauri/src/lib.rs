mod models;
mod services;
pub mod commands;
mod db;

use commands::{collection, parser, request};
use sqlx::{Pool, Postgres};
use tauri::Manager;

pub struct AppState {
    pub db: Pool<Postgres>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize database synchronously in setup
            tauri::async_runtime::block_on(async {
                match db::create_pool().await {
                    Ok(pool) => {
                        // Run migrations
                        if let Err(e) = db::run_migrations(&pool).await {
                            eprintln!("Failed to run migrations: {}", e);
                        }

                        // Store pool in app state
                        app.manage(AppState { db: pool });
                        println!("✅ Database connected and migrations completed");
                    }
                    Err(e) => {
                        eprintln!("Failed to create database pool: {}", e);
                        eprintln!("Make sure PostgreSQL is running and DATABASE_URL is set");
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            request::send_request,
            request::send_multiple_requests,
            collection::create_collection_cmd,
            collection::create_folder_cmd,
            collection::save_request_cmd,
            collection::load_all_collections_cmd,
            collection::delete_collection_cmd,
            collection::delete_folder_cmd,
            collection::delete_request_cmd,
            collection::rename_request_cmd,
            collection::move_request_cmd,
            collection::rename_collection_cmd,
            collection::rename_folder_cmd,
            collection::get_or_create_history_folder_cmd,
            parser::parse_curl
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
