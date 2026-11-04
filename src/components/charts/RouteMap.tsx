import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet'
import type { ActivitySamples } from '@shared/domain.ts'

interface RouteMapProps {
  samples: ActivitySamples
  className?: string
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, bounds])
  return null
}

/** GPS route on OpenStreetMap tiles (tiles are cached by the service worker for offline viewing). */
export default function RouteMap({ samples, className }: RouteMapProps) {
  const path = useMemo(() => {
    const points: LatLngTuple[] = []
    const step = Math.max(1, Math.floor(samples.t.length / 600))
    for (let i = 0; i < samples.t.length; i += step) {
      const lat = samples.lat[i]
      const lng = samples.lng[i]
      if (lat != null && lng != null) points.push([lat, lng])
    }
    return points
  }, [samples])

  if (path.length < 2) return null
  const start = path[0] as LatLngTuple
  const end = path[path.length - 1] as LatLngTuple

  return (
    <MapContainer bounds={path} className={className} zoomControl={false} attributionControl scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <Polyline positions={path} pathOptions={{ color: '#0d9488', weight: 7, opacity: 0.25 }} />
      <Polyline positions={path} pathOptions={{ color: '#0f766e', weight: 3.5, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />
      <CircleMarker center={start} radius={7} pathOptions={{ color: '#fff', weight: 2.5, fillColor: '#10b981', fillOpacity: 1 }} />
      <CircleMarker center={end} radius={7} pathOptions={{ color: '#fff', weight: 2.5, fillColor: '#f43f5e', fillOpacity: 1 }} />
      <FitBounds bounds={path} />
    </MapContainer>
  )
}
