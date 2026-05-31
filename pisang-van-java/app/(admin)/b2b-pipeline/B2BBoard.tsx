"use client"
import { useState } from "react"
import { updateB2BDealStatus } from "@/src/features/crm/actions"
import toast from "react-hot-toast"

type Deal = {
  id: string
  companyName: string
  dealName: string
  amount: number | null
  stage: "PROSPECTING" | "NEGOTIATION" | "CLOSED_WON" | "CLOSED_LOST"
  owner: { name: string | null } | null
}

const STAGES = ["PROSPECTING", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"] as const

export default function B2BBoard({ initialDeals }: { initialDeals: Deal[] }) {
  const [deals, setDeals] = useState(initialDeals)
  const [isLoading, setIsLoading] = useState(false)

  async function handleStatusChange(dealId: string, newStage: Deal["stage"]) {
    setIsLoading(true)
    const res = await updateB2BDealStatus({ dealId, stage: newStage })
    if (res.success) {
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
      )
      toast.success("Status berhasil diubah")
    } else {
      toast.error(res.error)
    }
    setIsLoading(false)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage)
        return (
          <div key={stage} className="bg-gray-50 rounded-xl p-4 min-w-[280px]">
            <h2 className="font-bold mb-4 flex items-center justify-between">
              {stage}
              <span className="bg-gray-200 text-xs px-2 py-1 rounded-full">
                {stageDeals.length}
              </span>
            </h2>
            <div className="space-y-3">
              {stageDeals.map((deal) => (
                <div key={deal.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-sm">{deal.companyName}</h3>
                  <p className="text-xs text-gray-500 mb-2">{deal.dealName}</p>
                  <p className="text-sm font-bold text-amber-600 mb-3">
                    {deal.amount ? `Rp ${deal.amount.toLocaleString()}` : "Rp ?"}
                  </p>
                  
                  <select 
                    disabled={isLoading}
                    value={deal.stage}
                    onChange={(e) => handleStatusChange(deal.id, e.target.value as Deal["stage"])}
                    className="w-full text-xs p-1.5 border rounded bg-gray-50"
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
              {stageDeals.length === 0 && (
                <p className="text-xs text-center text-gray-400 py-4">Kosong</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
