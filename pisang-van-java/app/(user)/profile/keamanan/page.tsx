'use client'

import { Shield, Hammer } from 'lucide-react'
import { motion } from 'framer-motion'

export default function KeamananPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80 min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-6 relative">
          <Shield className="w-10 h-10 text-zinc-400" />
          <Hammer className="w-6 h-6 text-[#D4802A] absolute -bottom-1 -right-1" />
        </div>
        <h2 className="text-2xl font-bold font-serif text-zinc-900 dark:text-zinc-100 mb-3">Keamanan Tambahan</h2>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
          Fitur pengaturan keamanan tingkat lanjut seperti Multi-Factor Authentication (MFA) sedang dikembangkan.
        </p>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-2xl text-sm border border-blue-100 dark:border-blue-800/30">
          Untuk mengubah password, Anda bisa melakukannya melalui menu <strong>Data Diri</strong> saat ini.
        </div>
      </section>
    </motion.div>
  )
}
