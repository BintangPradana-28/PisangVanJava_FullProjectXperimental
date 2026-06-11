import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
  Link,
} from '@react-email/components'
import * as React from 'react'

interface OrderStatusEmailProps {
  customerName: string
  orderId: string
  status: string // 'PROCESSING' | 'READY' | 'COMPLETED' | 'CANCELED'
}

const STATUS_DETAILS: Record<string, {
  preview: string
  title: string
  emoji: string
  description: string
  buttonText?: string
}> = {
  PROCESSING: {
    preview: 'Pesanan Anda sedang diproses oleh dapur',
    title: 'Pesanan Sedang Diproses 🍳',
    emoji: '🍳',
    description: 'Kabar baik! Dapur kami telah menerima pesanan Anda dan saat ini sedang mempersiapkannya dengan bahan-bahan premium terbaik. Kami akan memberitahu Anda kembali jika pesanan sudah siap.',
  },
  READY: {
    preview: 'Pesanan Anda siap diambil / diantar!',
    title: 'Pesanan Siap! 🎉',
    emoji: '🎉',
    description: 'Hore! Pesanan Anda sudah siap disajikan. Jika Anda memilih metode Pickup, silakan datang ke outlet kami. Jika Anda memilih metode Delivery, kurir kami akan segera mengantarkannya ke alamat Anda.',
  },
  COMPLETED: {
    preview: 'Terima kasih telah memesan di Pisang Van Java',
    title: 'Pesanan Selesai! 🍌',
    emoji: '🍌',
    description: 'Terima kasih telah menikmati Pisang Goreng Van Java! Kami harap Anda menyukai hidangan kami. Bagikan ulasan Anda di website kami untuk membantu kami terus meningkatkan kualitas pelayanan.',
    buttonText: 'Berikan Ulasan Anda',
  },
  CANCELED: {
    preview: 'Informasi pembatalan pesanan Anda',
    title: 'Pesanan Dibatalkan ❌',
    emoji: '❌',
    description: 'Pesanan Anda telah dibatalkan. Jika Anda merasa ini adalah kesalahan atau memerlukan informasi lebih lanjut mengenai pengembalian dana, silakan hubungi layanan pelanggan kami via WhatsApp.',
  }
}

export const OrderStatusEmail = ({
  customerName,
  orderId,
  status,
}: OrderStatusEmailProps) => {
  const details = STATUS_DETAILS[status] || {
    preview: `Pembaruan status pesanan #${orderId}`,
    title: `Pembaruan Pesanan: ${status}`,
    emoji: '🔔',
    description: `Status pesanan Anda telah diperbarui menjadi ${status}.`,
  }

  const trackLink = `https://pisangvanjava.com/track-order` // Production URL fallback

  return (
    <Html>
      <Head />
      <Preview>{details.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Pisang Van Java</Heading>
          <Text style={text}>
            Halo <strong>{customerName}</strong>,
          </Text>
          
          <Section style={section}>
            <Text style={h2}>
              <span style={emoji}>{details.emoji}</span> {details.title}
            </Text>
            <Text style={orderIdText}>ID Pesanan: #{orderId.toUpperCase()}</Text>
            <Text style={descriptionText}>{details.description}</Text>
          </Section>

          <Text style={text}>
            Anda dapat selalu memantau status pesanan Anda secara langsung di halaman tracking kami.
          </Text>

          <Section style={buttonContainer}>
            <Link
              style={button}
              href={trackLink}
            >
              {details.buttonText || 'Pantau Status Pesanan 🛵'}
            </Link>
          </Section>

          <Text style={footer}>
            Ada pertanyaan? Hubungi kami langsung via WhatsApp CS.
            <br />
            Salam hangat,
            <br />
            <strong>Pisang Van Java</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}
const container = { margin: '0 auto', padding: '20px 0 48px', width: '580px' }
const h1 = {
  color: '#d97706',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '30px 0 20px',
  padding: '0',
}
const h2 = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#111827',
  margin: '0 0 10px 0',
}
const text = { color: '#374151', fontSize: '15px', lineHeight: '24px' }
const emoji = { marginRight: '8px' }
const orderIdText = {
  fontSize: '13px',
  color: '#6b7280',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
  fontFamily: 'monospace',
}
const descriptionText = {
  color: '#4b5563',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0',
}
const section = {
  backgroundColor: '#f9fafb',
  borderRadius: '16px',
  border: '1px solid #f3f4f6',
  padding: '24px',
  margin: '24px 0',
}
const buttonContainer = {
  textAlign: 'center' as const,
  margin: '30px 0',
}
const button = {
  backgroundColor: '#d97706',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
}
const footer = { color: '#9ca3af', fontSize: '13px', lineHeight: '22px', marginTop: '32px' }

export default OrderStatusEmail
