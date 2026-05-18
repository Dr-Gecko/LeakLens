CREATE DATABASE IF NOT EXISTS breaches;
CREATE DATABASE IF NOT EXISTS backend;

DROP USER IF EXISTS 'LeakLense'@'%';
CREATE USER 'LeakLense'@'%' IDENTIFIED BY 'changeme';

GRANT ALL PRIVILEGES ON breaches.* TO 'LeakLense'@'%';
GRANT ALL PRIVILEGES ON backend.* TO 'LeakLense'@'%';

FLUSH PRIVILEGES;

USE breaches;

CREATE TABLE IF NOT EXISTS users (
    uuid VARCHAR(255) NULL,
    name VARCHAR(255) NULL,
    address TEXT NULL,
    email TEXT NULL,
    phone TEXT NULL,
    other_tables TEXT NULL,
    breaches TEXT NULL,
    extra LONGTEXT NULL
);

CREATE TABLE IF NOT EXISTS breaches (
    name VARCHAR(255) NULL,
    threat_actor VARCHAR(255) NULL,
    date_added TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
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
