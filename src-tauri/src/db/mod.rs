use sqlx::{Pool, Postgres, postgres::PgPoolOptions};
use std::env;

pub mod schema;

pub async fn create_pool() -> Result<Pool<Postgres>, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://kurl:kurl@localhost:5444/kurl".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    Ok(pool)
}

pub async fn run_migrations(pool: &Pool<Postgres>) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS collections (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS folders (
            id UUID PRIMARY KEY,
            collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS requests (
            id UUID PRIMARY KEY,
            folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            method VARCHAR(10) NOT NULL,
            url TEXT NOT NULL,
            headers JSONB NOT NULL DEFAULT '{}',
            body TEXT,
            params JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;

    // Create indexes for better query performance
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_folders_collection_id ON folders(collection_id)
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_requests_folder_id ON requests(folder_id)
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}
