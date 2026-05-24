"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Card = {
  id: string;
  recipient_name: string;
  card_title: string;
  delivery_date: string | null;
  cover_image: string | null;
  sender_name: string | null;
};

type Message = {
  id: string;
  signer_name: string;
  message: string;
  photo_url?: string | null;
  font_family?: string | null;
  text_color?: string | null;
};

const WASHI_TAPE_COLORS = ["#fde68a", "#fbcfe8", "#bae6fd", "#bbf7d0", "#fed7aa", "#ddd6fe"];
const ROTATIONS         = [-2.5, -1.5, -0.8, 0.5, 1.2, 2, 2.8, -2];
const MESSAGES_PER_SPREAD = 4;

// ─── INNER CONTENT ────────────────────────────────────────────────────────────
function CardMessagesContent() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get("id");

  const [card, setCard]         = useState<Card | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── 3-stage reveal: envelope → cover → messages ─────────────────────────
  const [stage, setStage] = useState<"envelope" | "cover" | "messages">("envelope");
  const [envelopeOpened, setEnvelopeOpened] = useState(false);

  const [spread, setSpread] = useState(0);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!cardId) return;
      const { data: cardData } = await supabase
        .from("cards").select("*").eq("id", cardId).single();
      const { data: messageData } = await supabase
        .from("messages").select("*").eq("card_id", cardId)
        .order("created_at", { ascending: true });
      setCard(cardData);
      setMessages(messageData || []);
      setIsLoading(false);
    };
    fetchMessages();
  }, [cardId]);

  const openEnvelope = () => {
    setEnvelopeOpened(true);
    setTimeout(() => setStage("cover"), 900);
  };

  const openMessages = () => {
    setStage("messages");
  };

  if (isLoading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-xl font-bold text-slate-600">Loading…</p>
    </main>
  );

  if (!card) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-xl font-bold text-slate-600">Card not found.</p>
    </main>
  );

  const coverSrc = card.cover_image || "/covers/default-cover.svg";

  const totalSpreads     = Math.max(1, Math.ceil(messages.length / MESSAGES_PER_SPREAD));
  const messagesInSpread = messages.slice(spread * MESSAGES_PER_SPREAD, (spread + 1) * MESSAGES_PER_SPREAD);
  const leftPageMessages  = messagesInSpread.slice(0, 2);
  const rightPageMessages = messagesInSpread.slice(2, 4);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #faf5ff 0%, #fef3c7 50%, #ffe4e6 100%)" }}
    >
      {/* Floating confetti — only after envelope opens */}
      {stage !== "envelope" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {["✨", "💌", "💕", "🌸", "⭐", "🎉", "💫", "🌟"].map((emoji, i) => (
            <span
              key={i}
              className="absolute text-2xl opacity-40 animate-float"
              style={{
                left: `${(i * 13 + 5) % 100}%`,
                top: `${(i * 17 + 8) % 100}%`,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${4 + (i % 3)}s`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STAGE 1: ENVELOPE
      ═══════════════════════════════════════════════════════════════ */}
      {stage === "envelope" && (
        <div className="relative flex flex-col items-center z-10">
          <p className="text-slate-700 mb-6 text-lg font-medium animate-pulse">
            You've got a card, {card.recipient_name}! 💌
          </p>
          <button
            onClick={openEnvelope}
            disabled={envelopeOpened}
            className="relative w-[340px] h-[230px] cursor-pointer transform transition-transform hover:scale-105 disabled:cursor-default"
            style={{ perspective: "1000px" }}
          >
            <div className="absolute inset-0 rounded-lg shadow-2xl" style={{ background: "linear-gradient(135deg, #f87171, #ec4899)" }} />
            <div
              className="absolute top-0 left-0 w-full origin-top transition-transform duration-700"
              style={{
                height: "115px",
                background: "linear-gradient(135deg, #fb7185, #f43f5e)",
                clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                transform: envelopeOpened ? "rotateX(180deg)" : "rotateX(0deg)",
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
              }}
            />
            <div className={`absolute left-1/2 top-[100px] -translate-x-1/2 text-4xl transition-opacity duration-500 ${envelopeOpened ? "opacity-0" : "opacity-100"}`}>
              💌
            </div>
            <div
              className={`absolute left-4 right-4 bottom-4 top-4 bg-white rounded shadow-md transition-all duration-700 ${envelopeOpened ? "translate-y-[-100px] opacity-100" : "translate-y-0 opacity-80"}`}
              style={{ background: "repeating-linear-gradient(white, white 24px, #f1f5f9 25px)" }}
            >
              <p className="text-center pt-8 text-2xl font-bold text-slate-700" style={{ fontFamily: "Caveat" }}>
                For {card.recipient_name}
              </p>
            </div>
          </button>
          {!envelopeOpened && <p className="text-slate-500 text-sm mt-8 italic">Click the envelope to open ↑</p>}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STAGE 2: COVER REVEAL — the big moment 🎁
      ═══════════════════════════════════════════════════════════════ */}
      {stage === "cover" && (
        <div className="relative w-full max-w-3xl z-10 animate-cover-appear">

          {/* The actual cover image — big and beautiful */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl">
            <img
              src={coverSrc}
              alt="Card cover"
              className="w-full h-[500px] object-cover"
            />

            {/* Soft gradient overlay so text reads */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />

            {/* Centered welcome text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white">
              <p className="text-sm uppercase tracking-[0.3em] opacity-80 mb-4 drop-shadow">
                A special card
              </p>
              <h1
                className="text-5xl md:text-6xl font-extrabold mb-3 drop-shadow-lg"
                style={{ fontFamily: "Dancing Script, cursive", fontWeight: 700 }}
              >
                For {card.recipient_name}
              </h1>
              {card.card_title && (
                <p className="text-xl md:text-2xl font-light opacity-95 drop-shadow max-w-xl"
                   style={{ fontFamily: "Caveat, cursive" }}>
                  {card.card_title}
                </p>
              )}
              {card.sender_name && (
                <p className="text-sm mt-6 opacity-80 drop-shadow italic">
                  from {card.sender_name}
                </p>
              )}
            </div>
          </div>

          {/* Open messages button below */}
          <div className="text-center mt-8">
            <button
              onClick={openMessages}
              className="bg-white text-rose-600 px-10 py-4 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
            >
              Open Messages ↓
            </button>
            <p className="text-slate-500 text-sm mt-4 italic">
              {messages.length} {messages.length === 1 ? "message" : "messages"} from your team are waiting
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STAGE 3: MESSAGE SPREAD
      ═══════════════════════════════════════════════════════════════ */}
      {stage === "messages" && (
        <div className="relative w-full max-w-6xl z-10 animate-card-appear">
          <div className="text-center mb-6">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800" style={{ fontFamily: "Dancing Script", fontWeight: 700 }}>
              {card.card_title || `For ${card.recipient_name}`}
            </h1>
            <p className="text-slate-500 mt-2 text-sm italic">
              {messages.length} {messages.length === 1 ? "message" : "messages"} from your team
            </p>
          </div>

          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ minHeight: "640px", background: "linear-gradient(135deg, #fffbf5 0%, #fefce8 100%)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.05)" }}>
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
            <div className="absolute top-6 bottom-6 left-1/2 w-px pointer-events-none hidden md:block" style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.12), transparent)" }} />

            <div className="relative grid grid-cols-1 md:grid-cols-2 min-h-[640px]">
              <div className="p-8 md:p-12 relative">
                {spread === 0 && (
                  <>
                    <p className="text-3xl text-slate-700 mb-2" style={{ fontFamily: "Caveat" }}>Dear</p>
                    <h2 className="text-5xl font-bold text-rose-600 mb-8" style={{ fontFamily: "Dancing Script" }}>{card.recipient_name},</h2>
                    <p className="text-slate-600 text-lg leading-relaxed mb-8" style={{ fontFamily: "Caveat" }}>
                      Your team has come together to share some special words with you. We hope every message brings a smile to your day ❤️
                    </p>
                  </>
                )}
                {leftPageMessages.map((item, idx) => (
                  <MessageNote key={item.id} message={item} rotation={ROTATIONS[(spread * 4 + idx) % ROTATIONS.length]} tapeColor={WASHI_TAPE_COLORS[(spread * 4 + idx) % WASHI_TAPE_COLORS.length]} />
                ))}
              </div>

              <div className="p-8 md:p-12 relative">
                {rightPageMessages.map((item, idx) => (
                  <MessageNote key={item.id} message={item} rotation={ROTATIONS[(spread * 4 + 2 + idx) % ROTATIONS.length]} tapeColor={WASHI_TAPE_COLORS[(spread * 4 + 2 + idx) % WASHI_TAPE_COLORS.length]} />
                ))}
                {spread === totalSpreads - 1 && rightPageMessages.length === 0 && leftPageMessages.length < 2 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400 italic text-center" style={{ fontFamily: "Caveat", fontSize: "1.5rem" }}>
                      With love,<br/>your team ❤️
                    </p>
                  </div>
                )}
              </div>
            </div>

            {totalSpreads > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
                <button onClick={() => setSpread((s) => Math.max(0, s - 1))} disabled={spread === 0} className="w-10 h-10 rounded-full bg-white shadow-md hover:shadow-lg disabled:opacity-30 transition flex items-center justify-center text-rose-500 font-bold">←</button>
                <span className="text-sm text-slate-500 font-medium" style={{ fontFamily: "Caveat", fontSize: "1.1rem" }}>Page {spread + 1} of {totalSpreads}</span>
                <button onClick={() => setSpread((s) => Math.min(totalSpreads - 1, s + 1))} disabled={spread === totalSpreads - 1} className="w-10 h-10 rounded-full bg-white shadow-md hover:shadow-lg disabled:opacity-30 transition flex items-center justify-center text-rose-500 font-bold">→</button>
              </div>
            )}
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => setStage("cover")}
              className="border border-slate-300 text-slate-600 px-6 py-2 rounded-full text-sm font-semibold hover:bg-white transition mr-3"
            >
              ← Back to Cover
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-20px) rotate(10deg); }
        }
        .animate-float { animation: float linear infinite; }
        @keyframes card-appear {
          0%   { opacity: 0; transform: scale(0.92) translateY(40px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-card-appear { animation: card-appear 0.9s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes cover-appear {
          0%   { opacity: 0; transform: scale(0.85) translateY(60px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-cover-appear { animation: cover-appear 1.1s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
    </main>
  );
}

function MessageNote({ message, rotation, tapeColor }: { message: Message; rotation: number; tapeColor: string }) {
  const font  = message.font_family || "Caveat";
  const color = message.text_color  || "#4c1d95";
  return (
    <div className="relative mb-8 group" style={{ transform: `rotate(${rotation}deg)` }}>
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-5 rounded-sm opacity-80 z-10 shadow-sm" style={{ backgroundColor: tapeColor, backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 4px, transparent 4px, transparent 8px)" }} />
      <div className="bg-white rounded-lg shadow-md p-5 transition-transform group-hover:scale-[1.02] group-hover:shadow-xl" style={{ background: "linear-gradient(180deg, #ffffff 0%, #fefce8 100%)" }}>
        {message.photo_url && <img src={message.photo_url} alt="" className="w-full h-32 object-cover rounded mb-3" />}
        <p className="text-xl leading-snug mb-3 whitespace-pre-wrap" style={{ fontFamily: font, color }}>{message.message}</p>
        <p className="text-base font-bold text-right" style={{ fontFamily: font, color }}>— {message.signer_name}</p>
      </div>
    </div>
  );
}

export default function CardMessagesPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xl font-bold text-slate-600">Loading…</p>
      </main>
    }>
      <CardMessagesContent />
    </Suspense>
  );
}