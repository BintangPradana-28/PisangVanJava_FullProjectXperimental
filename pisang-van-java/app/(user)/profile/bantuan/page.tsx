import { AlertTriangle, ExternalLink, FileText, MessageCircle } from 'lucide-react'
import Link from 'next/link'

export default function HelpCenterPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-2xl font-bold font-serif text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
          <FileText className="w-7 h-7 text-[#D4802A]" />
          Pusat Bantuan
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Kami siap membantu setiap kendala pesanan Anda. Temukan jawaban atau hubungi kami
          langsung.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chat CS */}
        <div className="p-6 md:p-8 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-[4px] shadow-sm hover:border-green-500/30 hover:shadow-md transition-all group flex flex-col h-full">
          <div className="w-14 h-14 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 rounded-[4px] flex items-center justify-center mb-6 shrink-0 group-hover:scale-110 transition-transform">
            <MessageCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
            Chat Customer Service
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 flex-1 leading-relaxed">
            Hubungi tim kami langsung melalui WhatsApp untuk respon instan. Jam operasional CS kami
            dari 08:00 hingga 22:00 WIB.
          </p>
          <a
            href="https://wa.me/6285773728748"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full justify-center items-center gap-2 px-6 py-3.5 bg-green-600 text-white font-bold rounded-[4px] hover:bg-green-700 active:scale-95 transition-all shadow-sm hover:shadow"
          >
            Chat via WhatsApp
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Lapor Masalah */}
        <div className="p-6 md:p-8 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-[4px] shadow-sm hover:border-red-500/30 hover:shadow-md transition-all group flex flex-col h-full">
          <div className="w-14 h-14 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-[4px] flex items-center justify-center mb-6 shrink-0 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
            Lapor Masalah Pesanan
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 flex-1 leading-relaxed">
            Pesanan tidak sesuai, kurang lengkap, atau terlambat? Laporkan langsung ke manajemen
            untuk evaluasi dan kompensasi.
          </p>
          <Link
            href="/profile/bantuan/lapor" // Rute form khusus
            className="inline-flex w-full justify-center items-center gap-2 px-6 py-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold rounded-[4px] hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all"
          >
            Buat Laporan Baru
          </Link>
        </div>
      </div>

      {/* FAQ Cepat */}
      <div className="pt-8">
        <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-[4px] bg-[#D4802A]/10 text-[#D4802A] flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          Pertanyaan Umum (FAQ)
        </h3>
        <div className="space-y-4">
          {[
            {
              q: 'Bagaimana cara membatalkan pesanan?',
              a: 'Pesanan yang sudah dibayar dan masuk ke tahap proses tidak dapat dibatalkan melalui sistem. Harap hubungi Customer Service jika terjadi kesalahan mendesak.'
            },
            {
              q: 'Berapa lama batas waktu pembayaran?',
              a: 'Sistem memberikan waktu 15 menit untuk menyelesaikan pembayaran via Midtrans. Lewat dari itu, invoice akan hangus otomatis.'
            },
            {
              q: 'Bagaimana cara kerja Koin Pisang?',
              a: '1 Koin Pisang setara dengan Rp 1. Anda mendapatkan poin dari event atau pesanan. Koin hanya dapat memotong total tagihan belanja dan tidak dapat ditarik tunai.'
            },
            {
              q: 'Apakah ada diskon untuk pembelian partai besar (B2B)?',
              a: 'Ya, kami melayani pesanan katering dan partai besar. Silakan hubungi Customer Service untuk negosiasi harga khusus.'
            }
          ].map((faq, i) => (
            <div
              key={i}
              className="p-5 md:p-6 bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm"
            >
              <p className="font-bold text-zinc-900 dark:text-zinc-100 mb-2 text-base">{faq.q}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
