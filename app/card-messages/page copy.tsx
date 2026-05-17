"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Card = {
  id: string;
  recipient_name: string;
  card_title: string;
  delivery_date: string | null;
};

type Message = {
  id: string;
  signer_name: string;
  message: string;
  photo_url?: string | null;
  font_family?: string | null;
  text_color?: string | null;
};

export default function CardMessagesPage() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get("id");

  const [card, setCard] = useState<Card | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!cardId) return;

      const { data: cardData } = await supabase
        .from("cards")
        .select("*")
        .eq("id", cardId)
        .single();

      const { data: messageData } = await supabase
        .from("messages")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: true });

      setCard(cardData);
      setMessages(messageData || []);
      setIsLoading(false);
    };

    fetchMessages();
  }, [cardId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xl font-bold text-slate-600">Loading messages...</p>
      </main>
    );
  }

  if (!card) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xl font-bold text-slate-600">Card not found.</p>
      </main>
    );
  }

  return (
   <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-pink-50 px-6 py-14">
     <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-5xl mb-4">💌</p>

          <h1 className="text-4xl font-extrabold text-slate-800">
            Messages for {card.recipient_name}
          </h1>

  <p className="text-slate-500 mt-3 text-lg">
  {messages.length}{" "}
  {messages.length === 1
    ? "memory shared with love"
    : "memories shared with love"}
</p>

          <button
            onClick={() => window.history.back()}
            className="mt-6 border border-violet-200 text-violet-700 px-6 py-3 rounded-full font-bold hover:bg-violet-50"
          >
            Back to Card
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="bg-white rounded-3xl border shadow-sm p-12 text-center">
            <p className="text-5xl mb-4">✍️</p>
            <p className="text-slate-500 font-medium">
              No messages have been added yet.
            </p>
          </div>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {messages.map((item) => (
<div
  key={item.id}
  className={`
    break-inside-avoid mb-6
    bg-white rounded-3xl
    p-6 shadow-sm
    hover:shadow-2xl hover:-translate-y-1
    transition-all duration-300
    ${
      Math.random() > 0.5
        ? "rotate-1"
        : "-rotate-1"
    }
  `}
>
                {item.photo_url && (
                  <img
                    src={item.photo_url}
                    alt="Signer photo"
                    className="w-full h-48 object-cover rounded-2xl mb-5"
                  />
                )}

                <p
                  className="text-xl leading-relaxed mb-6 whitespace-pre-wrap"
                  style={{
                    fontFamily: item.font_family || "inherit",
                    color: item.text_color || "#334155",
                  }}
                >
                  “{item.message}”
                </p>

                <p className="font-bold text-violet-700">
                  — {item.signer_name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}