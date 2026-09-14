import React from 'react'
import { Globe, Lock } from 'lucide-react'

export default function GeoIpCard({ geoData }) {
  if (!geoData) return null

  const classification = String(geoData.network_type || geoData.classification || '').toLowerCase()
  const isPrivate = geoData.is_private || classification.includes('private') || classification.includes('internal')
  const isDocumentation = classification.includes('documentation') || classification.includes('reserved')
  const resolved = geoData.geoip_available

  if (isPrivate || isDocumentation) {
    return (
      <div className="geo-ip-card">
        <div className="geo-ip-header"><Lock size={16} /><h3>{isPrivate ? 'Private / Internal Address' : 'Documentation / Reserved Address'}</h3></div>
        <p className="geo-ip-note">
          {isPrivate
            ? 'This address belongs to a private/internal range. Public geographic or ASN attribution does not apply.'
            : 'This address is a documentation/reserved range. NexusTrace intentionally does not assign a real-world location.'}
        </p>
        {geoData.ip && <div className="geo-ip-source">{geoData.ip} · {geoData.geoip_status || 'Address classification'}</div>}
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
        <div className="geo-ip-row"><span className="geo-ip-label">Country</span><span className="geo-ip-value">{geoData.country || (resolved ? 'Unknown' : 'Unavailable')}</span></div>
        <div className="geo-ip-row"><span className="geo-ip-label">Region</span><span className="geo-ip-value">{geoData.region || (resolved ? 'Unknown' : 'Unavailable')}</span></div>
        <div className="geo-ip-row"><span className="geo-ip-label">City</span><span className="geo-ip-value">{geoData.city || (resolved ? 'Unknown' : 'Unavailable')}</span></div>
        <div className="geo-ip-row"><span className="geo-ip-label">Coordinates</span><span className="geo-ip-value">{typeof geoData.latitude === 'number' && typeof geoData.longitude === 'number' ? `${geoData.latitude.toFixed(3)}, ${geoData.longitude.toFixed(3)}` : 'Unavailable'}</span></div>
        <div className="geo-ip-row"><span className="geo-ip-label">ASN</span><span className="geo-ip-value">{geoData.asn || 'Unavailable'}</span></div>
        <div className="geo-ip-row"><span className="geo-ip-label">Organization</span><span className="geo-ip-value">{geoData.org || 'Unavailable'}</span></div>

        <p className="geo-ip-note">
          {geoData.prototype
            ? 'Prototype enrichment for the supplied demo dataset. It is illustrative, not live IP geolocation.'
            : (geoData.geoip_status || (resolved ? 'Resolved from a configured offline MMDB GeoIP database.' : 'No offline MMDB database configured.'))}
        </p>
        {geoData.geoip_source && <div className="geo-ip-source">Source: {geoData.geoip_source}</div>}
        {geoData.source && geoData.source !== geoData.geoip_source && <div className="geo-ip-source">Source: {geoData.source}</div>}
        {(geoData.geoip_source || geoData.source || '').toLowerCase().includes('db-ip') && (
          <div className="geo-ip-source">IP geolocation data: <a href="https://db-ip.com" target="_blank" rel="noreferrer">DB-IP.com</a></div>
        )}
      </div>
    </div>
  )
}
