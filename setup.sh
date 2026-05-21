#!/bin/bash
pwd=$(pwd)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
cat > web_data/backend/server/server_config.yml <<EOF
database:
  host: mariadb
  port: 3305
  user: LeakLense
  password: changeme
  breaches_db: breaches
  backend_db: backend
api:
  name: LeakLense
  business_id: test
  location: test
EOF

cat > Dockerfiles/.env <<EOF
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
EOF

echo "http://localhost/sign-up"