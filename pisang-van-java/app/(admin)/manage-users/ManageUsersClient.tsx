'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FetchError } from 'ofetch'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '@/src/lib/api'

interface UserType {
  id: string
  name: string | null
  email: string | null
  role: string
  koinPisang: number
  referralCode: string | null
  referredBy: string | null
  isDeleted: boolean
  isBanned: boolean
  createdAt: string
}

export default function ManageUsersClient() {
  const queryClient = useQueryClient()
  const [filterDeleted, setFilterDeleted] = useState(false)
  const [editingCoinUser, setEditingCoinUser] = useState<UserType | null>(null)
  const [coinAdjustment, setCoinAdjustment] = useState(0)
  const [coinReason, setCoinReason] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users', filterDeleted],
    queryFn: async () => {
      const data = await api<{ success: boolean; data: UserType[]; message?: string }>(
        `/api/admin/users?deleted=${filterDeleted}`
      )
      if (!data.success) throw new Error(data.message || 'Gagal memuat pengguna')
      return data.data
    },
    staleTime: 0
  })

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const data = await api<{ success: boolean; message?: string }>('/api/admin/users', {
        method: 'PATCH',
        body: { userId, role }
      })
      if (!data.success && (data as any).error)
        throw new Error((data as any).error || 'Gagal mengubah peran')
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Berhasil mengubah peran')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error: FetchError | Error) => {
      const msg =
        error instanceof FetchError ? error.data?.message || 'Gagal mengubah peran' : error.message
      toast.error(msg)
    }
  })

  const handleRoleChange = (userId: string, newRole: string) => {
    roleMutation.mutate({ userId, role: newRole })
  }

  const banMutation = useMutation({
    mutationFn: async ({ userId, isBanned }: { userId: string; isBanned: boolean }) => {
      const data = await api<{ success: boolean; message?: string }>(
        `/api/admin/users/${userId}/ban`,
        {
          method: 'POST',
          body: { isBanned }
        }
      )
      if (!data.success && (data as any).message)
        throw new Error((data as any).message || 'Gagal mengubah status ban')
      return data
    },
    onSuccess: () => {
      toast.success('Berhasil mengubah status akun')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error: FetchError | Error) => {
      const msg =
        error instanceof FetchError ? error.data?.message || 'Gagal memproses aksi' : error.message
      toast.error(msg)
    }
  })

  const handleBanToggle = (userId: string, currentBanStatus: boolean) => {
    if (
      confirm(`Anda yakin ingin ${currentBanStatus ? 'mencabut ban' : 'memblokir'} pengguna ini?`)
    ) {
      banMutation.mutate({ userId, isBanned: !currentBanStatus })
    }
  }

  const coinMutation = useMutation({
    mutationFn: async () => {
      if (!editingCoinUser || coinAdjustment === 0) throw new Error('Input tidak valid')
      const data = await api<{ success: boolean; error?: string; newBalance?: number }>(
        '/api/admin/users/coins',
        {
          method: 'POST',
          body: { targetUserId: editingCoinUser.id, amount: coinAdjustment, reason: coinReason }
        }
      )
      if (data.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      toast.success('Koin berhasil disesuaikan')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditingCoinUser(null)
      setCoinAdjustment(0)
      setCoinReason('')
    },
    onError: (error: FetchError | Error) => {
      const msg =
        error instanceof FetchError ? error.data?.error || 'Gagal mengubah koin' : error.message
      toast.error(msg)
    }
  })

  const handleAdjustCoin = (e: React.FormEvent) => {
    e.preventDefault()
    coinMutation.mutate()
  }

  if (isLoading) return <div className="text-center py-10">Memuat data...</div>

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <button
          onClick={() => setFilterDeleted(false)}
          className={`px-4 py-2 rounded-[4px] text-sm font-bold transition-all ${!filterDeleted ? 'bg-brown-700 text-white' : 'bg-white text-brown-700 border border-brown-200'}`}
        >
          Pengguna Aktif
        </button>
        <button
          onClick={() => setFilterDeleted(true)}
          className={`px-4 py-2 rounded-[4px] text-sm font-bold transition-all ${filterDeleted ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-200'}`}
        >
          Pengguna Terhapus
        </button>
      </div>

      <div className="bg-white rounded-[4px] shadow-sm overflow-hidden border border-cream-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-brown-700 text-cream-100 uppercase text-xs tracking-wider">
                <th className="p-4 font-semibold">Nama & Email</th>
                <th className="p-4 font-semibold">Koin Pisang</th>
                <th className="p-4 font-semibold">Referral Info</th>
                <th className="p-4 font-semibold text-center">Aksi / Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-sm">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-cream-50 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-brown-800">{user.name || 'User Baru'}</p>
                    <p className="text-gray-500 text-xs">{user.email}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-orange-600">
                        {user.koinPisang.toLocaleString('id-ID')}
                      </span>
                      <button
                        onClick={() => setEditingCoinUser(user)}
                        className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-xs">
                    <p>
                      <span className="text-gray-500">Kode:</span> {user.referralCode || '-'}
                    </p>
                    <p>
                      <span className="text-gray-500">Dari:</span> {user.referredBy || '-'}
                    </p>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-[4px] text-[10px] font-bold ${
                            user.role === 'ADMIN'
                              ? 'bg-red-100 text-red-700'
                              : user.role === 'RESELLER'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {user.role}
                        </span>
                        {user.isBanned && (
                          <span className="px-2 py-1 rounded-[4px] text-[10px] font-bold bg-black text-white">
                            BANNED
                          </span>
                        )}
                      </div>
                      {user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && (
                        <div className="flex items-center gap-2">
                          <select
                            className="border border-cream-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brown-500 max-w-[120px]"
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          >
                            <option value="CUSTOMER">Customer</option>
                            <option value="RESELLER">Reseller</option>
                          </select>
                          <button
                            onClick={() => handleBanToggle(user.id, user.isBanned)}
                            disabled={banMutation.isPending}
                            className={`text-[10px] px-2 py-1.5 rounded font-bold transition-all ${
                              user.isBanned
                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                            } disabled:opacity-50`}
                          >
                            {user.isBanned ? 'Cabut Ban' : 'Ban Akun'}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    Belum ada pengguna di kategori ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Coin */}
      {editingCoinUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-[4px] p-6 w-full max-w-md shadow-sm">
            <h3 className="font-bold text-xl mb-1 text-brown-900">Sesuaikan Koin Pisang</h3>
            <p className="text-sm text-gray-500 mb-6">User: {editingCoinUser.email}</p>

            <form onSubmit={handleAdjustCoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Jumlah (Gunakan minus untuk mengurangi)
                </label>
                <input
                  type="number"
                  value={coinAdjustment}
                  onChange={(e) => setCoinAdjustment(Number(e.target.value))}
                  className="w-full border rounded-[4px] px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alasan (Untuk Audit)
                </label>
                <input
                  type="text"
                  value={coinReason}
                  onChange={(e) => setCoinReason(e.target.value)}
                  placeholder="Misal: Kompensasi pesanan lambat"
                  className="w-full border rounded-[4px] px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
                  required
                  minLength={5}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingCoinUser(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-[4px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={coinMutation.isPending}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-[4px] disabled:opacity-50"
                >
                  {coinMutation.isPending ? 'Menyimpan...' : 'Simpan Koin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
