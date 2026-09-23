import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Safaricom Daraja calls this URL after an STK push attempt completes
 * (success or failure/cancel). This route MUST always respond 200 with
 * the expected JSON shape, or Safaricom will retry aggressively.
 *
 * We match the payment back to an order using CheckoutRequestID, which
 * is stored on the payment row the moment the STK push is initiated
 * (see /api/orders/[orderId]/pay). This is a reliable 1:1 match — no
 * guessing by phone/amount/time window.
 */

interface DarajaCallbackBody {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>;
      };
    };
  };
}

export async function POST(request: NextRequest) {
  const body: DarajaCallbackBody = await request.json();
  const supabase = createServiceClient();

  try {
    const callback = body.Body.stkCallback;
    const items = callback.CallbackMetadata?.Item ?? [];

    const getValue = (name: string) =>
      items.find((i) => i.Name === name)?.Value;

    const amount = getValue("Amount") as number | undefined;
    const mpesaReceiptNumber = getValue("MpesaReceiptNumber") as
      | string
      | undefined;
    const transactionDate = getValue("TransactionDate") as number | undefined;
    const phoneNumber = getValue("PhoneNumber") as number | undefined;

    const { data: matchedPayment } = await supabase
      .from("payments")
      .select("payment_id, order_id")
      .eq("mpesa_checkout_request_id", callback.CheckoutRequestID)
      .single();

    if (!matchedPayment) {
      // No matching payment row — log for manual reconciliation. This
      // should only happen if the callback URL is hit directly/out of
      // band, since the pay route always stores CheckoutRequestID first.
      console.error(
        "M-Pesa callback with no matching CheckoutRequestID:",
        callback.CheckoutRequestID,
        JSON.stringify(body)
      );
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (callback.ResultCode === 0 && amount && mpesaReceiptNumber) {
      await supabase
        .from("payments")
        .update({
          status: "completed",
          mpesa_receipt_number: mpesaReceiptNumber,
          mpesa_transaction_date: parseMpesaTimestamp(transactionDate),
          phone_number_used: phoneNumber?.toString(),
          raw_callback_payload: body,
        })
        .eq("payment_id", matchedPayment.payment_id);

      // Auto-confirm the order now that payment has cleared
      await supabase
        .from("orders")
        .update({ status: "confirmed" })
        .eq("order_id", matchedPayment.order_id)
        .eq("status", "pending");
    } else {
      // Payment failed or was cancelled by the user on their phone.
      await supabase
        .from("payments")
        .update({
          status: "failed",
          raw_callback_payload: body,
        })
        .eq("payment_id", matchedPayment.payment_id);
    }
  } catch (err) {
    console.error("Error processing M-Pesa callback:", err);
    // Still return 200 below — Safaricom doesn't care about our internal
    // errors, and retries won't help if our own code has a bug.
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}

function parseMpesaTimestamp(ts?: number): string | null {
  if (!ts) return null;
  const str = ts.toString();
  const year = str.slice(0, 4);
  const month = str.slice(4, 6);
  const day = str.slice(6, 8);
  const hour = str.slice(8, 10);
  const min = str.slice(10, 12);
  const sec = str.slice(12, 14);
  return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
}
