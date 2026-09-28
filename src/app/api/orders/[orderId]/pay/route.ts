import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { initiateStkPush, normalizeKenyanPhone } from "@/lib/mpesa";

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { phoneNumber } = await request.json();
  if (!phoneNumber) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  // Confirm the order belongs to this customer and load the amount
  // server-side. Never trust a client-supplied amount for a payment request.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("order_id, customer_id, total_amount")
    .eq("order_id", params.orderId)
    .eq("customer_id", user.id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const normalizedPhone = normalizeKenyanPhone(phoneNumber);

    const result = await initiateStkPush({
      phoneNumber: normalizedPhone,
      amount: (order as { total_amount: number }).total_amount,
      orderId: (order as { order_id: string }).order_id,
    });

    // Store the CheckoutRequestID against the payment row so the M-Pesa
    // callback can match it reliably. This MUST use the service-role client:
    // the payments UPDATE policy only allows admins, so a customer-session
    // update would be silently rejected by RLS and the callback would never
    // be able to find this payment. Safe here because ownership of the order
    // was already verified above.
    const admin = createServiceClient();
    const { error: updateError } = await admin
      .from("payments")
      .update({
        mpesa_checkout_request_id: result.checkoutRequestId,
        phone_number_used: normalizedPhone,
      })
      .eq("order_id", params.orderId)
      .eq("method", "mpesa")
      .eq("status", "pending");

    if (updateError) {
      return NextResponse.json(
        { error: "Prompt sent but payment record update failed: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "STK push failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
