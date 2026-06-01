import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface ReceiptEmailProps {
  orderId: string
  total: number
  customerName?: string
}

export const ReceiptEmail = ({
  orderId = 'ORD-000',
  total = 0,
  customerName = 'Pelanggan',
}: ReceiptEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Struk Pesanan Pisang Van Java - {orderId}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Terima Kasih, {customerName}!</Heading>
          <Text style={text}>
            Pesanan Anda dengan nomor referensi <strong>{orderId}</strong> telah
            berhasil kami terima dan sedang diproses.
          </Text>
          <Text style={text}>
            Total Pembayaran: <strong>Rp {total.toLocaleString('id-ID')}</strong>
          </Text>
          <Text style={footer}>
            Pisang Van Java - Cita Rasa Pisang Goreng Nusantara
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ReceiptEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  width: '580px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '40px',
  margin: '0 0 20px',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 10px',
}

const footer = {
  color: '#898989',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '20px 0 0',
  textAlign: 'center' as const,
}
