[databases]
pocket_advisory = host=db port=5432 dbname=pocket_advisory

[pgbouncer]
listen_port = 5432
listen_addr = 0.0.0.0
auth_type = plain
auth_file = /etc/pgbouncer/userlist.txt
admin_users = pocket_user
server_reset_query = DISCARD ALL
max_client_conn = ${DB_POOL_MAX_CLIENT_CONN}
default_pool_size = ${DB_POOL_SIZE}
min_pool_size = ${DB_POOL_MIN}
server_idle_timeout = ${DB_POOL_IDLE_TIMEOUT}
log_connections = 1
log_disconnections = 1
