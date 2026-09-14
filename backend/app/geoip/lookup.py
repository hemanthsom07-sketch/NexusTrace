import ipaddress
import os

from app.config import GEOIP_DIR

_CITY_MMDB_CANDIDATES = [
    os.path.join(GEOIP_DIR, "GeoLite2-City.mmdb"),
    os.path.join(GEOIP_DIR, "dbip-city-lite.mmdb"),
]
_ASN_MMDB_CANDIDATES = [
    os.path.join(GEOIP_DIR, "GeoLite2-ASN.mmdb"),
    os.path.join(GEOIP_DIR, "dbip-asn-lite.mmdb"),
]

_city_reader = None
_city_reader_load_attempted = False
_asn_reader = None
_asn_reader_load_attempted = False

# The supplied SIH prototype dataset contains synthetic/public-looking IPs,
# including documentation ranges. A real GeoIP database is still preferred.
# These demo profiles exist only so the prototype can demonstrate the UI's
# location/ASN workflow without pretending that a guessed location is live
# intelligence. They are explicitly marked as prototype enrichment below.
DOCUMENTATION_NETWORKS = (
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
)

DEMO_GEOIP = {
    "45.33.1.10": {
        "country": "United States", "region": "New Jersey", "city": "Newark",
        "latitude": 40.7357, "longitude": -74.1724, "asn": "AS63949", "org": "Linode (prototype profile)"
    },
    "185.199.108.12": {
        "country": "United States", "region": "California", "city": "San Francisco",
        "latitude": 37.7749, "longitude": -122.4194, "asn": "AS36459", "org": "GitHub (prototype profile)"
    },
    "51.38.72.19": {
        "country": "France", "region": "Hauts-de-France", "city": "Roubaix",
        "latitude": 50.6942, "longitude": 3.1746, "asn": "AS16276", "org": "OVH (prototype profile)"
    },
    "91.198.174.192": {
        "country": "Netherlands", "region": "North Holland", "city": "Amsterdam",
        "latitude": 52.3676, "longitude": 4.9041, "asn": "AS14907", "org": "Wikimedia (prototype profile)"
    },
}


def _get_city_reader():
    global _city_reader, _city_reader_load_attempted
    if _city_reader_load_attempted:
        return _city_reader
    _city_reader_load_attempted = True
    path = next((p for p in _CITY_MMDB_CANDIDATES if os.path.exists(p)), None)
    if not path:
        return None
    try:
        import geoip2.database
        _city_reader = geoip2.database.Reader(path)
    except Exception:
        _city_reader = None
    return _city_reader


def _get_asn_reader():
    global _asn_reader, _asn_reader_load_attempted
    if _asn_reader_load_attempted:
        return _asn_reader
    _asn_reader_load_attempted = True
    path = next((p for p in _ASN_MMDB_CANDIDATES if os.path.exists(p)), None)
    if not path:
        return None
    try:
        import geoip2.database
        _asn_reader = geoip2.database.Reader(path)
    except Exception:
        _asn_reader = None
    return _asn_reader


def lookup_ip(ip: str) -> dict:
    clean_ip = (ip or "").strip()
    result = {
        "ip": clean_ip, "country": None, "region": None, "city": None,
        "latitude": None, "longitude": None, "asn": None, "org": None,
        "is_private": False, "network_type": None, "available": False,
        "status": "No GeoIP database configured", "source": None,
        "prototype": False,
    }
    if not clean_ip:
        return result

    try:
        ip_obj = ipaddress.ip_address(clean_ip)
    except ValueError:
        result["status"] = "Invalid IP address"
        return result

    # Documentation/test ranges must never receive a fake real-world location.
    # Python's ipaddress module marks some TEST-NET ranges as private, so this
    # check intentionally comes before the private-address branch.
    if ip_obj.is_reserved or any(ip_obj in net for net in DOCUMENTATION_NETWORKS):
        result.update({
            "network_type": "Documentation / Reserved",
            "status": "Documentation/reserved address -- no real-world geolocation",
            "source": "Address classification",
        })
        return result

    if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
        result.update({
            "country": "LAN", "city": "Local Subnet", "asn": "INTERNAL",
            "is_private": True, "network_type": "Private / Internal",
            "status": "Private/internal address -- public geolocation does not apply",
            "source": "Address classification",
        })
        return result

    result["network_type"] = "Public Routable Node"

    city_reader = _get_city_reader()
    asn_reader = _get_asn_reader()
    city_source = "DB-IP Lite (offline MMDB)" if any(os.path.basename(p).startswith("dbip-") and "city" in os.path.basename(p) for p in _CITY_MMDB_CANDIDATES if os.path.exists(p)) else "Offline GeoIP MMDB"
    asn_source = "DB-IP Lite (offline MMDB)" if any(os.path.basename(p).startswith("dbip-") and "asn" in os.path.basename(p) for p in _ASN_MMDB_CANDIDATES if os.path.exists(p)) else "Offline ASN MMDB"
    resolved_any = False

    if city_reader is not None:
        try:
            response = city_reader.city(clean_ip)
            result.update({
                "country": response.country.iso_code,
                "region": response.subdivisions.most_specific.name if response.subdivisions else None,
                "city": response.city.name,
                "latitude": response.location.latitude,
                "longitude": response.location.longitude,
                "source": city_source,
            })
            resolved_any = True
        except Exception:
            pass

    if asn_reader is not None:
        try:
            asn_response = asn_reader.asn(clean_ip)
            result.update({
                "asn": f"AS{asn_response.autonomous_system_number}" if asn_response.autonomous_system_number else None,
                "org": asn_response.autonomous_system_organization,
                "source": result.get("source") or asn_source,
            })
            resolved_any = True
        except Exception:
            pass

    if resolved_any:
        result["available"] = True
        result["status"] = "Resolved from configured offline GeoIP data"
        return result

    demo = DEMO_GEOIP.get(clean_ip)
    if demo:
        result.update(demo)
        result.update({
            "available": True,
            "prototype": True,
            "source": "NexusTrace prototype enrichment",
            "status": "Prototype enrichment for demonstration; replace with GeoLite2 for live attribution",
        })
        return result

    result["status"] = "No GeoIP record available -- configure an offline MMDB database or use a known prototype profile"
    return result
