import { Document, Page, renderToStream, StyleSheet, Text, View } from '@react-pdf/renderer'
import { NextResponse } from 'next/server'
import React from 'react'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'

// Create styles
const styles = StyleSheet.create({
  page: { flexDirection: 'column', padding: 30, fontFamily: 'Helvetica' },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#d97706',
    fontWeight: 'bold'
  },
  section: { marginBottom: 20 },
  text: { fontSize: 12, marginBottom: 5, color: '#333' },
  bold: { fontSize: 12, fontWeight: 'bold', color: '#000' },
  table: { display: 'flex', flexDirection: 'column', marginTop: 10 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
    paddingBottom: 8,
    paddingTop: 8
  },
  tableColWide: { width: '60%' },
  tableCol: { width: '20%', textAlign: 'right' },
  tableColCenter: { width: '20%', textAlign: 'center' }
})

// Create Document Component
const Invoice = ({ order }: { order: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>PISANG VAN JAVA</Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
        <View>
          <Text style={styles.bold}>INVOICE KEPADA:</Text>
          <Text style={styles.text}>{order.customerName}</Text>
          {order.user?.email && <Text style={styles.text}>{order.user.email}</Text>}
          <Text style={styles.text}>{order.customerPhone || '-'}</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={styles.bold}>DETAIL ORDER:</Text>
          <Text style={styles.text}>Order ID: #{order.id.slice(-8).toUpperCase()}</Text>
          <Text style={styles.text}>
            Tanggal: {new Date(order.createdAt).toLocaleDateString('id-ID')}
          </Text>
          <Text style={styles.text}>Metode: {order.deliveryMethod}</Text>
          <Text style={styles.text}>Status: {order.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View
          style={[
            styles.tableRow,
            { backgroundColor: '#f8f9fa', borderTopWidth: 1, borderTopColor: '#eee' }
          ]}
        >
          <View style={styles.tableColWide}>
            <Text style={styles.bold}>Item</Text>
          </View>
          <View style={styles.tableColCenter}>
            <Text style={styles.bold}>Qty</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.bold}>Subtotal</Text>
          </View>
        </View>

        {order.items.map((item: any, i: number) => (
          <View style={styles.tableRow} key={i}>
            <View style={styles.tableColWide}>
              <Text style={styles.text}>
                {item.variant.flavorName} ({item.baseType})
              </Text>
              {item.toppings && item.toppings.length > 0 && (
                <Text style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                  + {item.toppings.map((t: any) => t.name).join(', ')}
                </Text>
              )}
            </View>
            <View style={styles.tableColCenter}>
              <Text style={styles.text}>{item.quantity}</Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={styles.text}>Rp {item.subtotal.toLocaleString('id-ID')}</Text>
            </View>
          </View>
        ))}

        <View style={[styles.tableRow, { borderBottomWidth: 0, marginTop: 10 }]}>
          <View style={styles.tableColWide}>
            <Text style={styles.bold}>Ongkos Kirim</Text>
          </View>
          <View style={styles.tableColCenter}>
            <Text style={styles.text}></Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.text}>Rp {order.deliveryFee.toLocaleString('id-ID')}</Text>
          </View>
        </View>

        {order.discountAmount > 0 && (
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <View style={styles.tableColWide}>
              <Text style={[styles.bold, { color: '#16a34a' }]}>Diskon</Text>
            </View>
            <View style={styles.tableColCenter}>
              <Text style={styles.text}></Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={[styles.text, { color: '#16a34a' }]}>
                -Rp {order.discountAmount.toLocaleString('id-ID')}
              </Text>
            </View>
          </View>
        )}

        <View
          style={[styles.tableRow, { borderTopWidth: 2, borderTopColor: '#333', marginTop: 5 }]}
        >
          <View style={styles.tableColWide}>
            <Text style={[styles.bold, { fontSize: 14 }]}>TOTAL BAYAR</Text>
          </View>
          <View style={styles.tableColCenter}>
            <Text style={styles.text}></Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={[styles.bold, { fontSize: 14 }]}>
              Rp {order.totalPrice.toLocaleString('id-ID')}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 50, textAlign: 'center' }}>
        <Text style={{ fontSize: 10, color: '#888' }}>
          Terima kasih atas pesanan Anda di Pisang Van Java.
        </Text>
      </View>
    </Page>
  </Document>
)

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: { variant: true, toppings: true }
        }
      }
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const fileName = `invoice-${id}.pdf`

    // 1. Try to fetch from Supabase Storage first
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('invoices')
        .download(fileName)

      if (fileData && !downloadError) {
        const arrayBuffer = await fileData.arrayBuffer()
        return new NextResponse(new Uint8Array(arrayBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="invoice-${order.id.slice(-8)}.pdf"`
          }
        })
      }
    } catch (storageErr) {
      console.warn('Supabase storage fetch failed, generating dynamically:', storageErr)
    }

    // 2. If not found in storage, render dynamically
    const stream = await renderToStream(<Invoice order={order} />)

    // Convert Node stream to Buffer
    const chunks: Uint8Array[] = []
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', (err) => reject(err))
    })

    // 3. Upload to Supabase Storage for caching
    try {
      // Ensure bucket exists (just in case)
      await supabase.storage.createBucket('invoices', { public: true })
    } catch (bucketErr) {
      // Ignore if bucket already exists
    }

    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('Failed to cache invoice in Supabase Storage:', uploadError.message)
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${order.id.slice(-8)}.pdf"`
      }
    })
  } catch (err: any) {
    console.error('Invoice error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
