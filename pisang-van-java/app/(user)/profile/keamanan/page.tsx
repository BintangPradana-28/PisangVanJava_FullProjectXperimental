import { redirect } from 'next/navigation'
import { getActiveSessions } from '@/app/actions/security'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import SecurityClient from './SecurityClient'

export const metadata = {
  title: 'Notifikasi & Keamanan | Pisang Goreng Van Java'
}

export default async function KeamananPage({
  searchParams
}: {
  searchParams: Promise<{ require2fa?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/member-login')
  }

  const { require2fa } = await searchParams

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      notificationPrefs: true,
      twoFactorEnabled: true,
      passwordHash: true // Untuk mengecek apakah user punya password (bukan Oauth only)
    }
  })

  if (!user) redirect('/member-login')

  let activeSessions: any[] = []
  try {
    activeSessions = await getActiveSessions()
  } catch (err) {
    console.error('Gagal mengambil active sessions', err)
  }

  // Parse notification prefs
  let notificationPrefs = { email: true, push: false, promo: true, order: true }
  if (user.notificationPrefs) {
    try {
      if (typeof user.notificationPrefs === 'string') {
        notificationPrefs = JSON.parse(user.notificationPrefs)
      } else {
        notificationPrefs = user.notificationPrefs as any
      }
    } catch (_e) {}
  }

  return (
    <div className="w-full">
      <SecurityClient
        initialPrefs={notificationPrefs}
        twoFactorEnabled={user.twoFactorEnabled}
        activeSessions={activeSessions}
        hasPassword={!!user.passwordHash}
        mandatory2FASetup={require2fa === '1' && !user.twoFactorEnabled}
      />
    </div>
  )
}
