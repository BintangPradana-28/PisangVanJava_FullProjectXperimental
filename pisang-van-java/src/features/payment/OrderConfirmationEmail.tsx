import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from '@react-email/components'
import * as React from 'react'

interface OrderConfirmationEmailProps {
  customerName: string
  orderId: string
  items: {
    name: string
    qty: number
    subtotal: string
  }[]
  deliveryFee: string
  discount: string | null
  totalPrice: string
  deliveryMethod: string
}

export const OrderConfirmationEmail = ({
  customerName,
  orderId,
  items,
  deliveryFee,
  discount,
  totalPrice,
  deliveryMethod,
}: OrderConfirmationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Pesanan #{orderId} sedang diproses</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Pisang Van Java</Heading>
          <Text style={text}>Halo <strong>{customerName}</strong>,</Text>
          <Text style={text}>
            Terima kasih atas pesanan Anda. Pembayaran Anda telah kami terima dan pesanan Anda sedang <strong>diproses</strong>.
          </Text>

          <Section style={section}>
            <Text style={sectionTitle}>Detail Pesanan (#{orderId})</Text>
            {items.map((item, i) => (
              <Row key={i} style={itemRow}>
                <Column style={itemColLeft}>
                  <Text style={itemText}><strong>{item.name}</strong></Text>
                  <Text style={itemQty}>Qty: {item.qty}</Text>
                </Column>
                <Column style={itemColRight}>
                  <Text style={itemText}>{item.subtotal}</Text>
                </Column>
              </Row>
            ))}
            <Hr style={hr} />
            <Row style={totalRow}>
              <Column style={itemColLeft}><Text style={itemText}>Ongkir / Biaya</Text></Column>
              <Column style={itemColRight}><Text style={itemText}>{deliveryFee}</Text></Column>
            </Row>
            {discount && (
              <Row style={totalRow}>
                <Column style={itemColLeft}><Text style={itemTextSuccess}>Diskon</Text></Column>
                <Column style={itemColRight}><Text style={itemTextSuccess}>-{discount}</Text></Column>
              </Row>
            )}
            <Hr style={hr} />
            <Row style={totalRow}>
              <Column style={itemColLeft}><Text style={totalText}>Total</Text></Column>
              <Column style={itemColRight}><Text style={totalText}>{totalPrice}</Text></Column>
            </Row>
          </Section>

          <Text style={text}>
            <strong>Pengiriman:</strong> {deliveryMethod === 'DELIVERY' ? 'Diantar ke alamat tujuan' : 'Ambil di toko (Pickup)'}
          </Text>
          <Text style={footer}>
            Anda dapat melacak pesanan Anda secara real-time melalui website kami.<br />
            Salam hangat,<br />
            <strong>Pisang Van Java</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif' }
const container = { margin: '0 auto', padding: '20px 0 48px', width: '580px' }
const h1 = { color: '#d97706', fontSize: '24px', fontWeight: 'bold', margin: '40px 0', padding: '0' }
const text = { color: '#333', fontSize: '16px', lineHeight: '24px' }
const section = { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '24px', margin: '24px 0' }
const sectionTitle = { fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }
const itemRow = { marginBottom: '12px' }
const itemColLeft = { width: '70%' }
const itemColRight = { width: '30%', textAlign: 'right' as const }
const itemText = { margin: '0', color: '#333', fontSize: '14px' }
const itemTextSuccess = { margin: '0', color: '#16a34a', fontSize: '14px' }
const itemQty = { margin: '4px 0 0', color: '#666', fontSize: '12px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const totalRow = { marginBottom: '8px' }
const totalText = { margin: '0', color: '#111', fontSize: '16px', fontWeight: 'bold' }
const footer = { color: '#898989', fontSize: '14px', lineHeight: '22px', marginTop: '32px' }

export default OrderConfirmationEmail
