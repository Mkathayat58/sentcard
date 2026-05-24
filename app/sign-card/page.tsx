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
  pos_x: number | null;
  pos_y: number | null;
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
  "#ef4444","#ec4899","#a855f7","#6366f1","#3b82f6",
  "#06b6d4","#22c55e","#84cc16","#eab308","#f97316",
  "#0891b2","#16a34a","#65a30d","#d97706","#000000","#160bed"
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
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // Draggable compose position
  const [composePos, setComposePos] = useState({ x: 40, y: 200 });
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const [composeWidth, setComposeWidth] = useState(260);
  const [composeHeight, setComposeHeight] = useState(160);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: composePos.x, posY: composePos.y };
const onMove = (ev: MouseEvent) => {
  const cardW = CARD_W;
  const cardH = 680;
  const toolbarH = 50; // toolbar + name field height
  setComposePos({
    x: Math.max(0, Math.min(cardW - composeWidth,       dragStart.current.posX + (ev.clientX - dragStart.current.mouseX))),
    y: Math.max(0, Math.min(cardH - composeHeight - toolbarH, dragStart.current.posY + (ev.clientY - dragStart.current.mouseY))),
  });
};
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

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
    // If editing existing message
    if (editingId) {
      const editingMsg = messages.find(m => m.id === editingId);
      if (editingMsg?.edit_token && myEditTokens.includes(editingMsg.edit_token)) {
        await supabase.from("messages")
          .update({
            message,
            signer_name: signerName,
            font_family: selectedFont,
            text_color:  selectedColor,
            font_size:   fontSize,
            text_align:  textAlign,
            pos_x:       composePos.x,
            pos_y:       composePos.y,
          })
          .eq("id", editingId)
          .eq("edit_token", editingMsg.edit_token);
      }
      setEditingId(null);
      setMessage(""); setSignerName(""); setPhotoFile(null);
      setIsComposing(false);
      setIsSubmitting(false);
      fetchAll();
      return;
    }
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
      pos_x:       composePos.x,
      pos_y:       composePos.y,
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
style={{ backgroundImage: "radial-gradient(circle, #93c5fd 1.5px, transparent 1.5px)", backgroundSize: "4px 4px" }}>
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

    // ── Message page — relative container for absolute-positioned messages ──
    return (
      <div
className="w-full relative"
style={{
  height: "680px",
  overflow: "visible",
background: "linear-gradient(145deg, #fdf8f0 0%, #faf4e8 100%)",
}}>

        {/* Empty state */}
        {msgs.length === 0 && !(isCurrent && isComposing) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-amber-200">
            <span className="text-4xl">✍️</span>
            <p style={{ fontFamily: "Caveat", fontSize: "1.1rem" }}>
              {isCurrent ? 'Click "Sign card" to write…' : "No messages yet"}
            </p>
          </div>
        )}

        {/* ── Saved messages — absolutely positioned where they were dropped ── */}
          {msgs.filter(m => m.id !== editingId).map(m => (
          <div
            key={m.id}
            className="absolute group"
            style={{ left: m.pos_x ?? 40, top: m.pos_y ?? 40, width: `${m.box_width ?? 260}px`, wordBreak: "break-word", overflowWrap: "break-word" }}
            onMouseEnter={() => isCurrent && setHoveredId(m.id)}
             id={`msg-${m.id}`}
            onMouseLeave={() => setHoveredId(null)}
          onMouseDown={isMine(m) && isCurrent && !cardLocked ? (e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              e.preventDefault();
              const startX = e.clientX - (m.pos_x ?? 40);
              const startY = e.clientY - (m.pos_y ?? 40);
              const onMove = (ev: MouseEvent) => {
  const el = document.getElementById(`msg-${m.id}`);
  if (el) {
const newX = Math.max(8, Math.min(CARD_W - el.offsetWidth - 8,  ev.clientX - startX));
const newY = Math.max(30, Math.min(660 - el.offsetHeight, ev.clientY - startY));
    el.style.left = newX + "px";
    el.style.top  = newY + "px";
  }
};
const onUp = async (ev: MouseEvent) => {
  window.removeEventListener("mousemove", onMove);
  window.removeEventListener("mouseup", onUp);
  const el = document.getElementById(`msg-${m.id}`);
  const newX = el ? Math.max(8, Math.min(CARD_W - el.offsetWidth - 8,  ev.clientX - startX)) : ev.clientX - startX;
const newY = el ? Math.max(30, Math.min(660 - el.offsetHeight, ev.clientY - startY)) : ev.clientY - startY;
                if (m.edit_token && myEditTokens.includes(m.edit_token)) {
                  await supabase.from("messages")
                    .update({ pos_x: newX, pos_y: newY })
                    .eq("id", m.id).eq("edit_token", m.edit_token);
                  fetchAll();
                }
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            } : undefined}>


              <>
                <div className="bg-transparent">
                  {m.photo_url && <img src={m.photo_url} alt="" className="max-h-24 rounded-lg mb-2 shadow-sm" />}
                  <p className="leading-relaxed whitespace-pre-wrap"
                    style={{ fontFamily: m.font_family || "Caveat", color: m.text_color || "#1f2937", fontSize: FS[m.font_size || "md"], textAlign: (m.text_align as any) || "left" }}>
                    {m.message}
                  </p>
               <p className="italic text-left pl-1 mt-1"
                    style={{ fontFamily: m.font_family || "Caveat", color: m.text_color || "#1f2937", fontSize: "0.85rem", opacity: 0.75 }}>
                    — {m.signer_name}
                  </p>
                </div>

                {/* Own message hover controls */}
                {isMine(m) && isCurrent && hoveredId === m.id && !cardLocked && (
                  <div className="absolute -top-6 left-0 flex items-center gap-2 bg-white border border-slate-100 shadow rounded-full px-3 py-1 text-xs z-10 whitespace-nowrap">
                    <button onClick={() => { setEditingId(m.id);
  setMessage(m.message);
  setSignerName(m.signer_name);
  setSelectedFont(m.font_family || FONTS[0].name);
  setSelectedColor(m.text_color || TEXT_COLORS[0]);
  setFontSize((m.font_size as "sm"|"md"|"lg") || "md");
  setTextAlign((m.text_align as "left"|"center"|"right") || "left");
  setComposePos({ x: m.pos_x ?? 40, y: m.pos_y ?? 40 });
  setIsComposing(true);
  }} 
  className="text-slate-500 hover:text-slate-800 font-medium">✏️ Edit</button>
                    <span className="text-slate-200">|</span>
                    <div className="relative">
                      <button onClick={e => { e.stopPropagation(); setMovingId(movingId === m.id ? null : m.id); }} className="text-slate-500 hover:text-slate-800 font-medium">📄 Move</button>
                      {movingId === m.id && (
                        <div className="absolute top-6 left-0 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50 w-36" onClick={e => e.stopPropagation()}>
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
        
          </div>
        ))}

        {/* ── Draggable compose box ── */}
        {isCurrent && isComposing && (
          <div
            className="absolute z-20"
           style={{ left: composePos.x, top: composePos.y, width: `${composeWidth}px`, minHeight: `${composeHeight}px`, overflow: "visible" }}
          
            onClick={e => e.stopPropagation()}>

            {/* Drag handle — top bar */}
            <div
              onMouseDown={handleDragStart}
              className="flex items-center justify-between px-2 py-1 bg-blue-50 border-2 border-b-0 border-dashed border-blue-300 rounded-t-xl cursor-grab active:cursor-grabbing select-none">
              <span className="text-xs text-blue-400 font-medium">✥ drag to place</span>
              <button
                onMouseDown={e => e.stopPropagation()}
              onClick={() => { setIsComposing(false); setEditingId(null); setMessage(""); setSignerName(""); }}
                className="w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">
                ✕
              </button>
            </div>

            {/* Blue resize handles */}
            <div className="absolute left-0 top-16 w-3 h-3 bg-blue-500 rounded-full -translate-x-1.5 shadow z-10" />
            <div className="absolute right-0 top-16 w-3 h-3 bg-blue-500 rounded-full translate-x-1.5 shadow z-10" />
{/* Bottom-right resize grip */}
<div
  className="absolute bottom-0 right-0 w-5 h-5 z-30 cursor-se-resize"
  style={{
    background: "radial-gradient(circle, #3b82f6 1.5px, transparent 1.5px)",
    backgroundSize: "4px 4px",
  }}
  onMouseDown={e => {
    e.preventDefault();
    e.stopPropagation();
    const startX  = e.clientX;
    const startY  = e.clientY;
    const startW  = composeWidth;
    const startH  = composeHeight;
    const onMove  = (ev: MouseEvent) => {
      setComposeWidth(Math.max(180, startW + (ev.clientX - startX)));
      setComposeHeight(Math.max(120, startH + (ev.clientY - startY)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }}
/>
            {/* Dashed box */}
            <div className="border-2 border-t-0 border-dashed border-blue-300 rounded-b-xl bg-white/80"
              style={{}}>
              <div className="px-3 pt-3 pb-2">
                {/* Auto-resize textarea */}
                <textarea
                  ref={textareaRef}
                  autoFocus
                  rows={1}
                  placeholder="Message"
                  className="w-full bg-transparent resize-none outline-none placeholder-slate-300"
style={{ fontFamily: selectedFont, color: selectedColor, fontSize: FS[fontSize], textAlign, minHeight: `${composeHeight - 100}px`,
height: `${composeHeight - 100}px`, }}
                  value={message}
                onChange={e => { setMessage(e.target.value); autoResize(); }}
                  onFocus={() => autoResize()}
                  maxLength={500}
                />
                {/* Name */}
                <div className="flex items-center gap-2 mt-1">
                  <input placeholder="Your Name"
                    className="flex-1 bg-transparent outline-none text-sm italic"
                    style={{ fontFamily: selectedFont, color: selectedColor }}
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                  />
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
                  <button onClick={() => photoInputRef.current?.click()} className="text-slate-300 hover:text-slate-500 text-sm">📎</button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-1 px-2 py-1.5 bg-white border-t border-slate-100 rounded-b-xl flex-wrap">
<div className="relative">
  <button onClick={togglePicker("font")} className={`h-6 px-1.5 rounded text-xs font-black transition ${openPicker==="font"?"bg-slate-200":"hover:bg-slate-100 text-slate-600"}`}>A</button>
  {openPicker === "font" && (
    <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 overflow-y-auto"
      style={{ width: "130px", maxHeight: "200px" }}
      onClick={e => e.stopPropagation()}>
      {FONTS.map(f => (
        <button key={f.name} onClick={() => { setSelectedFont(f.name); setOpenPicker(null); }}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition ${selectedFont===f.name?"bg-slate-100 font-bold":"hover:bg-slate-50"}`}
          style={{ fontFamily: f.name }}>
          {f.label}
        </button>
      ))}
    </div>
  )}
</div>
<div className="relative">
  <button onClick={togglePicker("size")}
    className={`h-6 px-2 rounded text-xs font-bold transition ${openPicker==="size"?"bg-slate-200":"hover:bg-slate-100 text-slate-600"}`}>
    Tt
  </button>
  
  {openPicker === "size" && (
    <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50"
      style={{ width: "110px" }}
      onClick={e => e.stopPropagation()}>
      {([
        { value: "lg", label: "Large"  },
        { value: "md", label: "Medium" },
        { value: "sm", label: "Normal" },
      ] as const).map(s => (
        <button key={s.value}
          onClick={() => { setFontSize(s.value); setOpenPicker(null); }}
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 rounded-lg flex items-center gap-2">
          {fontSize === s.value ? "✓" : <span className="w-4" />} {s.label}
        </button>
      ))}
    </div>
  )}
</div>
                <div className="w-px h-3 bg-slate-200 mx-0.5" />
                <div className="relative">
                  <button onClick={togglePicker("color")} className={`h-6 px-1.5 rounded flex flex-col items-center justify-center gap-0.5 transition ${openPicker==="color"?"bg-slate-200":"hover:bg-slate-100"}`}>
                    <span className="text-xs font-black text-slate-700 leading-none" style={{ fontSize: "0.6rem" }}>A</span>
                    <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: selectedColor }} />
                  </button>
{openPicker === "color" && (
  <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-50"
    onClick={e => e.stopPropagation()}>
<div className="grid grid-cols-4 gap-6 justify-items-center">
  {TEXT_COLORS.map(c => (
    <button key={c}
      onClick={() => { setSelectedColor(c); setOpenPicker(null); }}
      style={{ backgroundColor: c }}
      className={`w-4 h-4 rounded-full transition hover:scale-110 ${selectedColor===c?"ring-2 ring-offset-2 ring-slate-500":""}`}
    />
  ))}
</div>
  </div>
)}
                </div>
                <div className="w-px h-3 bg-slate-200 mx-0.5" />
                {([{ a: "left" as const, icon: "⬅" },{ a: "center" as const, icon: "↔" },{ a: "right" as const, icon: "➡" }]).map(({ a, icon }) => (
                  <button key={a} onClick={() => setTextAlign(a)}
                    className={`h-6 px-1.5 rounded text-xs transition ${textAlign===a?"bg-slate-200":"hover:bg-slate-100 text-slate-500"}`}>
                    {icon}
                  </button>
                ))}
                <div className="w-px h-3 bg-slate-200 mx-0.5" />
                <div className="relative">
                  <button onClick={togglePicker("emoji")} className={`h-6 px-1.5 rounded text-xs transition ${openPicker==="emoji"?"bg-slate-200":"hover:bg-slate-100"}`}>😊</button>
{openPicker === "emoji" && (
  <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50"
    style={{ width: "180px" }}
    onClick={e => e.stopPropagation()}>
    <div className="grid grid-cols-5 gap-1 overflow-y-auto" style={{ maxHeight: "160px" }}>
      {EMOJIS.map(e => (
        <button key={e} onClick={() => { setMessage(m => m + e); autoResize(); setOpenPicker(null); }}
          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-lg">
          {e}
        </button>
      ))}
    </div>
  </div>
)}
                </div>
                <span className="text-xs text-slate-300 ml-0.5">{1000 - message.length}</span>
                <button onClick={handleSave}
                  disabled={isSubmitting || !signerName.trim() || !message.trim()}
                  className="ml-auto bg-teal-600 text-white px-3 py-0.5 rounded-full font-bold text-xs hover:bg-teal-700 disabled:opacity-40 transition">
                  {isSubmitting ? "…" : "Save"}
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



      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Countdown */}
        <div className="text-center mb-6">
          <h2 className="text-4xl font-bold text-slate-800">A card for {card.recipient_name}</h2>
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
{!cardLocked && (
  <button
    onClick={() => window.location.href = `/create-card?edit=${card.id}`}
    className="w-full border border-cyan-500 text-cyan-700 px-4 py-2.5 rounded-full font-semibold text-sm bg-white hover:bg-cyan-50 transition flex items-center justify-center gap-2">
    ⚙️ Card settings
  </button>
)}

<button
  onClick={() => goTo(0)}
  className="w-full border border-cyan-500 text-cyan-700 px-4 py-2.5 rounded-full font-semibold text-sm bg-white hover:bg-cyan-50 transition flex items-center justify-center gap-2">
  👁 Preview card
</button>
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
                        transform:  isCurrent ? "scale(1)" : "scale(0.96)",
                        opacity:    isCurrent ? 1 : 0.90,
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
                style={{ background: "linear-gradient(to right, rgba(241,245,249,0.7) 0%, transparent 100%)" }} />
              {/* Right fade gradient */}
              <div className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none z-10"
                style={{ background: "linear-gradient(to left, rgba(241,245,249,0.7) 0%, transparent 100%)" }} />
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