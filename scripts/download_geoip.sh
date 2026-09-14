#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/backend/data/geoip"
mkdir -p "$DIR"

CITY_URL='https://download.db-ip.com/free/dbip-city-lite-2026-09.mmdb.gz'
ASN_URL='https://download.db-ip.com/free/dbip-asn-lite-2026-09.mmdb.gz'

curl -L --fail "$CITY_URL" | gzip -dc > "$DIR/dbip-city-lite.mmdb"
curl -L --fail "$ASN_URL" | gzip -dc > "$DIR/dbip-asn-lite.mmdb"

echo 'DB-IP Lite City + ASN databases installed into backend/data/geoip.'
echo 'DB-IP attribution is required when displaying results.'
