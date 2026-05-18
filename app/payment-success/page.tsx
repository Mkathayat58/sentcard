"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Card = {
  id: string;
  recipient_name: string;
  recipient_email: string;
  card_title: string;
  delivery_date: string | null;
  sender_name: string | null;
};

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardId = searchParams.get("cardId");

  const [card, setCard]     = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const setup = async () => {
      if (!cardId) return;

      // 1. Mark as paid + fetch card details
      const { data, error } = await supabase
        .from("cards")
        .update({ payment_status: "paid" })
        .eq("id", cardId)
        .select()
        .single();

      if (error || !data) {
        console.error(error);
        setIsLoading(false);
        return;
      }

      setCard(data);

      // 2. Send email to recipient immediately
      try {
        const origin = window.location.origin;
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },

      
          body: JSON.stringify({
            recipientEmail: data.recipient_email,
            recipientName: data.recipient_name,
            cardLink: `${origin}/card-messages?id=${data.id}`,
            cardId: data.id,
          }),
        });
      } catch (err) {
        console.error("Email send failed:", err);
      }

      setIsLoading(false);
    };
    setup();
  }, [cardId]);

  const shareLink = typeof window !== "undefined" && cardId
    ? `${window.location.origin}/sign-card?id=${cardId}`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Help me sign a card for ${card?.recipient_name}!`);
    const body    = encodeURIComponent(
      `Hi team,\n\nI've created a special card for ${card?.recipient_name}. Please add your message!\n\nSign here: ${shareLink}\n\nThanks!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hey! Help me sign a card for ${card?.recipient_name} 💌 ${shareLink}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (isLoading) return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Activating your card and sending notification…</p>
      </div>
    </main>
  );

  if (!card) return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-xl font-bold text-slate-700">Card not found.</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Success header */}
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-100">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 mb-2">
            Payment Successful!
          </h1>
          <p className="text-slate-500">
            Your card for <span className="font-bold text-slate-700">{card.recipient_name}</span> is ready to be signed.
          </p>
          <p className="text-emerald-600 text-sm mt-3 font-medium">
            ✉️ Email notification sent to recipient
          </p>
        </div>

        {/* Shareable link */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mt-6">
          <h2 className="text-lg font-bold text-slate-800 mb-2">
            Share with your team
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Send this link to your colleagues so they can add their messages.
          </p>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
            <span className="text-violet-500 shrink-0">🔗</span>
            <input
              readOnly
              value={shareLink}
              className="flex-1 bg-transparent text-sm text-slate-600 truncate outline-none"
            />
            <button
              onClick={handleCopy}
              className="bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-violet-800 transition shrink-0"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleEmailShare}
              className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              <span>📧</span> Share via Email
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              <span>💬</span> Share via WhatsApp
            </button>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={() => router.push(`/sign-card?id=${cardId}`)}
            className="flex-1 bg-violet-700 text-white py-4 rounded-2xl font-bold hover:bg-violet-800 transition"
          >
            Sign It Yourself First
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 border border-slate-300 text-slate-700 py-4 rounded-2xl font-semibold hover:bg-white transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}