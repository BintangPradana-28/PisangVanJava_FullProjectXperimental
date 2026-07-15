'use client'

import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Trash2
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  createAddress,
  deleteAddress,
  getUserAddresses,
  setDefaultAddress,
  updateAddress
} from '@/app/actions/address'
import { useLanguage } from '@/context/LanguageContext'

// Dynamic import Leaflet map (disable SSR to prevent window is not defined error)
const MapPicker = dynamic(() => import('@/components/shared/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[4px] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      <span className="text-sm text-zinc-500 font-medium">Memuat Peta Geospasial...</span>
    </div>
  )
})

type LatLng = { lat: number; lng: number }
type AddressType = {
  id: string
  label: string
  fullAddress: string
  latitude: number | null
  longitude: number | null
  notes: string | null
  isDefault: boolean
}

export default function AlamatPage() {
  const { t } = useLanguage()
  const [addresses, setAddresses] = useState<AddressType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    label: '',
    fullAddress: '',
    notes: '',
    isDefault: false
  })
  const [mapPosition, setMapPosition] = useState<[number, number] | null>(null)

  const fetchAddresses = async () => {
    setIsLoading(true)
    const res = await getUserAddresses()
    if (res.success && res.data) {
      setAddresses(res.data)
    } else {
      toast.error(res.error ? String(res.error) : 'Gagal memuat alamat')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchAddresses()
  }, [fetchAddresses])

  const handleOpenModal = (address?: AddressType) => {
    if (address) {
      setEditingId(address.id)
      setFormData({
        label: address.label,
        fullAddress: address.fullAddress,
        notes: address.notes || '',
        isDefault: address.isDefault
      })
      if (address.latitude && address.longitude) {
        setMapPosition([address.latitude, address.longitude])
      } else {
        setMapPosition(null)
      }
    } else {
      setEditingId(null)
      setFormData({ label: '', fullAddress: '', notes: '', isDefault: false })
      setMapPosition(null)
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const payload = {
      label: formData.label,
      fullAddress: formData.fullAddress,
      notes: formData.notes,
      latitude: mapPosition ? mapPosition[0] : null,
      longitude: mapPosition ? mapPosition[1] : null,
      isDefault: formData.isDefault
    }

    let res
    if (editingId) {
      res = await updateAddress(editingId, payload)
    } else {
      res = await createAddress(payload)
    }

    if (res.success) {
      toast.success(res.message ? String(res.message) : 'Alamat berhasil disimpan')
      setIsModalOpen(false)
      fetchAddresses()
    } else {
      toast.error(res.error ? String(res.error) : 'Gagal menyimpan alamat')
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('address_delete_confirm'))) return
    const res = await deleteAddress(id)
    if (res.success) {
      toast.success(res.message ? String(res.message) : 'Berhasil')
      fetchAddresses()
    } else {
      toast.error(res.error ? String(res.error) : 'Gagal menghapus alamat')
    }
  }

  const handleSetDefault = async (id: string) => {
    const res = await setDefaultAddress(id)
    if (res.success) {
      toast.success(res.message ? String(res.message) : 'Berhasil')
      fetchAddresses()
    } else {
      toast.error(res.error ? String(res.error) : 'Gagal mengatur alamat utama')
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
            <MapPin className="w-7 h-7 text-[#D4802A]" />
            {t('address_title')}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t('address_subtitle')}</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#D4802A] hover:bg-[#b56d24] text-white px-5 py-2.5 rounded-[4px] font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-sm active:scale-95"
        >
          <Plus className="w-5 h-5" />
          {t('address_add_btn')}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 bg-zinc-100 dark:bg-zinc-800/50 rounded-[4px] animate-pulse"
            ></div>
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 border-dashed dark:border-zinc-800 rounded-[4px] p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-[4px] flex items-center justify-center mb-4">
            <Navigation className="w-10 h-10 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            {t('address_empty_title')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
            {t('address_empty_desc')}
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="text-[#D4802A] font-bold hover:underline flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {t('address_empty_btn')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`relative bg-white dark:bg-zinc-900 rounded-[4px] p-6 shadow-sm border transition-all duration-300 ${
                addr.isDefault
                  ? 'border-[#D4802A] ring-1 ring-[#D4802A]/20'
                  : 'border-zinc-200/50 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              {addr.isDefault && (
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-[#D4802A] text-white text-xs font-bold px-3 py-1 rounded-[4px] flex items-center gap-1 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('address_default_badge')}
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[4px] bg-orange-50 text-[#D4802A] dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                      {addr.label}
                    </h3>
                    {addr.latitude && addr.longitude && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1 mt-0.5">
                        <Navigation className="w-3 h-3" />{' '}
                        {t('address_pin_saved') ?? 'Pin Peta Tersimpan'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed line-clamp-2">
                  {addr.fullAddress}
                </p>
                {addr.notes && (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-[4px] text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
                    <span>
                      <strong className="text-zinc-700 dark:text-zinc-300">
                        {t('address_note_label') ?? 'Catatan:'}
                      </strong>{' '}
                      {addr.notes}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                {!addr.isDefault && (
                  <button
                    onClick={() => handleSetDefault(addr.id)}
                    className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-[#D4802A] transition-colors flex-1 text-left"
                  >
                    {t('address_set_default')}
                  </button>
                )}
                <div
                  className={`flex items-center gap-2 ${addr.isDefault ? 'w-full justify-end' : ''}`}
                >
                  <button
                    onClick={() => handleOpenModal(addr)}
                    className="p-2 text-zinc-400 hover:text-blue-500 bg-zinc-50 hover:bg-blue-50 dark:bg-zinc-800/50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title={t('address_edit_title')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="p-2 text-zinc-400 hover:text-red-500 bg-zinc-50 hover:bg-red-50 dark:bg-zinc-800/50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title={t('address_delete_title') ?? 'Hapus Alamat'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[4px] shadow-sm overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/80 sticky top-0 z-10">
              <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                {editingId ? (
                  <Edit2 className="w-5 h-5 text-[#D4802A]" />
                ) : (
                  <Plus className="w-5 h-5 text-[#D4802A]" />
                )}
                {editingId ? t('address_edit_title') : t('address_add_title')}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-2"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="addressForm" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {t('address_label')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t('address_label_placeholder')}
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      className="w-full p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                      <span>
                        {t('address_map_title')}{' '}
                        <span className="text-zinc-400 font-normal text-xs">
                          ({t('address_map_desc')})
                        </span>
                      </span>
                      {mapPosition && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />{' '}
                          {t('address_pin_saved') ?? 'Pin Tersimpan'}
                        </span>
                      )}
                    </label>
                    <MapPicker position={mapPosition} setPosition={(pos) => setMapPosition(pos)} />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                      {t('address_map_help')}
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {t('address_full')} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder={t('address_full_placeholder')}
                      value={formData.fullAddress}
                      onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                      className="w-full p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all resize-none"
                    ></textarea>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {t('address_notes')}{' '}
                      <span className="text-zinc-400 font-normal text-xs">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder={t('address_notes_placeholder')}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all"
                    />
                  </div>

                  {!editingId && (
                    <div className="md:col-span-2 pt-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.isDefault}
                            onChange={(e) =>
                              setFormData({ ...formData, isDefault: e.target.checked })
                            }
                            className="sr-only"
                          />
                          <div
                            className={`w-11 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-[4px] transition-colors ${formData.isDefault ? 'bg-[#D4802A] dark:bg-[#D4802A]' : ''}`}
                          ></div>
                          <div
                            className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-[4px] transition-transform ${formData.isDefault ? 'translate-x-5' : ''}`}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-[#D4802A] transition-colors">
                          {t('address_set_default_chk')}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex justify-end gap-3 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-[4px] font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                disabled={isSubmitting}
              >
                {t('address_cancel_btn')}
              </button>
              <button
                type="submit"
                form="addressForm"
                disabled={isSubmitting}
                className="bg-[#D4802A] hover:bg-[#b56d24] text-white px-8 py-2.5 rounded-[4px] font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('address_save_btn')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
