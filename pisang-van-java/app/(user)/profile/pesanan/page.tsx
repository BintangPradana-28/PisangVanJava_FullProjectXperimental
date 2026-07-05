'use client'

import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import OrderHistory from '@/components/user/OrderHistory'
import { useLanguage } from '@/context/LanguageContext'

export default function PesananPage() {
  const { t } = useLanguage()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 rounded-[4px] p-6 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
        <div className="w-12 h-12 rounded-[4px] bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
          <ShoppingBag className="w-6 h-6 text-[#D4802A]" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
            {t('orders_title')}
          </h2>
          <p className="text-sm text-zinc-500">{t('orders_subtitle')}</p>
        </div>
      </div>

      {/* Order List */}
      <OrderHistory useAuth={true} />
    </motion.div>
  )
}
