FROM edoburu/pgbouncer:v1.25.1-p0
COPY pgbouncer.ini.tpl /etc/pgbouncer/pgbouncer.ini.tpl
COPY userlist.txt.tpl /etc/pgbouncer/userlist.txt.tpl
COPY pgbouncer-entrypoint.sh /etc/pgbouncer/pgbouncer-entrypoint.sh
ENTRYPOINT ["sh", "/etc/pgbouncer/pgbouncer-entrypoint.sh"]