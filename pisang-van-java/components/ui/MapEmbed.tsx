'use client'

export default function MapEmbed({ address }: { address: string }) {
  return (
    <iframe
      src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
      width="100%"
      height="100%"
      style={{ border: 0 }}
      allowFullScreen={true}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title="Peta Lokasi"
    ></iframe>
  )
}
