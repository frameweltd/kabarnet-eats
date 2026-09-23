import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  // Confirm the order belongs to this customer and load the amount server-side
  // — never trust a client-supplied amount for a payment request.
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
    const result = await initiateStkPush({
      phoneNumber: normalizeKenyanPhone(phoneNumber),
      amount: (order as { total_amount: number }).total_amount,
      orderId: (order as { order_id: string }).order_id,
    });

    // Store the CheckoutRequestID against the payment row immediately so
    // the callback handler can match reliably instead of guessing by
    // phone/amount/time window.
    await supabase
      .from("payments")
      .update({
        mpesa_checkout_request_id: result.checkoutRequestId,
        phone_number_used: normalizeKenyanPhone(phoneNumber),
      })
      .eq("order_id", params.orderId)
      .eq("method", "mpesa")
      .eq("status", "pending");

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "STK push failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
