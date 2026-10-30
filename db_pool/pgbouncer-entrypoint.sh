#!/bin/sh
_password=$(printf '%s' "$POSTGRES_PASSWORD" | sed 's/[&]/\\&/g')
_user=$(printf '%s' "$POSTGRES_USER" | sed 's/[&]/\\&/g')

sed "s|\${DB_POOL_SIZE}|${DB_POOL_SIZE}|g; s|\${DB_POOL_MIN}|${DB_POOL_MIN}|g; s|\${DB_POOL_CLIENT_TIMEOUT}|${DB_POOL_CLIENT_TIMEOUT}|g; s|\${DB_POOL_IDLE_TIMEOUT}|${DB_POOL_IDLE_TIMEOUT}|g; s|\${DB_POOL_MAX_CLIENT_CONN}|${DB_POOL_MAX_CLIENT_CONN}|g" /etc/pgbouncer/pgbouncer.ini.tpl > /etc/pgbouncer/pgbouncer.ini
sed "s|\${POSTGRES_USER}|${_user}|g; s|\${POSTGRES_PASSWORD}|${_password}|g" /etc/pgbouncer/userlist.txt.tpl > /etc/pgbouncer/userlist.txt

exec pgbouncer /etc/pgbouncer/pgbouncer.ini