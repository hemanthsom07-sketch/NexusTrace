"""
geoip/lookup.py -- Phase 9.1 (P1 -- useful if time permits, not required
for the core demo).

Looks up country/ASN for an IP using a local MaxMind GeoLite2 .mmdb file.
Degrades gracefully to (None, None) if the geoip2 library or the .mmdb
file isn't present -- this is a P1 feature, it should never crash the
rest of the pipeline if it's missing.

To enable this for real:
  1. pip install geoip2
  2. Download GeoLite2-City.mmdb (free, requires a MaxMind account) and
     place it at backend/data/geoip/GeoLite2-City.mmdb
  3. Optionally do the same for GeoLite2-ASN.mmdb for ASN lookups
"""
import os
import logging
from app.config import GEOIP_DIR

logger = logging.getLogger("nexustrace.geoip")

_CITY_DB_PATH = os.path.join(GEOIP_DIR, "GeoLite2-City.mmdb")
_ASN_DB_PATH = os.path.join(GEOIP_DIR, "GeoLite2-ASN.mmdb")

_city_reader = None
_asn_reader = None
_geoip_available = False

try:
    import geoip2.database  # type: ignore

    if os.path.exists(_CITY_DB_PATH):
        _city_reader = geoip2.database.Reader(_CITY_DB_PATH)
        _geoip_available = True
    if os.path.exists(_ASN_DB_PATH):
        _asn_reader = geoip2.database.Reader(_ASN_DB_PATH)
except ImportError:
    logger.info("geoip2 not installed -- GeoIP enrichment disabled (this is fine, it's P1)")
except Exception as e:
    logger.warning("GeoIP setup failed (%s) -- enrichment disabled", e)


import ipaddress

def lookup_ip(ip: str) -> dict:
    """
    Returns enriched IP intelligence dictionary.
    Never raises -- handles private/reserved IPs cleanly.
    """
    clean_ip = (ip or "").strip()
    result = {
        "ip": clean_ip,
        "country": None,
        "city": None,
        "asn": None,
        "org": None,
        "is_private": False,
        "network_type": "Public IP",
        "available": _geoip_available,
        "status": "GeoIP data unavailable" if not _geoip_available else "Resolved",
    }

    if not clean_ip:
        return result

    try:
        ip_obj = ipaddress.ip_address(clean_ip)
        result["is_private"] = ip_obj.is_private
        if ip_obj.is_private:
            result["network_type"] = "Private / RFC 1918 Subnet"
            result["status"] = "Internal Network"
            result["country"] = "LAN"
        elif ip_obj.is_loopback:
            result["network_type"] = "Loopback"
            result["status"] = "Localhost"
            result["country"] = "LAN"
        elif ip_obj.is_reserved:
            result["network_type"] = "Reserved / Special Purpose"
            result["status"] = "Reserved Network"
        else:
            result["network_type"] = "Public Routable Node"
    except Exception:
        result["network_type"] = "Unparseable IP"

    if not _geoip_available or result["is_private"]:
        return result

    try:
        if _city_reader:
            resp = _city_reader.city(clean_ip)
            result["country"] = resp.country.iso_code
            result["city"] = resp.city.name
    except Exception:
        pass

    try:
        if _asn_reader:
            resp = _asn_reader.asn(clean_ip)
            result["asn"] = f"AS{resp.autonomous_system_number}"
            result["org"] = resp.autonomous_system_organization
    except Exception:
        pass

    return result

