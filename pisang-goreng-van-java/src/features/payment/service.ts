import crypto from 'crypto';

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
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
    const baseUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    // Zero-Trust: Validate gross amount against items
    const calculatedGross = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (Math.abs(calculatedGross - params.grossAmount) > 1) {
      console.error('[SECURITY] Midtrans amount mismatch', { calculatedGross, grossAmount: params.grossAmount });
      return null;
    }

    const payload = {
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
        finish: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`,
      }
    };

    const authString = Buffer.from(`${serverKey}:`).toString('base64');

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error('[SECURITY] Midtrans API Error', errorData);
      return null;
    }

    const data = await res.json();
    return data.token;
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
