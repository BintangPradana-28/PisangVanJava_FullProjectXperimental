'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FetchError } from 'ofetch'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { api } from '@/src/lib/api'

interface ComplaintType {
  id: string
  subject: string
  description: string
  adminResponse: string | null
  compensationKoin: number
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED'
  createdAt: string
  user: { name: string; email: string }
  order: { id: string } | null
}

export default function ManageComplaintsClient({
  initialComplaints
}: {
  initialComplaints: ComplaintType[]
}) {
  const queryClient = useQueryClient()

  const { data: complaints = initialComplaints } = useQuery({
    queryKey: ['admin-complaints'],
    queryFn: () => api<ComplaintType[]>('/api/admin/complaints'),
    initialData: initialComplaints,
    staleTime: 0
  })

  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [compensationKoin, setCompensationKoin] = useState(0)

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const data = await api<{ success: boolean; error?: string }>('/api/admin/complaints', {
        method: 'PATCH',
        body: { complaintId: resolvingId, adminResponse, compensationKoin }
      })
      if (data.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      toast.success('Tiket berhasil diselesaikan')
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] })
      setResolvingId(null)
      setAdminResponse('')
      setCompensationKoin(0)
    },
    onError: (error: FetchError | Error) => {
      const msg =
        error instanceof FetchError
          ? error.data?.error || 'Gagal mengubah status tiket'
          : error.message
      toast.error(msg || 'Gagal memproses')
    }
  })

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingId) return
    resolveMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-700">Pusat Bantuan & Tiket</h1>
          <p className="text-sm text-brown-500">
            Kelola keluhan pelanggan dan berikan kompensasi Koin Pisang jika diperlukan.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {complaints.length === 0 ? (
          <div className="bg-white rounded-[4px] p-8 text-center text-gray-500 border border-cream-200">
            Belum ada tiket bantuan.
          </div>
        ) : (
          complaints.map((complaint) => (
            <div
              key={complaint.id}
              className="bg-white rounded-[4px] p-5 shadow-sm border border-cream-200 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${
                        complaint.status === 'OPEN'
                          ? 'bg-red-100 text-red-700'
                          : complaint.status === 'RESOLVED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {complaint.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(complaint.createdAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <h3 className="font-bold text-brown-900">{complaint.subject}</h3>
                  <p className="text-xs text-brown-500">
                    Dari: {complaint.user.name} ({complaint.user.email})
                    {complaint.order && ` • Terkait Pesanan: ${complaint.order.id}`}
                  </p>
                </div>
                {complaint.status === 'OPEN' && (
                  <button
                    onClick={() => setResolvingId(complaint.id)}
                    className="shrink-0 px-4 py-2 bg-brown-700 text-white text-xs font-bold rounded-[4px] hover:bg-brown-800"
                  >
                    Tanggapi Tiket
                  </button>
                )}
              </div>

              <div className="bg-cream-50 p-3 rounded-[4px] text-sm text-brown-800 border border-cream-100 whitespace-pre-wrap">
                {complaint.description}
              </div>

              {complaint.status === 'RESOLVED' && (
                <div className="mt-4 border-t border-cream-200 pt-4">
                  <h4 className="text-xs font-bold text-green-700 mb-1">Tanggapan Admin:</h4>
                  <p className="text-sm text-brown-800 whitespace-pre-wrap">
                    {complaint.adminResponse}
                  </p>
                  {complaint.compensationKoin > 0 && (
                    <div className="mt-2 inline-flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                      <span className="text-xl">🍌</span>
                      <span className="text-xs font-bold text-orange-700">
                        Kompensasi diberikan: {complaint.compensationKoin.toLocaleString('id-ID')}{' '}
                        Koin Pisang
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Respond */}
      {resolvingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-[4px] p-6 w-full max-w-lg shadow-sm">
            <h3 className="font-bold text-xl mb-4 text-brown-900">Tanggapi Tiket Bantuan</h3>

            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label
                  htmlFor="adminResponse"
                  className="block text-xs font-bold text-gray-700 mb-1"
                >
                  Pesan Tanggapan (Terlihat oleh pelanggan)
                </label>
                <textarea
                  id="adminResponse"
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  className="w-full border rounded-[4px] px-4 py-3 focus:ring-2 focus:ring-brown-500 outline-none h-32 resize-none text-sm"
                  required
                  placeholder="Ketik tanggapan Anda di sini..."
                />
              </div>
              <div>
                <label
                  htmlFor="compensationKoin"
                  className="block text-xs font-bold text-gray-700 mb-1"
                >
                  Kompensasi Koin Pisang (Opsional)
                </label>
                <input
                  id="compensationKoin"
                  type="number"
                  value={compensationKoin}
                  onChange={(e) => setCompensationKoin(Number(e.target.value))}
                  className="w-full border rounded-[4px] px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
                  min="0"
                  placeholder="0"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Kosongkan (0) jika tidak ada kompensasi. Koin akan otomatis ditambahkan ke saldo
                  pelanggan.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setResolvingId(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-[4px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resolveMutation.isPending}
                  className="flex-1 py-3 bg-brown-700 hover:bg-brown-800 text-white font-bold rounded-[4px] disabled:opacity-50"
                >
                  {resolveMutation.isPending ? 'Memproses...' : 'Selesaikan Tiket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
