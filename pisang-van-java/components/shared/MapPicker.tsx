'use client'

// ARCHITECTURE FIX: this file consolidates two previously-separate, diverging
// implementations of the same capability — components/user/MapPicker.tsx (used by
// checkout/page.tsx) and src/components/MapPicker.tsx (used by profile/alamat/page.tsx).
// Both files should be deleted once their consumers point here instead.
//
// What was kept from each:
// - From the checkout version: search bar with Nominatim text search, reverse
//   geocoding on click (fills in a human-readable address string), an SSR-safe
//   loading skeleton, and toast-based error feedback.
// - From the profile/alamat version: draggable marker (nicer fine-tuning UX than
//   click-only repositioning).
// - Fixed: the profile/alamat version defaulted to Bandung ({lat:-6.914744,
//   lng:107.60981}) when no position was set yet, ~150km from this business's
//   actual service area. Both call sites now consistently default to Cipayung,
//   Jakarta Timur — the coordinates already used correctly by the checkout version.
//
// Prop shape: kept as the tuple-based [number, number] interface from the checkout
// version (not the {lat,lng} object shape profile/alamat used) since it's the
// simpler of the two and was already the more feature-complete implementation's
// choice. profile/alamat/page.tsx has been updated to match.

import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import toast from 'react-hot-toast'

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Koordinat default: Kedai Cipayung, Jakarta Timur — satu-satunya default yang
// dipakai di seluruh proyek sekarang (lihat catatan bug di atas).
const DEFAULT_CENTER: [number, number] = [-6.3157, 106.9016]

interface MapPickerProps {
  position: [number, number] | null
  setPosition: (pos: [number, number]) => void
  setAddressName?: (addr: string) => void
  /** Izinkan marker digeser langsung (drag) selain klik-untuk-pindah. Default: true. */
  draggable?: boolean
}

function LocationMarker({ position, setPosition, setAddressName, draggable = true }: MapPickerProps) {
  function reverseGeocode(lat: number, lng: number) {
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.display_name && setAddressName) {
          setAddressName(data.display_name)
        }
      })
      .catch((err) => console.error('Reverse Geocode Error:', err))
  }

  const map = useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng])
      reverseGeocode(e.latlng.lat, e.latlng.lng)
    }
  })

  return position === null ? null : (
    <Marker
      position={position}
      icon={customIcon}
      draggable={draggable}
      eventHandlers={
        draggable
          ? {
              dragend: (e) => {
                const marker = e.target
                const latLng = marker.getLatLng()
                setPosition([latLng.lat, latLng.lng])
                reverseGeocode(latLng.lat, latLng.lng)
                map.flyTo(latLng, map.getZoom())
              }
            }
          : undefined
      }
    />
  )
}

// Komponen helper untuk menggeser peta ke posisi marker terpilih
function MapUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom() < 13 ? 15 : map.getZoom())
    }
  }, [center, map])
  return null
}

export default function MapPicker({
  position,
  setPosition,
  setAddressName,
  draggable = true
}: MapPickerProps) {
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="w-full h-[320px] bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[4px] flex items-center justify-center text-zinc-400">
        Memuat Peta...
      </div>
    )
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=id&limit=1`
      )
      const data = await res.json()
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lon = parseFloat(data[0].lon)
        setPosition([lat, lon])
        if (setAddressName) {
          setAddressName(data[0].display_name)
        }
      } else {
        toast.error('Lokasi tidak ditemukan. Coba ketik alamat lebih spesifik.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal memproses pencarian lokasi.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="w-full space-y-2">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari jalan, gedung, atau kelurahan Anda..."
          className="flex-1 px-4 py-2 text-sm rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-4 py-2 text-sm rounded-[4px] bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-all disabled:opacity-50"
        >
          {searching ? 'Mencari...' : 'Cari'}
        </button>
      </form>

      {/* Leaflet Map */}
      <div className="w-full h-[320px] rounded-[4px] overflow-hidden shadow-inner border border-zinc-100 dark:border-zinc-800 z-0 relative">
        <MapContainer
          center={position || DEFAULT_CENTER}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker
            position={position}
            setPosition={setPosition}
            setAddressName={setAddressName}
            draggable={draggable}
          />
          <MapUpdater center={position} />
        </MapContainer>
        <div className="absolute bottom-2 left-2 bg-white/95 dark:bg-zinc-900/95 px-3 py-1.5 rounded-[4px] text-[10px] sm:text-xs font-semibold shadow-sm z-[400] pointer-events-none text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800">
          💡 Klik atau geser marker untuk memindahkan pinpoint
        </div>
      </div>
    </div>
  )
}
