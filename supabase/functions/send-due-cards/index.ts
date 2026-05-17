// @ts-nocheck
// Supabase Edge Function: send-due-cards
// Save at: supabase/functions/send-due-cards/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const APP_URL = Deno.env.get("APP_URL")!;

    // Find cards ready to send
    const nowIso = new Date().toISOString();
    const { data: dueCards, error } = await supabase
      .from("cards")
      .select("id, recipient_email, recipient_name")
      .lte("delivery_date", nowIso)
      .is("sent_at", null)
      .eq("payment_status", "paid");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!dueCards || dueCards.length === 0) {
      return new Response(JSON.stringify({ message: "No cards due" }), { status: 200 });
    }

    // Send each card
    const results = await Promise.all(
      dueCards.map(async (card) => {
        try {
          const res = await fetch(`${APP_URL}/api/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientEmail: card.recipient_email,
              recipientName: card.recipient_name,
              cardLink: `${APP_URL}/card-messages?id=${card.id}`,
              cardId: card.id,
            }),
          });
          const result = await res.json();

          // Mark as sent if email succeeded
          if (result.success) {
            await supabase
              .from("cards")
              .update({ sent_at: new Date().toISOString() })
              .eq("id", card.id);
          }

          return { id: card.id, status: res.status, success: result.success };
        } catch (err) {
          return { id: card.id, error: String(err) };
        }
      })
    );

    return new Response(
      JSON.stringify({ processed: dueCards.length, results }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});