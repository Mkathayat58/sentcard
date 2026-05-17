"use client";

import { useEffect, useState } from "react";
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
};

// ── Constants ─────────────────────────────────────────────────────────────────
const COVER_SRC: Record<string, string> = {
  "Birthday Card":    "/covers/birthday.svg",
  "Welcome Card":     "/covers/welcome.svg",
  "Thank You Card":   "/covers/thank-you.svg",
  "Work Anniversary": "/covers/anniversary.svg",
};

const FONTS = [
  { name: "Caveat",         label: "Casual" },
  { name: "Dancing Script", label: "Elegant" },
  { name: "Kalam",          label: "Natural" },
  { name: "Satisfy",        label: "Flowing" },
  { name: "Patrick Hand",   label: "Neat" },
  { name: "Pacifico",       label: "Fun" },
];

const COLORS = [
  { hex: "#4c1d95", label: "Purple" },
  { hex: "#1e3a8a", label: "Navy" },
  { hex: "#065f46", label: "Forest" },
  { hex: "#9d174d", label: "Rose" },
  { hex: "#0369a1", label: "Ocean" },
  { hex: "#b45309", label: "Amber" },
  { hex: "#be185d", label: "Pink" },
  { hex: "#1f2937", label: "Ink" },
];

const MESSAGES_PER_PAGE = 6;

// ── Component ─────────────────────────────────────────────────────────────────
export default function SignCardPage() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get("id");

  const [card, setCard]         = useState<Card | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
const [cardLocked, setCardLocked] = useState(false);

  // Sign form state
  const [signerName, setSignerName] = useState("");
  const [message, setMessage]       = useState("");
  const [photoFile, setPhotoFile]   = useState<File | null>(null);
  const [selectedFont,  setSelectedFont]  = useState(FONTS[0].name);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].hex);

  // Edit state
  const [myEditTokens, setMyEditTokens]         = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedMessage, setEditedMessage]       = useState("");
  const [editedPhotoFile, setEditedPhotoFile]   = useState<File | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages    = Math.max(1, Math.ceil(messages.length / MESSAGES_PER_PAGE));
  const pagedMessages = messages.slice(
    (currentPage - 1) * MESSAGES_PER_PAGE,
    currentPage * MESSAGES_PER_PAGE
  );

  // ── localStorage ────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("my_message_edit_tokens");
    if (saved) setMyEditTokens(JSON.parse(saved));
  }, []);

  const saveTokenToBrowser = (token: string) => {
    const updated = [...myEditTokens, token];
    setMyEditTokens(updated);
    localStorage.setItem("my_message_edit_tokens", JSON.stringify(updated));
  };

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchCardAndMessages = async () => {
    if (!cardId) return;
    const { data: cardData, error: cardError } = await supabase
      .from("cards").select("*").eq("id", cardId).single();
    if (cardError) { console.error(cardError); setIsLoading(false); return; }

    const { data: msgData, error: msgError } = await supabase
      .from("messages").select("*").eq("card_id", cardId)
      .order("created_at", { ascending: true });
    if (msgError) { console.error(msgError); setIsLoading(false); return; }

    setCard(cardData);
    setMessages(msgData || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchCardAndMessages(); }, [cardId]);
  useEffect(() => {
  if (!card?.delivery_date) return;

  const updateCountdown = () => {
    const now = new Date().getTime();
    const delivery = new Date(card.delivery_date!).getTime();

    const difference = delivery - now;

    if (difference <= 0) {
      setTimeLeft("Delivered");
      setCardLocked(true);
      return;
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (difference % (1000 * 60 * 60 * 24)) /
      (1000 * 60 * 60)
    );

    const minutes = Math.floor(
      (difference % (1000 * 60 * 60)) /
      (1000 * 60)
    );

    setTimeLeft(`${days}d ${hours}h ${minutes}m left`);
  };

  updateCountdown();

  const timer = setInterval(updateCountdown, 1000);

  return () => clearInterval(timer);
}, [card]);

  // ── Photo upload ────────────────────────────────────────────────────────
  const uploadPhoto = async (file: File | null): Promise<string | null> => {
    if (!file || !cardId) return null;
    const ext      = file.name.split(".").pop();
    const fileName = `${cardId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("message-photos").upload(fileName, file);
    if (error) { console.error(error); return null; }
    return supabase.storage.from("message-photos").getPublicUrl(fileName).data.publicUrl;
  };

  // ── Add message ──────────────────────────────────────────────────────────
  const handleAddMessage = async () => {
    if (cardLocked) {
  alert("This card has been closed.");
  return;
}
    if (!cardId || !signerName || !message) {
      alert("Please enter your name and message."); return;
    }
    setIsSubmitting(true);
    const photoUrl  = await uploadPhoto(photoFile);
    const editToken = crypto.randomUUID();
    const { error } = await supabase.from("messages").insert([{
      card_id:     cardId,
      signer_name: signerName,
      message,
      photo_url:   photoUrl,
      edit_token:  editToken,
      font_family: selectedFont,
      text_color:  selectedColor,
    }]);
    if (error) { console.error(error); alert("Something went wrong."); setIsSubmitting(false); return; }
    saveTokenToBrowser(editToken);
    setSignerName(""); setMessage(""); setPhotoFile(null);
    setIsSubmitting(false);
    fetchCardAndMessages();
    setCurrentPage(Math.ceil((messages.length + 1) / MESSAGES_PER_PAGE));
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/sign-card?id=${card?.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const startEditing  = (item: Message) => { setEditingMessageId(item.id); setEditedMessage(item.message); setEditedPhotoFile(null); };
  const cancelEditing = () => { setEditingMessageId(null); setEditedMessage(""); setEditedPhotoFile(null); };

  const handleUpdateMessage = async (item: Message) => {
    if (!item.edit_token || !myEditTokens.includes(item.edit_token)) { alert("You can only edit your own message."); return; }
    let newPhotoUrl = item.photo_url;
    if (editedPhotoFile) { const url = await uploadPhoto(editedPhotoFile); if (url) newPhotoUrl = url; }
    const { error } = await supabase.from("messages")
      .update({ message: editedMessage, photo_url: newPhotoUrl })
      .eq("id", item.id).eq("edit_token", item.edit_token);
    if (error) { console.error(error); alert("Could not update message."); return; }
    cancelEditing(); fetchCardAndMessages();
  };

  const handleDeleteMessage = async (item: Message) => {
    if (!item.edit_token || !myEditTokens.includes(item.edit_token)) { alert("You can only delete your own message."); return; }
    if (!confirm("Are you sure you want to delete your message?")) return;
    const { error } = await supabase.from("messages").delete()
      .eq("id", item.id).eq("edit_token", item.edit_token);
    if (error) { console.error(error); alert("Could not delete message."); return; }
    fetchCardAndMessages();
  };

  // ── Loading / not found ──────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Clean header — title CENTERED ── */}
 <div className="border-b bg-white">
  <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
    
    {cardLocked ? (
      <div className="flex items-center gap-4 mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-3xl shadow-sm">
          💜
        </div>

        <div>
          <h1 className="text-3xl font-black text-slate-800">
            This Card Is Now Closed
          </h1>

          <p className="text-slate-500 mt-1">
            Thank you to everyone who contributed.
          </p>
        </div>
      </div>
    ) : (
      <>
        <div className="flex items-center gap-3 mx-auto">
          <span className="text-3xl">💌</span>

          <h1 className="text-4xl font-black text-slate-800">
            Sign The Card
          </h1>
        </div>

    
      </>
    )}
  </div>
</div>
      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 lg:p-10 items-start">

        {/* ════════════════════════════════════════
            LEFT — Cover + Sign Form  (UNCHANGED)
        ════════════════════════════════════════ */}
        <section className="space-y-6">

          {/* Cover card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="relative w-full h-56">
              <img src={coverSrc} alt="Card cover" className="w-full h-full object-cover" />
            </div>
            <div className="p-5">
              <p className="text-slate-700 text-sm leading-snug">
                Dear <span className="font-bold">{card.recipient_name}</span>,
                this card was created with love by your team ❤️
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                <span><span className="font-semibold text-slate-700">To: </span>{card.recipient_email || "—"}</span>
                <span><span className="font-semibold text-slate-700">From: </span>{card.sender_name || "—"}</span>
<span>
  <span className="font-semibold text-slate-700">
    Delivery:
  </span>{" "}
  {card.delivery_date
    ? new Date(card.delivery_date).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : "Not scheduled"}

  {card.delivery_date && (
    <span className="ml-2 text-violet-600 font-semibold">
      {timeLeft}
    </span>
  )}
</span>
              </div>
            </div>
          </div>

          {/* Step 1: Who you are */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-extrabold">1</span>
              Who are you?
            </h3>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Your Name</label>
              <input
  type="text"
  placeholder={
    cardLocked
      ? "This card has been closed"
      : "e.g. Sarah Johnson"
  }
  disabled={cardLocked}
  className={`w-full border rounded-xl px-4 py-3 text-sm transition
    ${
      cardLocked
        ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
        : "border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
    }`}
  value={signerName}
  onChange={(e) => setSignerName(e.target.value)}
/>
            </div>
          </div>

          {/* Step 2: Style your message */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-extrabold">2</span>
              Style your message
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-2">Handwriting style</label>
                <div className="grid grid-cols-3 gap-2">
                  {FONTS.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => setSelectedFont(f.name)}
                      className={`py-2 px-3 rounded-xl border-2 text-sm transition ${
                        selectedFont === f.name
                          ? "border-violet-500 bg-violet-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                      style={{ fontFamily: f.name, color: selectedColor }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-2">Ink colour</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      title={c.label}
                      className={`w-8 h-8 rounded-full border-4 transition ${
                        selectedColor === c.hex ? "border-slate-400 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Write your message */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-extrabold">3</span>
              Write your message
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Message
                  <span className="ml-2 font-normal text-xs text-violet-500">✨ Preview updates as you type</span>
                </label>
                <div
                  className="w-full rounded-xl border border-slate-200 overflow-hidden"
                  style={{
                    background: "repeating-linear-gradient(white, white 27px, #e2e8f0 28px)",
                    minHeight: "150px",
                  }}
                >
      <textarea
  placeholder={
    cardLocked
      ? "This card is now closed for new messages"
      : "Write something heartfelt…"
  }
  disabled={cardLocked}
  rows={5}
  className={`w-full px-4 pt-3 pb-3 resize-none text-lg
    ${
      cardLocked
        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
        : "bg-transparent"
    }
    focus:outline-none`}
  style={{
    fontFamily: selectedFont,
    color: cardLocked ? "#94a3b8" : selectedColor,
    lineHeight: "28px",
  }}
  value={message}
  onChange={(e) => setMessage(e.target.value)}
/>
                </div>
              </div>
{!cardLocked && (
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Photo <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-3 bg-slate-50 hover:bg-slate-100 transition">
                  <span className="text-lg shrink-0">📷</span>
                  <span className="text-sm text-slate-400 truncate">
                    {photoFile ? photoFile.name : "Click to choose an image"}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              )}
            </div>
          </div>

          {/* Submit button */}
    <button
  onClick={handleAddMessage}
  disabled={isSubmitting || cardLocked}
            disabled={isSubmitting}
            className="w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-50 bg-violet-700 hover:bg-violet-800"
          >
           {cardLocked
  
  ? "🔒 Card Closed"
  : isSubmitting
  ? "Saving your message…"
  : "✉️ Add My Message"}
          </button>
        </section>

        {/* ════════════════════════════════════════
            RIGHT — Messages from Everyone
            (Only the message LIST itself was updated — flowing handwriting feel)
        ════════════════════════════════════════ */}
        <section className="space-y-6 lg:sticky lg:top-6">

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="relative mb-1">
              <h3 className="text-lg font-bold text-slate-800 text-center">Messages from Everyone</h3>
              {messages.length > 0 && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                  {messages.length} {messages.length === 1 ? "message" : "messages"}
                </span>
              )}
            </div>
            {/* Removed redundant "Page X of Y" — already shown in pagination */}
            {messages.length === 0 && (
              <p className="text-slate-400 text-xs mb-5">
                No messages yet — be the first to sign!
              </p>
            )}

            {/* ─── MESSAGES LIST — drag-to-resize each card ─── */}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                <span className="text-5xl mb-3">✍️</span>
                <p className="text-sm font-medium">Messages will appear here once people sign</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-violet-500 text-center mb-3 italic">
                  Drag the bottom-right corner of any message to resize it
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  {pagedMessages.map((item) => {
                    const isOwner = !!(item.edit_token && myEditTokens.includes(item.edit_token));
                    const font    = item.font_family || "Caveat";
                    const color   = item.text_color  || "#4c1d95";

                    return (
                      <div
                        key={item.id}
                        className="group bg-slate-50 rounded-xl border border-slate-100 overflow-auto relative hover:border-violet-200 transition-colors"
style={{
  resize: cardLocked ? "none" : "both",
  width: "calc(50% - 0.5rem)",
  minWidth: "200px",
  maxWidth: "100%",
  minHeight: "140px",
  overflow: "auto",
}}
                      >
                      <div className="p-4 h-full">
                      {editingMessageId === item.id ? (
                        /* ── EDIT MODE — small clean card ── */
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 shadow-sm">
                          <textarea
                            rows={4}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                            value={editedMessage}
                            onChange={(e) => setEditedMessage(e.target.value)}
                          />
                          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-200 rounded-lg px-3 py-2 bg-white mb-2 text-xs text-slate-400 hover:bg-slate-50 transition">
                            <span>📷</span>
                            {editedPhotoFile ? editedPhotoFile.name : "Replace photo"}
                            <input type="file" accept="image/*" className="hidden"
                              onChange={(e) => setEditedPhotoFile(e.target.files?.[0] || null)} />
                          </label>
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateMessage(item)}
                              className="flex-1 bg-emerald-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition">
                              Save
                            </button>
                            <button onClick={cancelEditing}
                              className="flex-1 bg-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-300 transition">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── VIEW MODE — pure handwriting, no box ── */
                        <>
                          {/* Photo at natural size */}
                          {item.photo_url && (
                            <img
                              src={item.photo_url}
                              alt="Signer photo"
                              className="w-full rounded-lg mb-2 shadow-sm"
                              style={{ maxHeight: "180px", objectFit: "cover" }}
                            />
                          )}

                          {/* The handwritten message */}
                          <p
                            className="text-lg leading-relaxed whitespace-pre-wrap"
                            style={{ fontFamily: font, color }}
                          >
                            {item.message}
                          </p>

                          {/* Signer name — same hand */}
                          <p
                            className="text-base mt-1"
                            style={{ fontFamily: font, color, fontWeight: 600 }}
                          >
                            {item.signer_name}
                          </p>

                          {/* Edit/Delete — visible only on hover for owner */}
                        {isOwner && !cardLocked && (
                            <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditing(item)}
                                className="bg-white text-slate-600 border border-slate-200 px-3 py-0.5 rounded-full text-[10px] font-bold hover:bg-slate-100 transition shadow-sm">
                                ✏️ Edit
                              </button>
                              <button onClick={() => handleDeleteMessage(item)}
                                className="bg-white text-red-600 border border-red-100 px-3 py-0.5 rounded-full text-[10px] font-bold hover:bg-red-50 transition shadow-sm">
                                🗑 Delete
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6 pt-5 border-t border-slate-100">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold disabled:opacity-30 hover:bg-slate-50 transition"
                >
                  ← Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-lg font-bold text-xs transition ${
                      currentPage === p
                        ? "bg-violet-700 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold disabled:opacity-30 hover:bg-slate-50 transition"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}