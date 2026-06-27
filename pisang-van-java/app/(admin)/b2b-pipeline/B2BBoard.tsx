'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { createB2BDeal, updateB2BDealStatus } from '@/src/features/crm/actions'

type Deal = {
  id: string
  companyName: string
  dealName: string
  amount: number | null
  stage: 'PROSPECTING' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST'
  owner: { name: string | null } | null
}

const STAGES = ['PROSPECTING', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const

export default function B2BBoard({ initialDeals }: { initialDeals: Deal[] }) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [isLoading, setIsLoading] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)

  // Form states for new deal
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dealName, setDealName] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  async function handleStatusChange(dealId: string, newStage: Deal['stage']) {
    setIsLoading(true)
    const res = await updateB2BDealStatus({ dealId, stage: newStage })
    if (res.success) {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)))
      toast.success('Status deal berhasil diperbarui')
    } else {
      toast.error(res.error || 'Gagal mengubah status deal')
    }
    setIsLoading(false)
  }

  async function handleAddDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName || !contactName || !phone || !dealName) {
      toast.error('Kolom wajib harus diisi')
      return
    }

    setIsLoading(true)
    const payload = {
      companyName,
      contactName,
      phone,
      email: email || undefined,
      dealName,
      amount: amount ? Number(amount) : null,
      notes: notes || null
    }

    const res = await createB2BDeal(payload)
    if (res.success && res.data) {
      const created = {
        ...res.data,
        owner: { name: 'Admin' } // optimistic name
      } as Deal
      setDeals((prev) => [...prev, created])
      toast.success('Deal baru berhasil dibuat!')
      setIsAddOpen(false)
      // reset form
      setCompanyName('')
      setContactName('')
      setPhone('')
      setEmail('')
      setDealName('')
      setAmount('')
      setNotes('')
    } else {
      toast.error(res.error || 'Gagal membuat deal')
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
            B2B Sales Pipeline
          </h1>
          <p className="text-xs text-zinc-500">
            Kelola prospek dan kemitraan Reseller / Korporat Pisang Van Java
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-[4px] shadow-sm transition-all"
        >
          + Tambah Deal Baru
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage)
          return (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const dealId = e.dataTransfer.getData('text/plain')
                if (dealId) {
                  handleStatusChange(dealId, stage)
                }
              }}
              className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-lg p-4 min-w-[280px] flex flex-col min-h-[500px]"
            >
              <h2 className="font-bold text-sm tracking-wide text-zinc-800 dark:text-zinc-200 mb-4 flex items-center justify-between uppercase">
                <span>
                  {stage === 'PROSPECTING'
                    ? '🔍 Prospecting'
                    : stage === 'NEGOTIATION'
                      ? '💬 Negotiation'
                      : stage === 'CLOSED_WON'
                        ? '🎉 Won'
                        : '❌ Lost'}
                </span>
                <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {stageDeals.length}
                </span>
              </h2>

              <div className="space-y-3 flex-1">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', deal.id)
                    }}
                    className="bg-white dark:bg-zinc-900 p-4 rounded-lg shadow-sm border border-zinc-200/60 dark:border-zinc-800/80 cursor-grab active:cursor-grabbing hover:border-amber-500/40 transition-colors space-y-2.5"
                  >
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {deal.companyName}
                      </h3>
                      <p className="text-xs text-zinc-500 font-medium">{deal.dealName}</p>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        {deal.amount ? `Rp ${deal.amount.toLocaleString('id-ID')}` : 'Rp —'}
                      </span>
                      {deal.owner?.name && (
                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                          👤 {deal.owner.name}
                        </span>
                      )}
                    </div>

                    <select
                      disabled={isLoading}
                      value={deal.stage}
                      onChange={(e) => handleStatusChange(deal.id, e.target.value as Deal['stage'])}
                      aria-label="Pilih tahapan deal"
                      title="Pilih tahapan deal"
                      className="w-full text-xs px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-amber-500"
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div className="h-full min-h-[120px] flex items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg py-6">
                    <p className="text-xs text-center text-zinc-400 font-bold uppercase tracking-wider">
                      Drag / Tarik ke Sini
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Deal Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleAddDeal}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 text-zinc-800 dark:text-zinc-100 animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-serif text-lg font-bold text-amber-600 dark:text-amber-400">
                Tambah Deal B2B Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 max-h-[60dvh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Nama Perusahaan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="PT Maju Bersama"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Nama Kontak Person *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Budi Utomo"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    No. HP / WA *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="08123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="budi@perusahaan.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Nama Deal (Prospek) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Kemitraan Reseller Sleman"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Nilai Kontrak (Rupiah)
                </label>
                <input
                  type="number"
                  placeholder="15000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  placeholder="Informasi tambahan deal..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-[4px] border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-850"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-[4px] disabled:opacity-50"
              >
                {isLoading ? 'Menyimpan...' : 'Simpan Deal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
