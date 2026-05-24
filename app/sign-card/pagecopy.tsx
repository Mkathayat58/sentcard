"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
type Card = {
  id: string;
  card_type: string;
  recipient_name: string;
  card_title: string;
  template: string;
  recipient_email: string | null;
  sender_name: string | null;
  delivery_date: string | null;
  cover_image: string | null;
};

type Message = {
  id: string;
  signer_name: string;
  message: string;
  photo_url: string | null;
  edit_token: string | null;
  font_family: string | null;
  text_color: string | null;
  font_size: string | null;
  text_align: string | null;
  page_number: number | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const COVER_SRC: Record<string, string> = {
  "Birthday Card":    "/covers/birthday.svg",
  "Welcome Card":     "/covers/welcome.svg",
  "Thank You Card":   "/covers/thank-you.svg",
  "Work Anniversary": "/covers/anniversary.svg",
};

const FONTS = [
  { name: "Caveat",           label: "Casual"  },
  { name: "Dancing Script",   label: "Elegant" },
  { name: "Kalam",            label: "Natural" },
  { name: "Satisfy",          label: "Flowing" },
  { name: "Patrick Hand",     label: "Neat"    },
  { name: "Pacifico",         label: "Fun"     },
  { name: "Permanent Marker", label: "Marker"  },
  { name: "Indie Flower",     label: "Indie"   },
];

const TEXT_COLORS = [
  "#e85d04","#4c1d95","#1e3a8a","#065f46",
  "#9d174d","#0369a1","#92400e","#1f2937",
  "#dc2626","#0891b2","#7c3aed","#15803d",
];

const EMOJIS = [
  "😊","❤️","🎉","🥳","👏","🙌","💐","✨",
  "🌟","😂","🤗","💪","🎂","🙏","😍","🫶",
];

const FS: Record<string, string> = {
  sm: "1rem", md: "1.25rem", lg: "1.5rem",
};

// Carousel geometry
const CARD_W  = 660; // px — width of one card
const GAP     = 10;  // px — gap between cards in the track
const STRIDE  = CARD_W + GAP; // px per page step
const PEEK    = 88;  // px — how much of the adjacent page shows on each side
const STAGE_W = CARD_W + PEEK * 2; // total visible stage width

// ── Component ─────────────────────────────────────────────────────────────────
export default function SignCardPage() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get("id");

  const [card, setCard]             = useState<Card | null>(null);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [timeLeft, setTimeLeft]     = useState("");
  const [cardLocked, setCardLocked] = useState(false);

  // Carousel
  const [cardViewPage, setCardViewPage] = useState(0);
  const [animating, setAnimating]       = useState(false);
  const [isComposing, setIsComposing]   = useState(false);

  // Compose
  const [signerName, setSignerName]       = useState("");
  const [message, setMessage]             = useState("");
  const [photoFile, setPhotoFile]         = useState<File | null>(null);
  const [selectedFont, setSelectedFont]   = useState(FONTS[0].name);
  const [selectedColor, setSelectedColor] = useState(TEXT_COLORS[0]);
  const [fontSize, setFontSize]           = useState<"sm"|"md"|"lg">("md");
  const [textAlign, setTextAlign]         = useState<"left"|"center"|"right">("left");
  const [openPicker, setOpenPicker]       = useState<string|null>(null);

  // Edit / move
  const [myEditTokens, setMyEditTokens]   = useState<string[]>([]);
  const [editingId, setEditingId]         = useState<string|null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [movingId, setMovingId]           = useState<string|null>(null);
  const [hoveredId, setHoveredId]         = useState<string|null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const getPageMsgs  = (pg: number) => messages.filter(m => (m.page_number ?? 1) === pg);
  const maxPage        = messages.reduce((mx, m) => Math.max(mx, m.page_number ?? 1), 1);
  const totalCardPages = maxPage + 2;

  // translateX so current card is always centered in the stage
  // stage left edge = PEEK, card 0 starts at PEEK
  // for page n: translateX = PEEK - n * STRIDE
  const trackX = PEEK - cardViewPage * STRIDE;

  // ── localStorage ─────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("my_message_edit_tokens");
    if (saved) setMyEditTokens(JSON.parse(saved));
  }, []);
  const saveToken = (token: string) => {
    const upd = [...myEditTokens, token];
    setMyEditTokens(upd);
    localStorage.setItem("my_message_edit_tokens", JSON.stringify(upd));
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    if (!cardId) return;
    const { data: cardData } = await supabase.from("cards").select("*").eq("id", cardId).single();
    const { data: msgData }  = await supabase.from("messages").select("*").eq("card_id", cardId).order("created_at");
    if (cardData) setCard(cardData);
    if (msgData)  setMessages(msgData);
    setIsLoading(false);
  };
  useEffect(() => { fetchAll(); }, [cardId]);

  useEffect(() => {
    if (!card?.delivery_date) return;
    const tick = () => {
      const diff = new Date(card.delivery_date!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Delivered"); setCardLocked(true); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      const s = Math.floor((diff % 60000)    / 1000);
      setTimeLeft(`${d} days, ${h} hours, ${m} minutes, ${s} seconds`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [card]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const uploadPhoto = async (file: File | null): Promise<string | null> => {
    if (!file || !cardId) return null;
    const ext  = file.name.split(".").pop();
    const path = `${cardId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("message-photos").upload(path, file);
    if (error) return null;
    return supabase.storage.from("message-photos").getPublicUrl(path).data.publicUrl;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (cardLocked) { alert("This card has been closed."); return; }
    if (!cardId || !signerName.trim() || !message.trim()) {
      alert("Please enter your name and message."); return;
    }
    setIsSubmitting(true);
    const photoUrl   = await uploadPhoto(photoFile);
    const editToken  = crypto.randomUUID();
    const targetPage = cardViewPage === 0 ? 1 : cardViewPage;
    const { error }  = await supabase.from("messages").insert([{
      card_id:     cardId,
      signer_name: signerName.trim(),
      message:     message.trim(),
      photo_url:   photoUrl,
      edit_token:  editToken,
      font_family: selectedFont,
      text_color:  selectedColor,
      font_size:   fontSize,
      text_align:  textAlign,
      page_number: targetPage,
    }]);
    if (error) { alert("Something went wrong."); setIsSubmitting(false); return; }
    saveToken(editToken);
    setSignerName(""); setMessage(""); setPhotoFile(null);
    setIsComposing(false);
    setIsSubmitting(false);
    if (cardViewPage === 0) goTo(1);
    fetchAll();
  };

  // ── Edit / Delete / Move ──────────────────────────────────────────────────
  const handleUpdate = async (item: Message) => {
    if (!item.edit_token || !myEditTokens.includes(item.edit_token)) return;
    await supabase.from("messages")
      .update({ message: editedMessage })
      .eq("id", item.id).eq("edit_token", item.edit_token);
    setEditingId(null); fetchAll();
  };

  const handleDelete = async (item: Message) => {
    if (!item.edit_token || !myEditTokens.includes(item.edit_token)) return;
    if (!confirm("Delete your message?")) return;
    await supabase.from("messages").delete()
      .eq("id", item.id).eq("edit_token", item.edit_token);
    fetchAll();
  };

  const handleMove = async (item: Message, toPage: number) => {
    if (!item.edit_token || !myEditTokens.includes(item.edit_token)) return;
    await supabase.from("messages")
      .update({ page_number: toPage })
      .eq("id", item.id).eq("edit_token", item.edit_token);
    setMovingId(null); fetchAll();
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/sign-card?id=${card?.id}`);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  const goTo = (page: number) => {
    if (animating) return;
    const clamped = Math.max(0, Math.min(totalCardPages - 1, page));
    if (clamped === cardViewPage) return;
    setAnimating(true);
    setIsComposing(false);
    setCardViewPage(clamped);
    setTimeout(() => setAnimating(false), 420);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Loading card…</p>
      </div>
    </main>
  );
  if (!card) return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-2xl font-bold text-slate-700">Card not found.</p>
    </main>
  );

  const coverSrc = COVER_SRC[card.card_type] ?? "/covers/farewell.svg";
  const isMine   = (m: Message) => !!(m.edit_token && myEditTokens.includes(m.edit_token));

  // ── Dropdown helpers ──────────────────────────────────────────────────────
  const togglePicker = (name: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenPicker(p => p === name ? null : name);
  };

  const Dropdown = ({ id, children }: { id: string; children: React.ReactNode }) =>
    openPicker === id ? (
      <div className="absolute bottom-full mb-2 left-0 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-50 min-w-max"
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    ) : null;

  // ── Render one page's content ─────────────────────────────────────────────
  const renderPage = (pageNum: number, isCurrent: boolean) => {
    const msgs = getPageMsgs(pageNum);

    // ── Cover ──
    if (pageNum === 0) {
      return (
        <img
          src={card.cover_image || coverSrc}
          alt="Card cover"
          className="w-full object-cover"
          style={{ height: "680px" }}
        />
      );
    }

    // ── Message page ──
    return (
      <div
        className="w-full overflow-hidden px-8 py-6 flex flex-col gap-5"
        style={{
          height: "680px",
          background: "linear-gradient(145deg, #fdf8f0 0%, #faf4e8 100%)",
        }}>

        {/* Empty state */}
        {msgs.length === 0 && !(isCurrent && isComposing) && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-amber-200">
            <span className="text-4xl">✍️</span>
            <p style={{ fontFamily: "Caveat", fontSize: "1.1rem" }}>
              {isCurrent ? 'Click "Sign card" to write…' : "No messages yet"}
            </p>
          </div>
        )}

        {/* ── Saved messages — handwritten text directly on page ── */}
        {msgs.map((m, idx) => (
          <div
            key={m.id}
            className="relative group shrink-0"
            onMouseEnter={() => isCurrent && setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}>

            {editingId === m.id && isCurrent ? (
              <div>
                <textarea autoFocus rows={3}
                  className="w-full bg-transparent resize-none outline-none border-b border-dashed border-amber-300"
                  style={{ fontFamily: m.font_family || "Caveat", color: m.text_color || "#1f2937", fontSize: FS[m.font_size || "md"] }}
                  value={editedMessage}
                  onChange={e => setEditedMessage(e.target.value)}
                />
                <div className="flex gap-3 mt-1">
                  <button onClick={() => handleUpdate(m)} className="text-xs text-teal-600 font-bold hover:underline">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {m.photo_url && <img src={m.photo_url} alt="" className="max-h-24 rounded-lg mb-1 shadow-sm" />}
                <p className="leading-relaxed whitespace-pre-wrap"
                  style={{ fontFamily: m.font_family || "Caveat", color: m.text_color || "#1f2937", fontSize: FS[m.font_size || "md"], textAlign: (m.text_align as any) || "left" }}>
                  {m.message}
                </p>
                <p className="italic text-right pr-1 mt-0.5"
                  style={{ fontFamily: m.font_family || "Caveat", color: m.text_color || "#1f2937", fontSize: "0.85rem", opacity: 0.75 }}>
                  — {m.signer_name}
                </p>
                {idx < msgs.length - 1 && <hr className="border-amber-100 mt-1" />}

                {/* Own message hover controls */}
                {isMine(m) && isCurrent && hoveredId === m.id && (
                  <div className="absolute -top-1 right-0 flex items-center gap-2 bg-white border border-slate-100 shadow rounded-full px-3 py-1 text-xs z-10">
                    <button onClick={() => { setEditingId(m.id); setEditedMessage(m.message); }} className="text-slate-500 hover:text-slate-800 font-medium">✏️ Edit</button>
                    <span className="text-slate-200">|</span>
                    <div className="relative">
                      <button onClick={e => { e.stopPropagation(); setMovingId(movingId === m.id ? null : m.id); }} className="text-slate-500 hover:text-slate-800 font-medium">📄 Move</button>
                      {movingId === m.id && (
                        <div className="absolute top-6 right-0 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50 w-36" onClick={e => e.stopPropagation()}>
                          <p className="text-xs text-slate-400 font-bold px-2 pb-1 border-b mb-1">Move to page</p>
                          {Array.from({ length: Math.max(maxPage + 1, 3) }, (_, i) => i + 1)
                            .filter(pg => pg !== (m.page_number ?? 1))
                            .map(pg => (
                              <button key={pg} onClick={() => handleMove(m, pg)} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-slate-50 text-slate-700">Page {pg}</button>
                            ))}
                        </div>
                      )}
                    </div>
                    <span className="text-slate-200">|</span>
                    <button onClick={() => handleDelete(m)} className="text-red-400 hover:text-red-600 font-medium">🗑 Delete</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {/* ── Compose box — ONE instance, toolbar attached inside ── */}
        {isCurrent && isComposing && (
          <div className="relative shrink-0" onClick={e => e.stopPropagation()}>

            {/* Discard */}
            <button onClick={() => setIsComposing(false)}
              className="absolute -top-3 -left-3 w-7 h-7 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow-md z-10">
              ✕
            </button>

            {/* Resize handles */}
            <div className="absolute left-0 top-10 w-3 h-3 bg-blue-500 rounded-full -translate-x-1.5 shadow z-10" />
            <div className="absolute right-0 top-10 w-3 h-3 bg-blue-500 rounded-full translate-x-1.5 shadow z-10" />

            {/* Box */}
            <div className="border-2 border-dashed border-blue-300 rounded-xl overflow-hidden bg-white/60">

              {/* Text area */}
              <div className="px-4 pt-4 pb-2">
                <textarea
                  autoFocus rows={3}
                  placeholder="Message"
                  className="w-full bg-transparent resize-none outline-none placeholder-slate-300"
                  style={{ fontFamily: selectedFont, color: selectedColor, fontSize: FS[fontSize], textAlign }}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={500}
                />
                {/* Name + photo */}
                <div className="flex items-center gap-2 border-b border-slate-300 pb-1">
                  <input placeholder="Your Name"
                    className="flex-1 bg-transparent outline-none text-sm italic"
                    style={{ fontFamily: selectedFont, color: selectedColor }}
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                  />
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
                  {photoFile
                    ? <span className="text-xs text-teal-500 truncate max-w-[80px]">📎 {photoFile.name}</span>
                    : <button onClick={() => photoInputRef.current?.click()} className="text-slate-300 hover:text-slate-500 text-sm">📎</button>
                  }
                </div>
              </div>

              {/* Toolbar — attached inside the box */}
              <div className="flex items-center gap-1 px-3 py-2 bg-white border-t border-slate-100 flex-wrap">

                {/* Font */}
                <div className="relative">
                  <button onClick={togglePicker("font")} className={`h-7 px-2 rounded text-sm font-black transition ${openPicker==="font"?"bg-slate-200":"hover:bg-slate-100 text-slate-600"}`}>A</button>
                  <Dropdown id="font">
                    {FONTS.map(f => (
                      <button key={f.name} onClick={() => { setSelectedFont(f.name); setOpenPicker(null); }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition ${selectedFont===f.name?"bg-slate-100 font-bold":"hover:bg-slate-50"}`}
                        style={{ fontFamily: f.name }}>{f.label}</button>
                    ))}
                  </Dropdown>
                </div>

                {/* Size */}
                {(["sm","md","lg"] as const).map(s => (
                  <button key={s} onClick={() => setFontSize(s)}
                    className={`h-7 px-1.5 rounded text-xs font-bold transition ${fontSize===s?"bg-slate-200 text-slate-900":"hover:bg-slate-100 text-slate-500"}`}>
                    {s.toUpperCase()}
                  </button>
                ))}

                <div className="w-px h-4 bg-slate-200 mx-0.5" />

                {/* Color */}
                <div className="relative">
                  <button onClick={togglePicker("color")} className={`h-7 px-2 rounded flex flex-col items-center justify-center gap-0.5 transition ${openPicker==="color"?"bg-slate-200":"hover:bg-slate-100"}`}>
                    <span className="text-xs font-black text-slate-700 leading-none">A</span>
                    <span className="w-4 h-1 rounded-full" style={{ backgroundColor: selectedColor }} />
                  </button>
                  <Dropdown id="color">
                    <div className="grid grid-cols-6 gap-1.5">
                      {TEXT_COLORS.map(c => (
                        <button key={c} onClick={() => { setSelectedColor(c); setOpenPicker(null); }}
                          className={`w-7 h-7 rounded-full border-2 transition hover:scale-110 ${selectedColor===c?"border-slate-600 scale-110":"border-transparent"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </Dropdown>
                </div>

                <div className="w-px h-4 bg-slate-200 mx-0.5" />

                {/* Align */}
                {([{ a: "left" as const, icon: "⬅" },{ a: "center" as const, icon: "↔" },{ a: "right" as const, icon: "➡" }]).map(({ a, icon }) => (
                  <button key={a} onClick={() => setTextAlign(a)}
                    className={`h-7 px-2 rounded text-xs transition ${textAlign===a?"bg-slate-200":"hover:bg-slate-100 text-slate-500"}`}>
                    {icon}
                  </button>
                ))}

                <div className="w-px h-4 bg-slate-200 mx-0.5" />

                {/* Emoji */}
                <div className="relative">
                  <button onClick={togglePicker("emoji")} className={`h-7 px-2 rounded text-sm transition ${openPicker==="emoji"?"bg-slate-200":"hover:bg-slate-100"}`}>😊</button>
                  <Dropdown id="emoji">
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => { setMessage(m => m + e); setOpenPicker(null); }}
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-base">{e}</button>
                      ))}
                    </div>
                  </Dropdown>
                </div>

                <span className="text-xs text-slate-300 ml-1">{500 - message.length}</span>

                <button onClick={handleSave}
                  disabled={isSubmitting || !signerName.trim() || !message.trim()}
                  className="ml-auto bg-teal-600 text-white px-4 py-1 rounded-full font-bold text-xs hover:bg-teal-700 disabled:opacity-40 transition">
                  {isSubmitting ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50" onClick={() => { setOpenPicker(null); setMovingId(null); }}>

      {/* Top bar */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              {cardLocked ? "💜 Card Closed" : "💌 Sign The Card"}
            </h1>
            <p className="text-sm text-slate-500">A card for {card.recipient_name}</p>
          </div>
          {!cardLocked && (
            <button onClick={handleCopyLink}
              className="border border-violet-200 text-violet-700 px-4 py-2 rounded-2xl font-bold text-sm hover:bg-violet-50 transition">
              {copied ? "✓ Copied!" : "📋 Copy Invite Link"}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Countdown */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">A card for {card.recipient_name}</h2>
          {card.delivery_date && (
            <p className="text-sm text-slate-500 mt-1">
              ⏳ <span className="font-semibold text-violet-700">{timeLeft}</span>
            </p>
          )}
        </div>

        {/* 3-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] gap-6 items-start">

          {/* Left sidebar */}
          <aside className="space-y-2">
            {[
              { icon: "⚙️", label: "Card settings"   },
              { icon: "🎁", label: "Add gift card"    },
              { icon: "👁",  label: "Preview card"    },
              { icon: "🙈", label: "Hide invite link" },
            ].map(b => (
              <button key={b.label}
                className="w-full border border-cyan-500 text-cyan-700 px-4 py-2.5 rounded-full font-semibold text-sm bg-white hover:bg-cyan-50 transition flex items-center justify-center gap-2">
                {b.icon} {b.label}
              </button>
            ))}
            <button onClick={handleCopyLink}
              className="w-full border border-cyan-500 text-cyan-700 px-4 py-2.5 rounded-full font-semibold text-sm bg-white hover:bg-cyan-50 transition flex items-center justify-center gap-2">
              🔗 {copied ? "Copied!" : "Invite link"}
            </button>
          </aside>

          {/* ══ CAROUSEL STAGE ══ */}
          <section className="flex flex-col items-center">

            {/*
              The stage is STAGE_W (CARD_W + 2*PEEK) wide with overflow:hidden.
              Inside is a flex track that slides smoothly.
              Adjacent cards are visible in the PEEK zones on each side.
            */}
            <div
              className="relative overflow-hidden rounded-sm"
              style={{ width: `${STAGE_W}px`, maxWidth: "100%" }}>

              {/* Sliding track */}
              <div
                className="flex"
                style={{
                  transform:  `translateX(${trackX}px)`,
                  transition: "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  width:      `${totalCardPages * STRIDE}px`,
                  willChange: "transform",
                }}>
                {Array.from({ length: totalCardPages }, (_, pageNum) => {
                  const isCurrent = pageNum === cardViewPage;
                  return (
                    <div
                      key={pageNum}
                      style={{
                        width:      `${CARD_W}px`,
                        marginRight:`${GAP}px`,
                        flexShrink: 0,
                        /* Scale + dim side pages for depth */
                        transform:  isCurrent ? "scale(1)" : "scale(0.99)",
                        opacity:    isCurrent ? 1 : 0.100,
                        transition: "transform 0.4s ease, opacity 0.4s ease",
                        transformOrigin: "center top",
                      }}>
                      <div
                        className="bg-white border border-slate-200 overflow-hidden flex flex-col"
                        style={{
                          minHeight: "680px",
                          boxShadow: isCurrent
                            ? "0 20px 60px -10px rgba(0,0,0,0.25), 0 4px 16px -4px rgba(0,0,0,0.1)"
                            : "0 4px 16px -4px rgba(0,0,0,0.08)",
                        }}>
                        {renderPage(pageNum, isCurrent)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ← Arrow — overlaid on card, dark circle, like the screenshot */}
              <button
                onClick={() => goTo(cardViewPage - 1)}
                disabled={cardViewPage === 0 || animating}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-800 text-white text-xl flex items-center justify-center shadow-xl hover:bg-slate-700 disabled:opacity-0 transition z-20"
                style={{ backdropFilter: "blur(4px)" }}>
                ←
              </button>

              {/* → Arrow */}
              <button
                onClick={() => goTo(cardViewPage + 1)}
                disabled={cardViewPage >= totalCardPages - 1 || animating}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-800 text-white text-xl flex items-center justify-center shadow-xl hover:bg-slate-700 disabled:opacity-0 transition z-20"
                style={{ backdropFilter: "blur(4px)" }}>
                →
              </button>

              {/* Left fade gradient — blends peek zone */}
              <div className="absolute left-0 top-0 bottom-0 w-16 pointer-events-none z-10"
                style={{ background: "linear-gradient(145deg, #fdf8f0 0%, #faf4e8 100%)" }} />
              {/* Right fade gradient */}
              <div className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none z-10"
                style={{ background: "linear-gradient(145deg, #fdf8f0 0%, #faf4e8 100%)" }} />
            </div>

            {/* Page indicator */}
            <p className="mt-5 text-sm text-slate-500">
              {cardViewPage === 0 ? "Cover" : `Page ${cardViewPage} of ${totalCardPages - 1}`}
              {cardViewPage > 0 && getPageMsgs(cardViewPage).length > 0 && (
                <span className="ml-2 text-slate-400">
                  · {getPageMsgs(cardViewPage).length} message{getPageMsgs(cardViewPage).length !== 1 ? "s" : ""}
                </span>
              )}
            </p>

            {/* Dot indicators */}
            <div className="flex items-center gap-2 mt-3">
              {Array.from({ length: totalCardPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === cardViewPage
                      ? "w-6 h-2.5 bg-slate-700"
                      : "w-2.5 h-2.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>

            {/* Slider */}
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => goTo(cardViewPage - 1)} disabled={cardViewPage === 0}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 disabled:opacity-30 transition shadow-sm">←</button>
              <input type="range" min={0} max={totalCardPages - 1} value={cardViewPage}
                onChange={e => goTo(Number(e.target.value))}
                className="w-56 accent-violet-600" />
              <button onClick={() => goTo(cardViewPage + 1)} disabled={cardViewPage >= totalCardPages - 1}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 disabled:opacity-30 transition shadow-sm">→</button>
            </div>

            {/* Share link */}
            <div className="mt-3 flex items-center gap-2">
              <div className="bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs text-slate-400 font-mono truncate max-w-[280px]">
                {typeof window !== "undefined" ? `${window.location.origin}/sign-card?id=${card?.id}` : ""}
              </div>
              <button onClick={handleCopyLink}
                className="p-1.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 text-sm transition" title="Copy">📋</button>
            </div>
          </section>

          {/* Right sidebar */}
          <aside className="space-y-2">
            {!cardLocked && (
              <>
                <button
                  onClick={() => { if (cardViewPage === 0) goTo(1); setIsComposing(true); }}
                  className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-full font-bold text-sm hover:bg-teal-700 transition flex items-center justify-center gap-2">
                  ✏️ Sign card
                </button>
                <button
                  onClick={() => {
                    if (cardViewPage === 0) goTo(1);
                    setIsComposing(true);
                    setTimeout(() => photoInputRef.current?.click(), 300);
                  }}
                  className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-full font-bold text-sm hover:bg-teal-700 transition flex items-center justify-center gap-2">
                  🖼 Add photo
                </button>
                <button
                  className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-full font-bold text-sm hover:bg-teal-700 transition flex items-center justify-center gap-2">
                  😊 Add GIF / sticker
                </button>
              </>
            )}

            {/* Page quick-jump */}
            {totalCardPages > 2 && (
              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-400 font-bold mb-2 text-center">Jump to page</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {Array.from({ length: totalCardPages - 1 }, (_, i) => i + 1).map(pg => (
                    <button key={pg} onClick={() => goTo(pg)}
                      className={`w-8 h-8 rounded-full text-xs font-bold transition
                        ${cardViewPage===pg
                          ? "bg-teal-600 text-white shadow"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                      {pg}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}