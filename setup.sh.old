#!/bin/bash
pwd=$(pwd)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -dc '[:alnum:]\n\r')
MYSQL_LEAKLENS_PASSWORD=$(openssl rand -base64 32 | tr -dc '[:alnum:]\n\r')
VERSION = $(cat .version)
cat > web_data/backend/server/server_config.yml <<EOF
database:
  host: mariadb
  port: 3306
  user: LeakLens
  password: changeme
  breaches_db: breaches
  backend_db: backend
api:
  name: LeakLens
  business_id: test
  location: test
  version: $VERSION
  containers_to_monitor:
  - nginx_server
  - fastapi_server
  - mariadb_server
EOF
mkdir $pwd/Dockerfiles/mariadb-init/
cat > $pwd/Dockerfiles/mariadb-init/init.sql <<EOF
CREATE DATABASE IF NOT EXISTS breaches;
CREATE DATABASE IF NOT EXISTS backend;

DROP USER IF EXISTS 'LeakLens'@'%';
CREATE USER 'LeakLens'@'%' IDENTIFIED BY 'changeme';

GRANT ALL PRIVILEGES ON breaches.* TO 'LeakLens'@'%';
GRANT ALL PRIVILEGES ON backend.* TO 'LeakLens'@'%';

FLUSH PRIVILEGES;

USE breaches;

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

USE backend;

CREATE TABLE users (
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

CREATE TABLE api_key (
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
cat > $pwd/Dockerfiles/.env <<EOF
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
EOF
cd Dockerfiles
docker compose up -d