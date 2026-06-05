import crypto from 'crypto';
import midtransClient from 'midtrans-client';

interface MidtransItem {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

interface GenerateSnapTokenParams {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerPhone: string;
  items: MidtransItem[];
}

export async function generateSnapToken(params: GenerateSnapTokenParams): Promise<string | null> {
  try {
    const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';

    // Zero-Trust: Validate gross amount against items
    const calculatedGross = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (Math.abs(calculatedGross - params.grossAmount) > 1) {
      console.error('[SECURITY] Midtrans amount mismatch', { calculatedGross, grossAmount: params.grossAmount });
      return null;
    }

    let snap = new midtransClient.Snap({
      isProduction: isProduction,
      serverKey: process.env.MIDTRANS_SERVER_KEY || '',
      clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
    });

    const requestData = {
      transaction_details: {
        order_id: params.orderId,
        gross_amount: Math.round(params.grossAmount), // Midtrans expects integer
      },
      customer_details: {
        first_name: params.customerName.slice(0, 255), // Midtrans max len
        phone: params.customerPhone.slice(0, 255),
      },
      item_details: params.items.map(item => ({
        id: item.id.slice(0, 50), // Midtrans max len
        price: Math.round(item.price),
        quantity: item.quantity,
        name: item.name.slice(0, 50),
      })),
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_SITE_URL}/thanks`,
      }
    };

    console.log("[MIDTRANS] requestData payload:", requestData);

    const transaction = await snap.createTransaction(requestData);
    return transaction.token;
  } catch (error) {
    console.error('[SECURITY] Failed to generate Snap Token', error);
    return null;
  }
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const calculatedSignature = crypto.createHash('sha512').update(payload).digest('hex');
  return calculatedSignature === signatureKey;
}
