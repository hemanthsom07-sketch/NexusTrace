import React from 'react'
import { Globe, Server, Shield, MapPin } from 'lucide-react'

export default function GeoIpCard({ geoipData, ipAddress }) {
  if (!ipAddress && !geoipData) return null

  const geo = geoipData || {}

  return (
    <div className="inspector-card">
      <div className="section-title">
        <Globe size={13} />
        <span>Network &amp; GeoIP Intelligence</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E2D47', paddingBottom: 6 }}>
          <span style={{ color: '#94A3B8' }}>IP Address:</span>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#38BDF8' }}>
            {geo.ip || ipAddress}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E2D47', paddingBottom: 6 }}>
          <span style={{ color: '#94A3B8' }}>Routing Classification:</span>
          <span style={{ color: geo.is_private ? '#F59E0B' : '#10B981', fontWeight: 600 }}>
            {geo.network_type || (geo.is_private ? 'Private / RFC 1918' : 'Public Routable')}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E2D47', paddingBottom: 6 }}>
          <span style={{ color: '#94A3B8' }}>Geographic Region:</span>
          <span style={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={11} color="#64748B" />
            {geo.country ? `${geo.country}${geo.city ? ` (${geo.city})` : ''}` : 'GeoIP data unavailable'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94A3B8' }}>Autonomous System:</span>
          <span style={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'ui-monospace, monospace' }}>
            <Server size={11} color="#64748B" />
            {geo.asn ? `${geo.asn}${geo.org ? ` - ${geo.org}` : ''}` : 'ASN unavailable'}
          </span>
        </div>
      </div>
    </div>
  )
}
