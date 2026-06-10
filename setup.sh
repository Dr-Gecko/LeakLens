#!/usr/bin/env bash
set -euo pipefail
clear
PROJECT_DIR="$(pwd)"
IP_ADDR=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1')
mkdir -p "$PROJECT_DIR/config"
mkdir -p "$PROJECT_DIR/data"

randpass() {
    openssl rand -base64 32 | tr -dc '[:alnum:]' | head -c 32
}

prompt() {
    local var="$1"
    local text="$2"
    local value=""

    while [[ -z "$value" ]]; do
        read -r -p "$text" value
    done

    printf -v "$var" '%s' "$value"
}

write_mariadb_init() {
    cat > "$PROJECT_DIR/config/mariadb-init/init.sql" <<EOF
CREATE DATABASE IF NOT EXISTS $DBBREACHDB;
CREATE DATABASE IF NOT EXISTS $DBLEAKDB;

DROP USER IF EXISTS '$DBUSR'@'%';
CREATE USER '$DBUSR'@'%' IDENTIFIED BY '$DBPASS';

GRANT ALL PRIVILEGES ON $DBBREACHDB.* TO '$DBUSR'@'%';
GRANT ALL PRIVILEGES ON $DBLEAKDB.* TO '$DBUSR'@'%';

FLUSH PRIVILEGES;

USE $DBBREACHDB;

CREATE TABLE IF NOT EXISTS breaches (
    id int NOT NULL auto_increment PRIMARY KEY,
    name VARCHAR(255) NULL,
    threat_actor VARCHAR(255) NULL,
    date_added TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    record_count int NULL,
    ingested VARCHAR(255) NULL,
    type VARCHAR(255) NULL,
    table_name VARCHAR(255) NULL,
    added_by VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS entry_notes (
    id int NOT NULL auto_increment PRIMARY KEY,
    source_table VARCHAR(255) NOT NULL,
    source_id int NOT NULL,
    note TEXT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entry (source_table, source_id)
);

CREATE TABLE IF NOT EXISTS entry_links (
    id int NOT NULL auto_increment PRIMARY KEY,
    source_table VARCHAR(255) NOT NULL,
    source_id int NOT NULL,
    target_table VARCHAR(255) NOT NULL,
    target_id int NOT NULL,
    link_type VARCHAR(100) NOT NULL DEFAULT 'related',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_source (source_table, source_id),
    INDEX idx_target (target_table, target_id)
);

USE $DBLEAKDB;

CREATE TABLE IF NOT EXISTS users (
    user_id int NOT NULL auto_increment PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    rbac_id INT NOT NULL,
    user_avatar_path VARCHAR(255),
    auth_token VARCHAR(255) NULL,
    auth_token_expire TIMESTAMP NULL DEFAULT NULL,
    last_login_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_ip VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS api_key (
    name VARCHAR(32) NOT NULL,
    uuid VARCHAR(64) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    username VARCHAR(32) NOT NULL,
    rbac_id INT NOT NULL,
    uses INT,
    auth_token VARCHAR(255) NULL,
    auth_token_expire TIMESTAMP NULL DEFAULT NULL
);
EOF
}

write_server_config() {
    cat > "$PROJECT_DIR/config/server_config.yml" <<EOF
database:
  host: $DBIP
  port: 3306
  user: $DBUSR
  password: $DBPASS
  breaches_db: $DBBREACHDB
  backend_db: $DBLEAKDB

api:
  name: LeakLens
  business_id: ${BUSINESS_ID:-notimplemented}
  location: ${LOCATION:-notimplemented}
  version: ${VERSION:-1.0.0}

  containers_to_monitor:$CONTAINERS
EOF
}

write_docker_compose() {
    if $USE_OWN_MARIADB; then
        cp "$PROJECT_DIR/config/BYODB-docker-compose.yml" "$PROJECT_DIR/docker-compose.yml"
    else
        cp "$PROJECT_DIR/config/BYODB-docker-compose.yml" "$PROJECT_DIR/docker-compose.yml"
        cat >> "$PROJECT_DIR/docker-compose.yml" <<EOF

  mariadb:
    image: mariadb:latest
    container_name: mariadb_server
    ports:
      - "3305:3306"
    environment:
      MARIADB_ROOT_PASSWORD: $MYSQL_ROOT_PASSWORD
    volumes:
      - ./data/mariadb:/var/lib/mysql
      - ./config/mariadb-init:/docker-entrypoint-initdb.d:ro
    restart: unless-stopped
EOF
    fi
}

MYSQL_ROOT_PASSWORD="$(randpass)"
MYSQL_LEAKLENS_PASSWORD="$(randpass)"
VERSION="$(cat "$PROJECT_DIR/config/.version" 2>/dev/null || echo "1.0.0")"

read -r -p "Are you using your own MariaDB (Y/N): " answer

if [[ "$answer" =~ ^([Yy]|[Yy][Ee][Ss])$ ]]; then
    USE_OWN_MARIADB=true

    prompt DBIP "MariaDB IP: "
    prompt DBUSR "MariaDB Username: "

    read -r -s -p "MariaDB Password: " DBPASS
    echo

    prompt DBBREACHDB "MariaDB breaches DB: "
    prompt DBLEAKDB "MariaDB backend DB: "

    CONTAINERS=$'\n    - nginx_server\n    - fastapi_server'
else
    USE_OWN_MARIADB=false

    mkdir -p "$PROJECT_DIR/config/mariadb-init"
    mkdir -p "$PROJECT_DIR/data/mariadb"

    DBIP="mariadb"
    DBUSR="LeakLens"
    DBPASS="$MYSQL_LEAKLENS_PASSWORD"
    DBBREACHDB="breaches"
    DBLEAKDB="backend"

    CONTAINERS=$'\n    - nginx_server\n    - fastapi_server\n    - mariadb_server'

    write_mariadb_init
fi

write_server_config
write_docker_compose

echo
echo "===================================="
echo "LeakLens Configuration Complete"
echo "===================================="
echo "Using External MariaDB: $USE_OWN_MARIADB"
echo "Database Host: $DBIP"
echo "Database User: $DBUSR"
echo "Breaches DB: $DBBREACHDB"
echo "Backend DB: $DBLEAKDB"

if ! $USE_OWN_MARIADB; then
    echo
    echo "Generated MariaDB Credentials:"
    echo "Root Password: $MYSQL_ROOT_PASSWORD"
    echo "LeakLens Password: $MYSQL_LEAKLENS_PASSWORD"
fi

echo
echo "Generated Files:"
echo "  config/server_config.yml"
echo "  docker-compose.yml"

if ! $USE_OWN_MARIADB; then
    echo "  config/mariadb-init/init.sql"
fi

echo
echo "Start services with:"
docker compose up -d
echo "then sign up"
echo "http://${IP_ADDR}/sign-up"