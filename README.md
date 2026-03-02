# kurl

A lightweight desktop REST API testing tool built with Tauri 2 and Rust.

## Requirements

Before installing, make sure you have the following installed on your system:

- **Rust** (stable) — [https://rustup.rs](https://rustup.rs)
- **Docker** & **Docker Compose** — required for the PostgreSQL database
- **Tauri 2 CLI** — install via Cargo:
  ```bash
  cargo install tauri-cli --version "^2"
  ```
- **System dependencies** (platform-specific):
  - **macOS**: Xcode Command Line Tools
    ```bash
    xcode-select --install
    ```
  - **Linux**: WebKitGTK and development libraries
    ```bash
    # Debian/Ubuntu
    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

    # Fedora
    sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel

    # Arch
    sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg
    ```
  - **Windows**: Microsoft Visual Studio C++ Build Tools & WebView2

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/vokhiem/kurl.git
cd kurl
```

### 2. Set up the database

Start the PostgreSQL database using Docker Compose:

```bash
chmod +x setup-db.sh
./setup-db.sh
```

This starts a PostgreSQL 15 container with the following connection details:

| Setting  | Value                                      |
|----------|--------------------------------------------|
| Host     | localhost                                  |
| Port     | 5444                                       |
| Database | kurl                                       |
| User     | kurl                                       |
| Password | kurl                                       |
| URL      | `postgres://kurl:kurl@localhost:5444/kurl`  |

### 3. Build and run

```bash
cargo tauri dev
```

To create a production build:

```bash
cargo tauri build
```

The bundled application will be output to `src-tauri/target/release/bundle/`.

## Tech Stack

- **Backend**: Rust, Tauri 2, reqwest, sqlx (PostgreSQL)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Database**: PostgreSQL 15 (via Docker)
