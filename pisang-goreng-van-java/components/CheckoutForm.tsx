'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { checkoutSchema, type CheckoutFormValues } from '@/src/lib/validations/checkout'
import { submitCheckoutAction } from '@/app/actions/checkoutAction'

export default function CheckoutForm() {
  // =========================================================================
  // 2. INISIALISASI MESIN REACT HOOK FORM
  // =========================================================================
  const {
    register, 
    handleSubmit,
    formState: { errors, isSubmitting }, 
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      nama: "",
      whatsapp: "",
      catatan: "",
    }
  })

  // =========================================================================
  // 3. LOGIKA PENGIRIMAN SECURE (SERVER INTEGRATION)
  // =========================================================================
  const onSubmit = async (data: CheckoutFormValues) => {
    try {
      // Data sudah bersih di sisi klien, kirim ke karantina Server
      const response = await submitCheckoutAction(data);

      if (!response.success) {
        // Tampilkan Opaque Error dari server tanpa membongkar topologi sistem
        alert(`Gagal memproses pesanan: ${response.error}`);
        return;
      }

      alert(`Pesanan aman! ID Transaksi Anda: ${response.transactionId}`);
      // Opsional: reset() form atau redirect router di sini
      
    } catch (error) {
      alert("Koneksi ke server terputus. Sistem fail-closed diaktifkan.");
    }
  }

  // =========================================================================
  // 4. ANTARMUKA PENGGUNA (UI)
  // =========================================================================
  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-[#1a0f0a] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
      <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white mb-6">Detail Pesanan</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        
        {/* FIELD: NAMA */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Pemesan</label>
          <input 
            {...register("nama")} 
            type="text" 
            placeholder="Ketik nama Anda..."
            className={`w-full px-4 py-2 rounded-xl border bg-gray-50 dark:bg-black/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
              errors.nama ? 'border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-gray-700 focus:border-amber-500 focus:ring-amber-500/20'
            }`}
          />
          {errors.nama && <p className="mt-1 text-sm text-red-500 font-medium">{errors.nama.message}</p>}
        </div>

        {/* FIELD: WHATSAPP */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor WhatsApp</label>
          <input 
            {...register("whatsapp")} 
            type="text" 
            placeholder="08123456789"
            className={`w-full px-4 py-2 rounded-xl border bg-gray-50 dark:bg-black/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
              errors.whatsapp ? 'border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-gray-700 focus:border-amber-500 focus:ring-amber-500/20'
            }`}
          />
          {errors.whatsapp && <p className="mt-1 text-sm text-red-500 font-medium">{errors.whatsapp.message}</p>}
        </div>

        {/* FIELD: CATATAN (OPTIONAL) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan Tambahan</label>
          <textarea 
            {...register("catatan")} 
            rows={3}
            placeholder="Misal: Pisangnya digoreng agak kering ya..."
            className={`w-full px-4 py-2 rounded-xl border bg-gray-50 dark:bg-black/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
              errors.catatan ? 'border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-gray-700 focus:border-amber-500 focus:ring-amber-500/20'
            }`}
          />
          {errors.catatan && <p className="mt-1 text-sm text-red-500 font-medium">{errors.catatan.message}</p>}
        </div>

        {/* TOMBOL SUBMIT */}
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-[#D4802A] hover:bg-[#b56d24] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-95 flex justify-center items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Memproses...</span>
            </>
          ) : (
            <span>Pesan Sekarang</span>
          )}
        </button>

      </form>
    </div>
  )
}
