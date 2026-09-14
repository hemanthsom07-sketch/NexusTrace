# Offline GeoIP / ASN data

NexusTrace can resolve public IPs from local MMDB files without internet access at runtime.

Supported filenames:

- `GeoLite2-City.mmdb`
- `GeoLite2-ASN.mmdb`
- `dbip-city-lite.mmdb`
- `dbip-asn-lite.mmdb`

For the free/open downloadable option used by this project, DB-IP Lite publishes monthly MMDB databases under CC BY 4.0. Attribution is required when the data is displayed. See the project download script in `scripts/download_geoip.*`.

The repository intentionally does **not** ship a third-party database binary. Download it separately and place the files in this directory. This keeps the code repository small and respects the database provider's distribution terms.

Runtime behavior:

- documentation/reserved IPs are classified locally and never geolocated
- private/LAN IPs are classified locally and never assigned public geography
- real MMDB data is preferred
- the four NexusTrace prototype profiles remain available as explicitly labeled fallback demo enrichment
