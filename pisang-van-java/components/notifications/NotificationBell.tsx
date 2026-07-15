'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface NotificationItem {
  id: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
}

interface NotificationBellProps {
  useSolidHeader: boolean
}

export default function NotificationBell({ useSolidHeader }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      const json = await res.json()
      if (json.success) {
        setNotifications(json.data.notifications)
        setUnreadCount(json.data.unreadCount)
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpen = () => {
    const next = !isOpen
    setIsOpen(next)
    if (next) fetchNotifications()
  }

  const handleMarkOneRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    } catch {
      // Non-fatal: local state already updated optimistically.
    }
  }

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await fetch('/api/notifications', { method: 'PATCH' })
    } catch {
      console.error('Failed to mark all notifications as read')
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleOpen}
        className={`relative p-2 rounded-[6px] transition-all focus:outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
          useSolidHeader ? 'text-zinc-700 dark:text-zinc-200' : 'text-white'
        }`}
        aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">
              Notifikasi
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-secondary hover:underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {loading && notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-zinc-400">Memuat...</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-zinc-400">Belum ada notifikasi</div>
          ) : (
            notifications.map((n) => {
              const content = (
                <div
                  className={`px-4 py-3 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 ${
                    n.isRead ? '' : 'bg-secondary/5'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5 shrink-0" />
                    )}
                    <div className={n.isRead ? 'ml-3.5' : ''}>
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                        {n.title}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        {new Date(n.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )

              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => {
                    if (!n.isRead) handleMarkOneRead(n.id)
                    setIsOpen(false)
                  }}
                  className="block hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.isRead && handleMarkOneRead(n.id)}
                  className="block w-full text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  {content}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
