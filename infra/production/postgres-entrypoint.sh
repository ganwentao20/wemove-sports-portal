#!/bin/sh
set -eu
# Official postgres entrypoint initializes PGDATA and drops privileges. This
# wrapper prepares pgBackRest-owned directories without exposing its passphrase.
if [ "${1:-}" = postgres ] || [ "${1:-}" = pgbackrest ]; then
  : "${PGBACKREST_CIPHER_PASS:?Backup passphrase is required}"
  mkdir -p /var/lib/pgbackrest /var/log/pgbackrest /etc/pgbackrest
  mkdir -p /var/lib/pgbackrest-status
  chmod 755 /var/lib/pgbackrest-status
  chown postgres:postgres /var/lib/pgbackrest-status
  umask 077
  {
    printf '%s\n' '[global]' 'repo1-path=/var/lib/pgbackrest' 'repo1-retention-full=7' 'repo1-retention-diff=28' 'repo1-cipher-type=aes-256-cbc'
    printf 'repo1-cipher-pass=%s\n' "$PGBACKREST_CIPHER_PASS"
    printf '%s\n' 'start-fast=y' 'process-max=2' 'compress-type=gz' 'log-level-console=warn' 'log-level-file=info' 'archive-timeout=120'
    if [ -n "${PGBACKREST_S3_BUCKET:-}" ]; then
      : "${PGBACKREST_S3_ENDPOINT:?}" "${PGBACKREST_S3_REGION:?}" "${PGBACKREST_S3_KEY:?}" "${PGBACKREST_S3_KEY_SECRET:?}"
      printf '%s\n' 'repo2-type=s3' 'repo2-path=/wemove' 'repo2-retention-full=7' 'repo2-retention-diff=28' 'repo2-cipher-type=aes-256-cbc'
      printf 'repo2-cipher-pass=%s\nrepo2-s3-bucket=%s\nrepo2-s3-endpoint=%s\nrepo2-s3-region=%s\nrepo2-s3-key=%s\nrepo2-s3-key-secret=%s\n' "$PGBACKREST_CIPHER_PASS" "$PGBACKREST_S3_BUCKET" "$PGBACKREST_S3_ENDPOINT" "$PGBACKREST_S3_REGION" "$PGBACKREST_S3_KEY" "$PGBACKREST_S3_KEY_SECRET"
    fi
    printf '\n[wemove]\npg1-path=%s\npg1-port=5432\n' "${PGDATA:-/var/lib/postgresql/data}"
    printf 'pg1-user=%s\npg1-database=%s\n' "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-${POSTGRES_USER:-postgres}}"
  } > /etc/pgbackrest/pgbackrest.conf
  if [ "${PGBACKREST_REPOSITORY_READONLY:-false}" != true ]; then chown postgres:postgres /var/lib/pgbackrest; fi
  chown -R postgres:postgres /var/log/pgbackrest /etc/pgbackrest
  if [ "${1:-}" = pgbackrest ]; then
    mkdir -p "${PGDATA:-/var/lib/postgresql/data}"
    chown postgres:postgres "${PGDATA:-/var/lib/postgresql/data}"
    exec gosu postgres "$@"
  fi
  # During the official entrypoint's first initialization the temporary server
  # also reports ready. Require its final PID 1 before stanza initialization.
  if [ "${PGBACKREST_SKIP_INIT:-false}" != true ]; then
  (
    until [ -r "${PGDATA:-/var/lib/postgresql/data}/postmaster.pid" ] && [ "$(head -n 1 "${PGDATA:-/var/lib/postgresql/data}/postmaster.pid")" = 1 ] && pg_isready -q; do sleep 2; done
    gosu postgres pgbackrest --stanza=wemove stanza-create
    gosu postgres pgbackrest --stanza=wemove check
    touch /var/lib/pgbackrest/.stanza-ready
  ) &
  fi
fi
exec /usr/local/bin/docker-entrypoint.sh "$@"
