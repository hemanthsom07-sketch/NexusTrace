import React from 'react'
import { Globe, Lock } from 'lucide-react'

export default function GeoIpCard({ geoData }) {
  if (!geoData) return null

  const isPrivate = geoData.classification === 'private' || geoData.is_private
  const resolved = geoData.geoip_available

  if (isPrivate) {
    return (
      <div className="geo-ip-card">
        <div className="geo-ip-header"><Lock size={16} /><h3>Private / Internal Address</h3></div>
        <p className="geo-ip-note">
          This is a private/reserved IP address. Public geographic or ASN attribution does not apply.
        </p>
      </div>
    )
  }

  return (
    <div className="geo-ip-card">
      <div className="geo-ip-header">
        <Globe size={20} />
        <h3>{resolved ? 'GeoIP / ASN Intelligence' : 'GeoIP / ASN — Unavailable'}</h3>
      </div>

      <div className="geo-ip-details">
        <div className="geo-ip-row">
          <span className="geo-ip-label">Country</span>
          <span className="geo-ip-value">{geoData.country || (resolved ? 'Unknown' : 'Unavailable')}</span>
        </div>
        <div className="geo-ip-row">
          <span className="geo-ip-label">Region</span>
          <span className="geo-ip-value">{geoData.region || (resolved ? 'Unknown' : 'Unavailable')}</span>
        </div>
        <div className="geo-ip-row">
          <span className="geo-ip-label">City</span>
          <span className="geo-ip-value">{geoData.city || (resolved ? 'Unknown' : 'Unavailable')}</span>
        </div>
        <div className="geo-ip-row">
          <span className="geo-ip-label">Coordinates</span>
          <span className="geo-ip-value">
            {typeof geoData.latitude === 'number' && typeof geoData.longitude === 'number'
              ? `${geoData.latitude.toFixed(3)}, ${geoData.longitude.toFixed(3)}`
              : 'Unavailable'}
          </span>
        </div>
        <div className="geo-ip-row">
          <span className="geo-ip-label">ASN</span>
          <span className="geo-ip-value">{geoData.asn || 'Unavailable'}</span>
        </div>
        <div className="geo-ip-row">
          <span className="geo-ip-label">Organization</span>
          <span className="geo-ip-value">{geoData.org || 'Unavailable'}</span>
        </div>

        <p className="geo-ip-note">
          {geoData.prototype
            ? 'Prototype enrichment for the supplied demo dataset. It is illustrative, not live IP geolocation.'
            : (geoData.geoip_status ||
              (resolved
                ? 'Resolved from an offline GeoLite2 database.'
                : 'No offline GeoLite2 database configured — see backend/data/geoip/ to enable country, ASN and coordinate enrichment.'))}
        </p>
        {geoData.source && <div className="geo-ip-source">Source: {geoData.source}</div>}
      </div>
    </div>
  )
}
