$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'backend\data\geoip'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$cityUrl = 'https://download.db-ip.com/free/dbip-city-lite-2026-09.mmdb.gz'
$asnUrl = 'https://download.db-ip.com/free/dbip-asn-lite-2026-09.mmdb.gz'
$cityGz = Join-Path $env:TEMP 'dbip-city-lite.mmdb.gz'
$asnGz = Join-Path $env:TEMP 'dbip-asn-lite.mmdb.gz'

Invoke-WebRequest -Uri $cityUrl -OutFile $cityGz
Invoke-WebRequest -Uri $asnUrl -OutFile $asnGz

python -c "import gzip,sys; gzip.open(sys.argv[1],'rb').read(); open(sys.argv[2],'wb').write(gzip.open(sys.argv[1],'rb').read())" $cityGz (Join-Path $dir 'dbip-city-lite.mmdb')
python -c "import gzip,sys; gzip.open(sys.argv[1],'rb').read(); open(sys.argv[2],'wb').write(gzip.open(sys.argv[1],'rb').read())" $asnGz (Join-Path $dir 'dbip-asn-lite.mmdb')

Write-Host 'DB-IP Lite City + ASN databases installed into backend/data/geoip.'
Write-Host 'DB-IP attribution is required when displaying results.'
