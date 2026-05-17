import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const now = new Date().toISOString();

    const { data: cards, error } = await supabaseAdmin
      .from("cards")
      .select("*")
      .lte("delivery_date", now)
      .eq("email_sent", false)
      .eq("payment_status", "paid");

    if (error) {
      console.error(error);
      return Response.json({ success: false, error }, { status: 500 });
    }

    if (!cards || cards.length === 0) {
      return Response.json({
        success: true,
        message: "No scheduled cards to send.",
      });
    }

    for (const card of cards) {
      const cardLink = `${process.env.NEXT_PUBLIC_APP_URL}/preview-card?id=${card.id}`;

      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: card.recipient_email,
        subject: `A group card is ready for you 🎉`,
        html: `
          <h1>Hello ${card.recipient_name}</h1>
          <p>A group card from ${card.sender_name || "your team"} is ready for you.</p>
          <p>
            <a href="${cardLink}" style="background:#7c3aed;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;">
              Open Your Card
            </a>
          </p>
        `,
      });

      await supabaseAdmin
        .from("cards")
        .update({ email_sent: true })
        .eq("id", card.id);
    }

    return Response.json({
      success: true,
      sent: cards.length,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error,
      },
      {
        status: 500,
      }
    );
  }
}