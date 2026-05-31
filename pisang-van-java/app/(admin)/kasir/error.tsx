'use client'

import { useEffect } from 'react'

export default function ErrorKasir({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Kasir Page Error:", error)
  }, [error])

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md border border-red-100">
        <div className="text-5xl mb-4">🔌</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Sistem Terputus</h2>
        <p className="text-gray-500 mb-8 text-sm">
          Gagal terhubung ke database utama. Pastikan koneksi internet Anda stabil, atau hubungi administrator jika masalah berlanjut.
        </p>
        <button
          onClick={() => reset()}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-2xl active:scale-95 transition-all shadow-lg shadow-orange-500/30"
        >
          Coba Muat Ulang
        </button>
      </div>
    </div>
  )
}
