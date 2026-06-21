'use client'
// components/admin/ReportsClient.tsx
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { formatPrice } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Order {
  id: string
  totalPrice: number
  status: string
  source: string
  createdAt: string
  items: { variant: { flavorName: string } }[]
}

interface PaymentBreakdown {
  paymentType: string
  totalAmount: number
  count: number
}

interface Props {
  orders: Order[]
  totalVariants: number
  totalToppings: number
  currentRange: string
  hourlyDistribution: Record<string, number>
  paymentBreakdown: PaymentBreakdown[]
}

// ─── MDR Rates (Midtrans Indonesia) ─────────────────────────────────────────

const MDR_RATES: Record<string, number> = {
  qris: 0.007,
  gopay: 0.02,
  ovo: 0.02,
  dana: 0.02,
  shopeepay: 0.02,
  linkaja: 0.02,
  bank_transfer: 0.008,
  bca_va: 0.008,
  bni_va: 0.008,
  bri_va: 0.008,
  mandiri_bill: 0.008,
  credit_card: 0.029,
  cstore: 0.025,
  indomaret: 0.025,
  alfamart: 0.025
}
const MDR_DEFAULT = 0.01

const MDR_LABELS: Record<string, string> = {
  qris: 'QRIS',
  gopay: 'GoPay',
  ovo: 'OVO',
  dana: 'DANA',
  shopeepay: 'ShopeePay',
  bank_transfer: 'Transfer Bank',
  credit_card: 'Kartu Kredit',
  cstore: 'Minimarket',
  indomaret: 'Indomaret',
  alfamart: 'Alfamart',
  other: 'Lainnya'
}

// ─── SVG Line Chart ──────────────────────────────────────────────────────────

function LineChart({
  data,
  color = '#D4802A'
}: {
  data: { label: string; value: number }[]
  color?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const W = 560,
    H = 170
  const PL = 64,
    PR = 20,
    PT = 20,
    PB = 36
  const plotW = W - PL - PR
  const plotH = H - PT - PB

  const max = Math.max(...data.map((d) => d.value), 1)

  const pts = data.map((d, i) => ({
    x: PL + (i / Math.max(data.length - 1, 1)) * plotW,
    y: PT + (1 - d.value / max) * plotH,
    ...d
  }))

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(PT + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(PT + plotH).toFixed(1)} Z`

  const yGrids = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PT + (1 - f) * plotH,
    val: max * f
  }))

  const showLabel = (i: number) => {
    if (data.length <= 8) return true
    if (data.length <= 16) return i % 2 === 0
    return i % Math.ceil(data.length / 8) === 0 || i === data.length - 1
  }

  const fmtY = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}Jt`
    if (v >= 1_000) return `${Math.round(v / 1_000)}Rb`
    return v.toFixed(0)
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ overflow: 'visible' }}
      aria-label="Grafik pendapatan"
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yGrids.map(({ y }) => (
        <line
          key={y}
          x1={PL}
          y1={y.toFixed(1)}
          x2={W - PR}
          y2={y.toFixed(1)}
          stroke="#EDD4A0"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}

      {/* Y-axis labels */}
      {yGrids.map(({ y, val }) => (
        <text
          key={val}
          x={PL - 6}
          y={(y + 4).toFixed(1)}
          textAnchor="end"
          fill="#7A3B18"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          {fmtY(val)}
        </text>
      ))}

      {/* Area */}
      {data.some((d) => d.value > 0) && <path d={areaPath} fill="url(#areaGrad)" />}

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Points + tooltips */}
      {pts.map((p, i) => (
        <g key={i}>
          {/* Hover hit area */}
          <rect
            x={p.x - 12}
            y={PT - 5}
            width={24}
            height={plotH + 10}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
          <circle
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r={hovered === i ? 6 : 4}
            fill={hovered === i ? color : '#fffaf6'}
            stroke={color}
            strokeWidth="2"
            style={{ pointerEvents: 'none' }}
          />
          {/* Tooltip */}
          {hovered === i && (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={Math.min(p.x - 56, W - PR - 116)}
                y={Math.max(p.y - 48, 2)}
                width="112"
                height="34"
                rx="5"
                fill="#3D1C02"
                fillOpacity="0.96"
              />
              <text
                x={Math.min(p.x, W - PR - 60)}
                y={Math.max(p.y - 30, 20)}
                textAnchor="middle"
                fill="white"
                fontSize="11"
                fontWeight="bold"
                fontFamily="system-ui, sans-serif"
              >
                {formatPrice(p.value)}
              </text>
              <text
                x={Math.min(p.x, W - PR - 60)}
                y={Math.max(p.y - 16, 34)}
                textAnchor="middle"
                fill="#D4802A"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                {p.label}
              </text>
            </g>
          )}
          {/* X-axis label */}
          {showLabel(i) && (
            <text
              x={p.x.toFixed(1)}
              y={H - 3}
              textAnchor="middle"
              fill="#7A3B18"
              fontSize={data.length > 20 ? '7' : '9'}
              fontFamily="system-ui, sans-serif"
            >
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── Peak Hours Heatmap ──────────────────────────────────────────────────────

function PeakHoursHeatmap({ distribution }: { distribution: Record<string, number> }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...Object.values(distribution), 1)

  const hours = Array.from({ length: 24 }, (_, h) => ({
    h,
    count: distribution[String(h)] || 0,
    label: `${String(h).padStart(2, '0')}:00`
  }))

  const getColor = (count: number) => {
    const r = count / max
    if (r === 0) return '#FDF6E3'
    if (r < 0.2) return '#F5E6C8'
    if (r < 0.4) return '#EDD4A0'
    if (r < 0.6) return '#D4802A'
    if (r < 0.8) return '#A0522D'
    return '#7A3B18'
  }

  const getTextColor = (count: number) => {
    return count / max >= 0.4 ? '#fff' : '#7A3B18'
  }

  const peakHour = hours.reduce((a, b) => (b.count > a.count ? b : a))

  return (
    <div>
      <div className="grid grid-cols-12 gap-1 mb-2">
        {hours.map(({ h, count, label }) => (
          <div
            key={h}
            className="relative flex flex-col items-center justify-center rounded py-2 cursor-default"
            style={{
              backgroundColor: getColor(count),
              transition: 'transform 0.12s',
              transform: hovered === h ? 'scale(1.15)' : 'scale(1)',
              zIndex: hovered === h ? 10 : 1
            }}
            onMouseEnter={() => setHovered(h)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="text-xs font-bold leading-none" style={{ color: getTextColor(count) }}>
              {count}
            </span>
            <span
              className="text-[9px] leading-none mt-0.5 font-medium"
              style={{ color: getTextColor(count) }}
            >
              {String(h).padStart(2, '0')}
            </span>
            {hovered === h && (
              <div
                className="absolute -top-8 left-1/2 bg-brown-700 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-20 shadow-lg"
                style={{ transform: 'translateX(-50%)' }}
              >
                {label}: {count} order
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-brown-400">
          <span className="font-medium">Sepi</span>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => (
            <div
              key={f}
              className="w-5 h-3 rounded-sm"
              style={{ backgroundColor: getColor(Math.round(f * max)) }}
            />
          ))}
          <span className="font-medium">Ramai</span>
        </div>
        {peakHour.count > 0 && (
          <div className="text-xs text-brown-500 font-medium">
            🔥 Jam puncak: <span className="text-amber-brand font-bold">{peakHour.label}</span> (
            {peakHour.count} order)
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MDR Section ─────────────────────────────────────────────────────────────

function MdrSummary({
  paymentBreakdown,
  grossRevenue
}: {
  paymentBreakdown: PaymentBreakdown[]
  grossRevenue: number
}) {
  const { totalMDR, rows } = useMemo(() => {
    let totalMDR = 0
    const rows = paymentBreakdown.map(({ paymentType, totalAmount, count }) => {
      const rate = MDR_RATES[paymentType] ?? MDR_DEFAULT
      const mdr = totalAmount * rate
      totalMDR += mdr
      return { paymentType, totalAmount, count, rate, mdr }
    })
    return { totalMDR, rows: rows.sort((a, b) => b.totalAmount - a.totalAmount) }
  }, [paymentBreakdown])

  const netRevenue = grossRevenue - totalMDR
  const mdrPct = grossRevenue > 0 ? ((totalMDR / grossRevenue) * 100).toFixed(2) : '0'

  if (paymentBreakdown.length === 0) {
    return (
      <div className="bg-white rounded-[4px] border border-cream-200 p-6 shadow-sm">
        <h3 className="font-serif text-lg font-bold text-brown-700 mb-2">
          💳 Estimasi Net Profit (setelah MDR)
        </h3>
        <p className="text-sm text-brown-300">
          Belum ada data pembayaran digital yang diselesaikan (SETTLEMENT) pada periode ini.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[4px] border border-cream-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-serif text-lg font-bold text-brown-700">
            💳 Estimasi Net Profit (setelah MDR)
          </h3>
          <p className="text-xs text-brown-400 mt-0.5">
            MDR = Merchant Discount Rate Midtrans. Tarif mengacu regulasi BI & kebijakan Midtrans.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            label: 'Pendapatan Kotor',
            value: formatPrice(grossRevenue),
            color: 'text-brown-700',
            bg: 'bg-cream-50'
          },
          {
            label: `Potongan MDR (${mdrPct}%)`,
            value: `– ${formatPrice(totalMDR)}`,
            color: 'text-red-500',
            bg: 'bg-red-50'
          },
          {
            label: 'Estimasi Bersih',
            value: formatPrice(netRevenue),
            color: 'text-green-700',
            bg: 'bg-green-50'
          }
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-lg p-3 border border-cream-200`}>
            <div className="text-xs font-semibold text-brown-400 mb-1">{label}</div>
            <div className={`font-serif text-base font-bold ${color} leading-tight`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Per-method breakdown */}
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-brown-400 uppercase tracking-wider mb-2">
          Rincian per Metode Pembayaran
        </div>
        {rows.map(({ paymentType, totalAmount, count, rate, mdr }) => {
          const pct = grossRevenue > 0 ? (totalAmount / grossRevenue) * 100 : 0
          return (
            <div key={paymentType}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-brown-700">
                    {MDR_LABELS[paymentType] || paymentType.toUpperCase()}
                  </span>
                  <span className="text-xs text-brown-400 bg-cream-100 px-1.5 py-0.5 rounded">
                    MDR {(rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-right text-xs text-brown-400">
                  <span className="text-brown-600 font-medium">{formatPrice(totalAmount)}</span> ·{' '}
                  {count} txn · <span className="text-red-400">–{formatPrice(mdr)}</span>
                </div>
              </div>
              <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-brand rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-cream-200 text-xs text-brown-300">
        * Estimasi berdasarkan tarif MDR standar. Nilai aktual dapat berbeda tergantung kontrak
        merchant dan jenis transaksi.
      </div>
    </div>
  )
}

// ─── Export PDF Button ────────────────────────────────────────────────────────

function ExportPDFButton({
  stats,
  mdrGross,
  mdrDeduction,
  mdrNet,
  currentRange,
  hourlyDistribution
}: {
  stats: {
    revenue: number
    done: number
    total: number
    avgOrder: number
    days: { label: string; revenue: number }[]
    topFlavors: [string, number][]
    byStatus: { s: string; count: number }[]
  }
  mdrGross: number
  mdrDeduction: number
  mdrNet: number
  currentRange: string
  hourlyDistribution: Record<string, number>
}) {
  const [loading, setLoading] = useState(false)

  const STATUS_LABELS: Record<string, string> = {
    done: 'Selesai',
    pending: 'Pending',
    paid: 'Dibayar',
    confirmed: 'Dikonfirmasi',
    ready: 'Siap',
    cancelled: 'Dibatalkan'
  }

  const peakHour = Object.entries(hourlyDistribution).reduce(
    (best, [h, c]) => (c > best.count ? { h: Number(h), count: c } : best),
    { h: 0, count: 0 }
  )

  const handleExport = async () => {
    setLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()
      const rangeLabel =
        currentRange === 'all'
          ? 'Semua Waktu'
          : currentRange === '7'
            ? '7 Hari Terakhir'
            : currentRange === '30'
              ? '30 Hari Terakhir'
              : '3 Bulan Terakhir'

      // Header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(61, 28, 2)
      doc.text('🍌 Laporan Keuangan', 14, 20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(122, 59, 24)
      doc.text('Pisang Van Java', 14, 27)
      doc.setFontSize(9)
      doc.setTextColor(160, 82, 45)
      doc.text(`Periode: ${rangeLabel}`, 14, 33)
      doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`, 14, 38)

      // KPI Summary
      autoTable(doc, {
        startY: 46,
        head: [['Metrik Utama', 'Nilai']],
        body: [
          ['Total Pendapatan Kotor', formatPrice(stats.revenue)],
          ['Pesanan Selesai', `${stats.done} dari ${stats.total} total`],
          ['Rata-rata Nilai Pesanan', formatPrice(stats.avgOrder)],
          ['Estimasi Potongan MDR Midtrans', `– ${formatPrice(mdrDeduction)}`],
          ['Estimasi Pendapatan Bersih', formatPrice(mdrNet)],
          [
            'Jam Puncak Transaksi',
            `${String(peakHour.h).padStart(2, '0')}:00 (${peakHour.count} order)`
          ]
        ],
        theme: 'striped',
        headStyles: { fillColor: [61, 28, 2], textColor: 255 },
        alternateRowStyles: { fillColor: [253, 246, 227] }
      })

      // Revenue by period
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Periode', 'Pendapatan (Rp)']],
        body: stats.days.map((d) => [d.label, formatPrice(d.revenue)]),
        theme: 'striped',
        headStyles: { fillColor: [61, 28, 2], textColor: 255 },
        alternateRowStyles: { fillColor: [253, 246, 227] }
      })

      // Top flavors
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Rasa Terpopuler', 'Jumlah Order']],
        body: stats.topFlavors.map(([name, count]) => [name, String(count)]),
        theme: 'striped',
        headStyles: { fillColor: [61, 28, 2], textColor: 255 },
        alternateRowStyles: { fillColor: [253, 246, 227] }
      })

      // Order status
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Status Order', 'Jumlah']],
        body: stats.byStatus.map(({ s, count }) => [STATUS_LABELS[s] || s, String(count)]),
        theme: 'striped',
        headStyles: { fillColor: [61, 28, 2], textColor: 255 },
        alternateRowStyles: { fillColor: [253, 246, 227] }
      })

      doc.setFontSize(7)
      doc.setTextColor(160, 82, 45)
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.text(
          `Pisang Van Java © ${new Date().getFullYear()} — Laporan ini bersifat rahasia`,
          14,
          doc.internal.pageSize.height - 8
        )
        doc.text(
          `Hal. ${i}/${pageCount}`,
          doc.internal.pageSize.width - 24,
          doc.internal.pageSize.height - 8
        )
      }

      doc.save(`laporan-pvj-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      console.error('Export PDF error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-brown-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-brown-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Membuat PDF...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Ekspor PDF
        </>
      )}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsClient({
  orders,
  totalVariants,
  totalToppings,
  currentRange,
  hourlyDistribution,
  paymentBreakdown
}: Props) {
  const router = useRouter()

  const stats = useMemo(() => {
    const done = orders.filter((o) => o.status === 'done')
    const revenue = done.reduce((s, o) => s + o.totalPrice, 0)
    const avgOrder = done.length ? Math.round(revenue / done.length) : 0

    const byStatus = ['pending', 'paid', 'confirmed', 'ready', 'done', 'cancelled'].map((s) => ({
      s,
      count: orders.filter((o) => o.status === s).length
    }))

    const bySource = ['whatsapp', 'walk-in', 'phone'].map((src) => ({
      src,
      count: orders.filter((o) => o.source === src).length
    }))

    // Revenue by day (last 7 days always shown on the line chart)
    const days: { label: string; date: string; revenue: number }[] = []
    const daysCount = currentRange === 'all' ? 30 : parseInt(currentRange, 10)
    const chartDays = Math.min(daysCount, 30)
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const label =
        chartDays <= 14
          ? d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
          : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      const dayRevenue = done
        .filter((o) => o.createdAt.slice(0, 10) === dateStr)
        .reduce((s, o) => s + o.totalPrice, 0)
      days.push({ label, date: dateStr, revenue: dayRevenue })
    }

    // Top flavors
    const flavorCount: Record<string, number> = {}
    orders.forEach((o) =>
      o.items.forEach((i) => {
        const f = i.variant.flavorName
        flavorCount[f] = (flavorCount[f] || 0) + 1
      })
    )
    const topFlavors = Object.entries(flavorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // WhatsApp analytics
    const waOrders = orders.filter((o) => o.source === 'whatsapp')
    const waTotal = waOrders.length
    const waSuccess = waOrders.filter((o) => !['pending', 'cancelled'].includes(o.status))
    const waSuccessCount = waSuccess.length
    const waConversionRate = waTotal > 0 ? Math.round((waSuccessCount / waTotal) * 100) : 0
    const waAbandoned = waOrders.filter((o) => ['pending', 'cancelled'].includes(o.status))
    const waAbandonedValue = waAbandoned.reduce((s, o) => s + o.totalPrice, 0)

    const variantWAStats: Record<string, { clicks: number; success: number }> = {}
    waOrders.forEach((o) => {
      const isSuccess = !['pending', 'cancelled'].includes(o.status)
      o.items.forEach((i) => {
        const f = i.variant.flavorName
        if (!variantWAStats[f]) variantWAStats[f] = { clicks: 0, success: 0 }
        variantWAStats[f].clicks += 1
        if (isSuccess) variantWAStats[f].success += 1
      })
    })
    const conversionByVariant = Object.entries(variantWAStats)
      .map(([name, s]) => ({
        name,
        clicks: s.clicks,
        success: s.success,
        rate: s.clicks > 0 ? Math.round((s.success / s.clicks) * 100) : 0
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5)

    return {
      revenue,
      avgOrder,
      done: done.length,
      total: orders.length,
      byStatus,
      bySource,
      days,
      topFlavors,
      waTotal,
      waSuccessCount,
      waConversionRate,
      waAbandonedValue,
      conversionByVariant
    }
  }, [orders, currentRange])

  // MDR totals for export
  const mdrTotals = useMemo(() => {
    let totalMDR = 0
    paymentBreakdown.forEach(({ paymentType, totalAmount }) => {
      const rate = MDR_RATES[paymentType] ?? MDR_DEFAULT
      totalMDR += totalAmount * rate
    })
    return { gross: stats.revenue, deduction: totalMDR, net: stats.revenue - totalMDR }
  }, [paymentBreakdown, stats.revenue])

  const STATUS_COLORS: Record<string, string> = {
    done: 'bg-green-500',
    pending: 'bg-yellow-400',
    paid: 'bg-emerald-500',
    confirmed: 'bg-blue-500',
    ready: 'bg-purple-500',
    cancelled: 'bg-red-400'
  }
  const STATUS_LABELS: Record<string, string> = {
    done: 'Selesai',
    pending: 'Pending',
    paid: 'Dibayar',
    confirmed: 'Dikonfirmasi',
    ready: 'Siap',
    cancelled: 'Dibatalkan'
  }

  const lineData = stats.days.map((d) => ({ label: d.label, value: d.revenue }))

  return (
    <>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <div className="text-amber-brand text-xs font-semibold tracking-[0.2em] uppercase mb-1">
            Analytics
          </div>
          <h1 className="font-serif text-2xl font-bold text-brown-700">Laporan & Statistik</h1>
          <p className="text-sm text-brown-400 mt-0.5">Ringkasan performa penjualan</p>
        </div>

        <div className="flex items-center gap-3">
          <ExportPDFButton
            stats={stats}
            mdrGross={mdrTotals.gross}
            mdrDeduction={mdrTotals.deduction}
            mdrNet={mdrTotals.net}
            currentRange={currentRange}
            hourlyDistribution={hourlyDistribution}
          />
          <div className="flex bg-white border border-cream-200 rounded-[4px] p-1 shadow-sm">
            {[
              { value: '7', label: '7 Hari' },
              { value: '30', label: '30 Hari' },
              { value: '90', label: '3 Bulan' },
              { value: 'all', label: 'Semua' }
            ].map((r) => (
              <button
                key={r.value}
                onClick={() => router.push(`?range=${r.value}`)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                  currentRange === r.value
                    ? 'bg-brown-700 text-white shadow'
                    : 'text-brown-500 hover:bg-cream-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total Pendapatan',
            value: formatPrice(stats.revenue),
            icon: '💰',
            sub: 'Dari order selesai'
          },
          {
            label: 'Order Selesai',
            value: stats.done,
            icon: '✅',
            sub: `dari ${stats.total} total`
          },
          {
            label: 'Rata-rata Order',
            value: formatPrice(stats.avgOrder),
            icon: '📊',
            sub: 'Per transaksi'
          },
          {
            label: 'Total Varian',
            value: totalVariants,
            icon: '🍌',
            sub: `+ ${totalToppings} topping`
          }
        ].map(({ label, value, icon, sub }) => (
          <div key={label} className="bg-white rounded-[4px] p-5 border border-cream-200 shadow-sm">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="font-serif text-2xl font-bold text-brown-700">{value}</div>
            <div className="text-xs font-semibold text-brown-500 mt-1">{label}</div>
            <div className="text-xs text-brown-300 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Revenue Line Chart ─────────────────────────────────────────── */}
      <div className="bg-white rounded-[4px] border border-cream-200 p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-bold text-brown-700">📈 Tren Pendapatan</h3>
          <span className="text-xs text-brown-400 bg-cream-100 px-2 py-1 rounded font-medium">
            {currentRange === 'all' ? '30 Hari Terakhir' : `${currentRange} Hari`}
          </span>
        </div>
        {lineData.every((d) => d.value === 0) ? (
          <p className="text-center text-sm text-brown-300 py-12">
            Belum ada data pendapatan pada periode ini
          </p>
        ) : (
          <LineChart data={lineData} />
        )}
      </div>

      {/* ── Status + Source ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Order Status Breakdown */}
        <div className="bg-white rounded-[4px] border border-cream-200 p-6 shadow-sm">
          <h3 className="font-serif text-lg font-bold text-brown-700 mb-4">📋 Status Order</h3>
          <div className="space-y-3">
            {stats.byStatus.map(({ s, count }) => {
              const pct = stats.total ? Math.round((count / stats.total) * 100) : 0
              return (
                <div key={s}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-brown-600">{STATUS_LABELS[s]}</span>
                    <span className="text-brown-400">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-cream-200 rounded-[4px] overflow-hidden">
                    <div
                      className={`h-full rounded-[4px] transition-all duration-500 ${STATUS_COLORS[s]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Order Source */}
        <div className="bg-white rounded-[4px] border border-cream-200 p-6 shadow-sm">
          <h3 className="font-serif text-lg font-bold text-brown-700 mb-4">📱 Sumber Order</h3>
          <div className="space-y-4">
            {[
              { src: 'whatsapp', icon: '💬', label: 'WhatsApp', color: 'bg-green-500' },
              { src: 'walk-in', icon: '🚶', label: 'Walk-in', color: 'bg-blue-500' },
              { src: 'phone', icon: '📞', label: 'Telepon', color: 'bg-purple-500' }
            ].map(({ src, icon, label, color }) => {
              const count = stats.bySource.find((b) => b.src === src)?.count || 0
              const pct = stats.total ? Math.round((count / stats.total) * 100) : 0
              return (
                <div key={src} className="flex items-center gap-4">
                  <span className="text-2xl">{icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-brown-700">{label}</span>
                      <span className="text-brown-400">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-cream-200 rounded-[4px] overflow-hidden">
                      <div
                        className={`h-full rounded-[4px] ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Top Flavors ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-[4px] border border-cream-200 p-6 shadow-sm mb-6">
        <h3 className="font-serif text-lg font-bold text-brown-700 mb-4">🍌 Rasa Terpopuler</h3>
        {stats.topFlavors.length === 0 ? (
          <p className="text-sm text-brown-300">Belum ada data</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.topFlavors.map(([name, count], i) => (
              <div key={name} className="flex items-center gap-3 bg-cream-50 rounded-lg p-3">
                <span className="font-serif text-2xl font-bold text-amber-brand w-8 text-center">
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-brown-700 text-sm truncate">{name}</div>
                  <div className="text-xs text-brown-400 mt-0.5">{count} order</div>
                  <div className="h-1.5 bg-cream-200 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-amber-brand rounded-full"
                      style={{ width: `${(count / (stats.topFlavors[0]?.[1] || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Peak Hours Heatmap ─────────────────────────────────────────── */}
      <div className="bg-white rounded-[4px] border border-cream-200 p-6 shadow-sm mb-6">
        <div className="mb-4">
          <h3 className="font-serif text-lg font-bold text-brown-700">🕐 Jam Puncak Transaksi</h3>
          <p className="text-xs text-brown-400 mt-0.5">
            Jumlah order per jam. Hover pada sel untuk detail.
          </p>
        </div>
        <PeakHoursHeatmap distribution={hourlyDistribution} />
      </div>

      {/* ── MDR Net Profit ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <MdrSummary paymentBreakdown={paymentBreakdown} grossRevenue={stats.revenue} />
      </div>

      {/* ── WhatsApp Analytics ─────────────────────────────────────────── */}
      <div className="mt-2 mb-6">
        <div className="text-[#25D366] text-xs font-semibold tracking-[0.2em] uppercase mb-1">
          WhatsApp Intelligence
        </div>
        <h2 className="font-serif text-2xl font-bold text-brown-700">Analisis Konversi WhatsApp</h2>
        <p className="text-sm text-brown-400 mt-0.5">
          Lacak tingkat keberhasilan dari klik tombol WA hingga transfer.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex flex-col gap-4">
          {[
            {
              label: 'Total Klik WA',
              value: stats.waTotal,
              icon: '🖱️',
              border: 'border-cream-200',
              bg: '',
              valColor: 'text-brown-700',
              sub: null
            },
            {
              label: 'Berhasil (Konversi)',
              icon: '🎉',
              border: 'border-green-200',
              bg: 'bg-green-50/30',
              valColor: 'text-green-600',
              value: stats.waSuccessCount,
              sub: `${stats.waConversionRate}% konversi`
            },
            {
              label: 'Potensi Hilang (Ghosting)',
              icon: '👻',
              border: 'border-red-200',
              bg: 'bg-red-50/30',
              valColor: 'text-red-600',
              value: formatPrice(stats.waAbandonedValue),
              sub: null
            }
          ].map(({ label, value, icon, border, bg, valColor, sub }) => (
            <div
              key={label}
              className={`bg-white rounded-[4px] p-5 border ${border} shadow-sm flex items-center justify-between ${bg}`}
            >
              <div>
                <div className="text-xs font-semibold text-brown-500 uppercase tracking-wider mb-1">
                  {label}
                </div>
                <div className={`font-serif text-2xl font-bold ${valColor}`}>{value}</div>
                {sub && (
                  <div className="text-sm font-bold text-green-500 bg-green-100 px-2 py-0.5 rounded-[4px] inline-block mt-1">
                    {sub}
                  </div>
                )}
              </div>
              <div className="text-3xl">{icon}</div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 bg-white rounded-[4px] border border-cream-200 p-6 shadow-sm">
          <h3 className="font-serif text-lg font-bold text-brown-700 mb-4">
            🎯 Konversi per Varian Menu
          </h3>
          {stats.conversionByVariant.length === 0 ? (
            <p className="text-sm text-brown-300">Belum ada data konversi WA.</p>
          ) : (
            <div className="space-y-4">
              {stats.conversionByVariant.map((v) => (
                <div key={v.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-brown-700">{v.name}</span>
                    <div className="flex gap-4 text-xs font-medium">
                      <span className="text-brown-400">{v.clicks} Klik</span>
                      <span className="text-green-600 w-16 text-right">{v.rate}% Sukses</span>
                    </div>
                  </div>
                  <div className="h-3 bg-cream-200 rounded-[4px] overflow-hidden flex relative">
                    <div
                      className="h-full bg-green-500 rounded-[4px] z-10 transition-all duration-500"
                      style={{ width: `${v.rate}%` }}
                    />
                    <div
                      className="h-full bg-[#D4802A]/40 absolute top-0 left-0 transition-all duration-500"
                      style={{
                        width: `${(v.clicks / Math.max(1, stats.conversionByVariant[0]?.clicks)) * 100}%`
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-brown-400 mt-1 text-right">
                    Warna pudar: Volume Klik | Hijau: Sukses
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
