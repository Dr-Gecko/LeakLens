#!/bin/bash
pwd=$(pwd)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)

cat > .env <<EOF
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
EOF




mkdir "$pwd/../data" "$pwd/../data/logs"
echo "MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD"