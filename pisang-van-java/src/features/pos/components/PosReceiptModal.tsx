'use client'
import { useEffect } from 'react'
import type { CartItem } from '../types'
import type { Topping } from './PosModifierModal'

export interface ReceiptData {
  orderId?: string
  date: Date
  items: CartItem[]
  totalPrice: number
  paymentMethod: 'CASH' | 'QRIS'
  cashierName: string
}

interface PosReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  data: ReceiptData | null
}

export default function PosReceiptModal({ isOpen, onClose, data }: PosReceiptModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !data) return null

  const formatRupiah = (num: number) => `Rp ${num.toLocaleString('id-ID')}`
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* 
        Print specific CSS isolation. 
        Forces only the receipt to be printed and hides the rest of the POS UI.
      */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-receipt, #printable-receipt * { visibility: visible !important; }
          #printable-receipt { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 58mm; /* Thermal printer standard */
            margin: 0; 
            padding: 0; 
          }
          @page { margin: 0; }
        }
      `}</style>

      {/* Backdrop (hidden during print) */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center print:hidden"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] w-full max-w-sm print:hidden">
        {/* Modal Header */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Cetak Struk</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-bold text-xl">
            &times;
          </button>
        </div>

        {/* Receipt Preview Area */}
        <div className="p-6 overflow-y-auto bg-gray-100 flex justify-center">
          {/* THE ACTUAL RECEIPT (Printable Area) */}
          <div
            id="printable-receipt"
            className="bg-white p-4 shadow-sm w-full max-w-[300px] text-black font-mono text-[12px] leading-tight"
          >
            <div className="text-center mb-4">
              <h2 className="font-bold text-lg mb-1">PISANG VAN JAVA</h2>
              <p>Jl. Heritage No. 1, Bandung</p>
              <p>Telp: 0812-3456-7890</p>
            </div>

            <div className="border-t border-dashed border-gray-400 py-2 mb-2">
              <div className="flex justify-between mb-1">
                <span>Waktu:</span>
                <span>{formatDate(data.date)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Kasir:</span>
                <span>{data.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Metode:</span>
                <span>{data.paymentMethod}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
              <table className="w-full">
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1">
                        <div>{item.product.flavorName}</div>
                        <div className="text-[10px] text-gray-600">
                          {item.quantity}x @ {formatRupiah(item.subtotal / item.quantity)}
                        </div>
                        {item.toppings && item.toppings.length > 0 ? (
                          <div className="text-[10px] text-gray-600">
                            + {item.toppings.map((t: Topping) => t.name).join(', ')}
                          </div>
                        ) : item.topping ? (
                          <div className="text-[10px] text-gray-600">+ {item.topping.name}</div>
                        ) : null}
                      </td>
                      <td className="py-1 text-right font-semibold">
                        {formatRupiah(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-dashed border-gray-400 pt-2 mb-4">
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL:</span>
                <span>{formatRupiah(data.totalPrice)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-gray-600">
              <p>Terima Kasih Atas Kunjungan Anda!</p>
              <p className="mt-1">pisangvanjava.com</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-3 bg-white">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            <span>🖨️</span> Cetak Struk
          </button>
        </div>
      </div>
    </>
  )
}
