/**
 * Intended path: src/components/MapPicker.tsx (REPLACES current file)
 *
 * [FIX] Original used `useEffect(() => onPositionChange(position), [position, onPositionChange])`
 * with `position` initialized to `initialPosition ?? DEFAULT_CENTER`. Since that initial
 * value is already non-null on mount, the effect fired immediately — before the user ever
 * clicked or dragged the marker. Confirmed via app/(user)/profile/alamat/page.tsx:62
 * (`mapPosition` starts as `null`) — the parent relied on this component to tell it when a
 * REAL pin was placed, but got a false signal on every mount instead.
 *
 * [VERIFIED SAFE] Edit-mode is untouched by this fix: handleOpenModal() in page.tsx:80-96
 * already calls setMapPosition() directly from the saved address.latitude/longitude when
 * editing, independent of this component. This component's onPositionChange is only the
 * signal for "user picked a new pin," which is exactly what was broken.
 *
 * Change: onPositionChange now only fires from the actual interaction handlers
 * (click / drag) inside LocationMarker, never automatically on mount.
 */
'use client'

import { useState } from 'react'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default icon issue with Leaflet in React Next.js
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Default map center when no position is set yet (Bandung) — view-only, never
// reported to the parent as a real selection.
const DEFAULT_CENTER: LatLng = { lat: -6.914744, lng: 107.60981 }

type LatLng = { lat: number; lng: number }

function LocationMarker({
  position,
  onPick
}: {
  position: LatLng | null
  onPick: (p: LatLng) => void
}) {
  const map = useMapEvents({
    click(e) {
      onPick(e.latlng)
      map.flyTo(e.latlng, map.getZoom())
    }
  })

  return position === null ? null : (
    <Marker
      position={position}
      icon={customIcon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target
          onPick(marker.getLatLng())
        }
      }}
    />
  )
}

interface MapPickerProps {
  initialPosition?: LatLng | null
  onPositionChange: (pos: LatLng) => void
}

export default function MapPicker({ initialPosition, onPositionChange }: MapPickerProps) {
  // Null when no pin has been placed yet — was previously defaulted to
  // Bandung coordinates, which is what caused the false-positive callback.
  const [position, setPosition] = useState<LatLng | null>(initialPosition ?? null)

  // Only path that notifies the parent — wired to real user interaction only
  // (click/drag inside LocationMarker), never to mount or prop changes.
  const handlePick = (pos: LatLng) => {
    setPosition(pos)
    onPositionChange(pos)
  }

  return (
    <div className="h-64 w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-0">
      <MapContainer
        center={position ?? DEFAULT_CENTER}
        zoom={15}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} onPick={handlePick} />
      </MapContainer>
      {position === null && (
        <div className="absolute bottom-2 left-2 right-2 bg-white/95 dark:bg-zinc-900/95 px-3 py-1.5 rounded-md text-[11px] text-center font-medium shadow-sm z-[400] pointer-events-none text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800">
          💡 Klik pada peta untuk menandai lokasi Anda
        </div>
      )}
    </div>
  )
}
