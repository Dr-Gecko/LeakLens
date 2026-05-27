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