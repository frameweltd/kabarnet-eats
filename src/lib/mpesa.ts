/**
 * M-Pesa Daraja API integration (STK Push).
 *
 * Requires these environment variables (see .env.example):
 *   MPESA_CONSUMER_KEY
 *   MPESA_CONSUMER_SECRET
 *   MPESA_SHORTCODE          (your Paybill/Till number)
 *   MPESA_PASSKEY            (Lipa Na M-Pesa Online passkey from Daraja)
 *   MPESA_CALLBACK_URL       (your deployed /api/mpesa/callback URL)
 *   MPESA_ENV                "sandbox" | "production"
 *
 * Get these from https://developer.safaricom.co.ke after registering
 * an app. Sandbox works for testing without a real Paybill.
 */

const BASE_URLS = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

function getBaseUrl() {
  const env = process.env.MPESA_ENV === "production" ? "production" : "sandbox";
  return BASE_URLS[env];
}

async function getAccessToken(): Promise<string> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY!;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
    "base64"
  );

  const res = await fetch(
    `${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
    }
  );

  if (!res.ok) {
    throw new Error(`M-Pesa auth failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

export interface StkPushParams {
  phoneNumber: string; // format: 2547XXXXXXXX
  amount: number;
  orderId: string;
  accountReference?: string;
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
}

export async function initiateStkPush({
  phoneNumber,
  amount,
  orderId,
  accountReference = "KabarnetEats",
}: StkPushParams): Promise<StkPushResult> {
  const accessToken = await getAccessToken();
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const ts = timestamp();
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString(
    "base64"
  );

  const res = await fetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: phoneNumber,
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountReference,
      TransactionDesc: `Order ${orderId.slice(0, 8)}`,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.errorMessage || "STK push failed");
  }

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
  };
}

/**
 * Normalizes Kenyan phone numbers to the 2547XXXXXXXX format Daraja expects.
 * Accepts 07XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX.
 */
export function normalizeKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}
