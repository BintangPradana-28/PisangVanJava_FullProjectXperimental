import { redirect } from 'next/navigation'
import { auth } from '@/src/auth'
import ApiDocsClient from './ApiDocsClient'

export const metadata = {
  title: 'Dokumentasi API | Van Java'
}

export default async function ApiDocsPage() {
  const session = await auth()

  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    redirect('/member-login')
  }

  return <ApiDocsClient />
}
