'use client'

import React, { useEffect, useState } from 'react'
import { MapPin, Plus, Star, Edit2, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

interface Address {
  id: string
  label: string
  fullAddress: string
  notes: string | null
  isDefault: boolean
}

const addressSchema = z.object({
  label: z.string().min(1, 'Label wajib diisi').max(30),
  fullAddress: z.string().min(5, 'Alamat lengkap wajib diisi').max(200),
  notes: z.string().max(100).optional(),
  isDefault: z.boolean(),
})
type AddressValues = z.infer<typeof addressSchema>

export default function AlamatPage() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { isDefault: false }
  })

  useEffect(() => {
    fetchAddresses()
  }, [])

  const fetchAddresses = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/user/addresses')
      const data = await res.json()
      if (data.success) {
        setAddresses(data.data)
      }
    } catch (error) {
      toast.error('Gagal mengambil daftar alamat')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    reset({ label: '', fullAddress: '', notes: '', isDefault: addresses.length === 0 })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (addr: Address) => {
    setEditingId(addr.id)
    reset({
      label: addr.label,
      fullAddress: addr.fullAddress,
      notes: addr.notes || '',
      isDefault: addr.isDefault
    })
    setIsModalOpen(true)
  }

  const onSubmit = async (data: AddressValues) => {
    try {
      const url = editingId ? `/api/user/addresses/${editingId}` : '/api/user/addresses'
      const method = editingId ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()
      
      if (res.ok && result.success) {
        toast.success(editingId ? 'Alamat diperbarui' : 'Alamat ditambahkan')
        setIsModalOpen(false)
        fetchAddresses()
      } else {
        toast.error(result.message || 'Gagal menyimpan alamat')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan jaringan')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus alamat ini?')) return
    try {
      const res = await fetch(`/api/user/addresses/${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (res.ok && result.success) {
        toast.success('Alamat dihapus')
        fetchAddresses()
      } else {
        toast.error(result.message || 'Gagal menghapus alamat')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan')
    }
  }

  const handleSetDefault = async (addr: Address) => {
    if (addr.isDefault) return
    try {
      const res = await fetch(`/api/user/addresses/${addr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addr, isDefault: true })
      })
      if (res.ok) {
        toast.success('Alamat utama diubah')
        fetchAddresses()
      }
    } catch (error) {
      toast.error('Terjadi kesalahan')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Daftar Alamat</h1>
          <p className="text-sm text-zinc-500">Kelola alamat pengiriman Anda</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#D4802A] text-white font-bold rounded-xl text-sm hover:bg-[#b56d24] transition-all active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Alamat
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => (
            <div key={i} className="animate-pulse flex gap-4 p-5 border border-zinc-100 rounded-2xl">
              <div className="w-10 h-10 bg-zinc-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-3 py-1">
                <div className="h-4 bg-zinc-200 rounded w-1/4" />
                <div className="h-3 bg-zinc-200 rounded w-3/4" />
                <div className="h-3 bg-zinc-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <MapPin className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300">Belum ada alamat</h3>
          <p className="text-sm text-zinc-500 mb-6">Tambahkan alamat pengiriman untuk mempermudah pemesanan.</p>
          <button onClick={handleOpenAdd} className="px-6 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-colors">
            Tambah Alamat
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {addresses.map(addr => (
            <div key={addr.id} className={`flex items-start gap-4 p-5 rounded-2xl border transition-all ${addr.isDefault ? 'border-[#D4802A]/50 bg-amber-50/50 dark:bg-amber-900/10' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${addr.isDefault ? 'bg-[#D4802A] text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{addr.label}</h3>
                  {addr.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#D4802A]/10 text-[#D4802A]">
                      <Star className="w-3 h-3 fill-current" /> Utama
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1 leading-relaxed">{addr.fullAddress}</p>
                {addr.notes && (
                  <p className="text-xs text-zinc-500 italic">Catatan: {addr.notes}</p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                {!addr.isDefault && (
                  <button onClick={() => handleSetDefault(addr)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:border-[#D4802A] hover:text-[#D4802A] transition-colors">
                    Jadikan Utama
                  </button>
                )}
                <button onClick={() => handleOpenEdit(addr)} className="p-2 text-zinc-400 hover:text-blue-500 transition-colors bg-zinc-50 hover:bg-blue-50 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(addr.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors bg-zinc-50 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h2 className="font-bold text-lg">{editingId ? 'Edit Alamat' : 'Tambah Alamat Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-600 mb-1.5">Label (cth: Rumah, Kantor)</label>
                <input {...register('label')} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-[#D4802A]/20 focus:border-[#D4802A]" />
                {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-600 mb-1.5">Alamat Lengkap</label>
                <textarea {...register('fullAddress')} rows={3} className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-[#D4802A]/20 focus:border-[#D4802A] resize-none" />
                {errors.fullAddress && <p className="text-xs text-red-500 mt-1">{errors.fullAddress.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-600 mb-1.5">Catatan / Patokan (opsional)</label>
                <input {...register('notes')} placeholder="Cth: Pagar hitam depan warung" className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-[#D4802A]/20 focus:border-[#D4802A]" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="isDefault" {...register('isDefault')} className="w-4 h-4 accent-[#D4802A] rounded cursor-pointer" />
                <label htmlFor="isDefault" className="text-sm text-zinc-600 cursor-pointer">Jadikan alamat utama</label>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-xl text-sm hover:bg-zinc-200 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-[#D4802A] text-white font-bold rounded-xl text-sm hover:bg-[#b56d24] transition-all flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
