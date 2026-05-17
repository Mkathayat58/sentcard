"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Card = {
  id: string;
  card_type: string;
  recipient_name: string;
  card_title: string;
  template: string;
  recipient_email: string | null;
  sender_name: string | null;
  delivery_date: string | null;
  cover_image?: string | null;
};

type Message = {
  id: string;
  signer_name: string;
  message: string;
};

export default function PreviewCardPage() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get("id");

  const [card, setCard] = useState<Card | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState("");

  const fetchCardAndMessages = async () => {
    if (!cardId) return;

    const { data: cardData, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (cardError) {
      console.error(cardError);
      alert("Card could not be loaded.");
      setIsLoading(false);
      return;
    }

    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("card_id", cardId)
      .order("created_at", { ascending: true });

    if (messageError) {
      console.error(messageError);
      alert("Messages could not be loaded.");
      setIsLoading(false);
      return;
    }

    setCard(cardData);
    setMessages(messageData || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCardAndMessages();
  }, [cardId]);

  useEffect(() => {
    if (!card?.delivery_date) return;

    const deliveryDate = new Date(card.delivery_date);

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = deliveryDate.getTime() - now;

      if (distance <= 0) {
        setTimeLeft("Delivered");
        clearInterval(interval);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor(
        (distance % (1000 * 60 * 60)) / (1000 * 60)
      );
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [card?.delivery_date]);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    alert("Card link copied!");
  };

  const handleSendEmail = async () => {
    if (!card?.recipient_email) {
      alert("Recipient email is missing.");
      return;
    }

    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipientEmail: card.recipient_email,
        recipientName: card.recipient_name,
        cardLink: window.location.href,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      console.error(result);
      alert("Email failed to send.");
      return;
    }

    alert("Email sent successfully!");
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-2xl font-bold text-slate-700">Loading card...</p>
      </main>
    );
  }

  if (!card) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-2xl font-bold text-slate-700">Card not found.</p>
      </main>
    );
  }

  const deliveryDate = card.delivery_date ? new Date(card.delivery_date) : null;
  const isLocked = deliveryDate ? new Date() < deliveryDate : false;

  const coverSrc =
    card.cover_image ||
    (card.card_type === "Birthday Card"
      ? "/covers/birthday.svg"
      : card.card_type === "Welcome Card"
      ? "/covers/welcome.svg"
      : card.card_type === "Thank You Card"
      ? "/covers/thank-you.svg"
      : card.card_type === "Work Anniversary"
      ? "/covers/anniversary.svg"
      : "/covers/farewell.svg");

  if (isLocked && deliveryDate) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-xl border p-10 max-w-2xl w-full text-center">
          <p className="text-6xl mb-6">🔒</p>

          <h1 className="text-4xl font-extrabold text-slate-800 mb-4">
            This card is locked
          </h1>

          <p className="text-lg text-slate-500 mb-6">
            The recipient will be able to view this card on:
          </p>

          <p className="text-2xl font-bold text-violet-700 mb-8">
            {deliveryDate.toLocaleString()}
          </p>

          <div className="bg-violet-50 rounded-2xl p-6">
            <p className="text-sm text-slate-500 mb-2">Unlock countdown</p>
            <p className="text-3xl font-extrabold text-violet-700">
              {timeLeft}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="bg-white border-b px-6 py-5 text-center shadow-sm">
        <h1 className="text-3xl font-extrabold text-slate-800">
          ✉️ Your Group Card
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          A special message from your team
        </p>
      </div>

      <div className="max-w-6xl mx-auto p-6 lg:p-10">
        <section className="bg-white rounded-3xl shadow-xl border overflow-hidden mb-10">
          <img
            src={coverSrc}
            alt="Card cover"
            className="w-full h-80 object-cover"
          />

          <div className="p-8 text-center">
            <p className="text-violet-600 font-bold mb-6">
              {card.card_type}
            </p>



            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Dear <span className="font-bold">{card.recipient_name}</span>,
              this card was created with love from your team ❤️
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs text-slate-400 font-bold uppercase">
                  Recipient
                </p>
                <p className="text-slate-700 font-semibold">
                  {card.recipient_email || "Not provided"}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs text-slate-400 font-bold uppercase">
                  Created By
                </p>
                <p className="text-slate-700 font-semibold">
                  {card.sender_name || "Not provided"}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs text-slate-400 font-bold uppercase">
                  Delivered
                </p>
                <p className="text-slate-700 font-semibold">
                  {card.delivery_date
                    ? new Date(card.delivery_date).toLocaleString()
                    : "Not scheduled"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">


              <button
  onClick={() => {
    window.location.href = `/card-messages?id=${card.id}`;
  }}
  className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-4 rounded-full font-bold shadow-lg hover:shadow-xl transition-all duration-300"
>
  View Your Messages
</button>

            </div>
          </div>
        </section>

      </div>
    </main>
  );
}