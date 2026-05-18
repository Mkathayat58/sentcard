"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const DEFAULT_COVER = "/covers/default-cover.svg";

// ── Smart suggestions for the occasion field ──────────────────────────────
const OCCASION_SUGGESTIONS = [
  { emoji: "🎂", label: "Birthday" },
  { emoji: "👋", label: "Farewell" },
  { emoji: "🎊", label: "Welcome" },
  { emoji: "🙏", label: "Thank You" },
  { emoji: "🥳", label: "Anniversary" },
  { emoji: "🎓", label: "Graduation" },
  { emoji: "💍", label: "Wedding" },
  { emoji: "👶", label: "Baby Shower" },
  { emoji: "🏠", label: "Housewarming" },
  { emoji: "💐", label: "Get Well Soon" },
  { emoji: "🌟", label: "New Job" },
  { emoji: "🎄", label: "Holiday Wishes" },
];

// ── Themed gradients based on occasion keyword ────────────────────────────
const THEMES: Record<string, { from: string; to: string; emoji: string }> = {
  birthday:    { from: "#f59e0b", to: "#ec4899", emoji: "🎂" },
  farewell:    { from: "#7c3aed", to: "#6366f1", emoji: "👋" },
  welcome:     { from: "#10b981", to: "#06b6d4", emoji: "🎊" },
  thank:       { from: "#f59e0b", to: "#eab308", emoji: "🙏" },
  anniversary: { from: "#ec4899", to: "#f43f5e", emoji: "🥳" },
  graduation:  { from: "#3b82f6", to: "#8b5cf6", emoji: "🎓" },
  wedding:     { from: "#fda4af", to: "#e879f9", emoji: "💍" },
  baby:        { from: "#fcd34d", to: "#fda4af", emoji: "👶" },
  house:       { from: "#84cc16", to: "#10b981", emoji: "🏠" },
  well:        { from: "#06b6d4", to: "#22d3ee", emoji: "💐" },
  job:         { from: "#6366f1", to: "#3b82f6", emoji: "🌟" },
  holiday:     { from: "#dc2626", to: "#16a34a", emoji: "🎄" },
  christmas:   { from: "#dc2626", to: "#16a34a", emoji: "🎄" },
  default:     { from: "#7c3aed", to: "#6366f1", emoji: "💌" },
};

// Match occasion text to a theme
const detectTheme = (occasion: string) => {
  const lower = occasion.toLowerCase();
  for (const key of Object.keys(THEMES)) {
    if (lower.includes(key)) return THEMES[key];
  }
  return THEMES.default;
};

// ── Smart title generator from occasion + recipient ───────────────────────
const generateTitle = (occasion: string, recipient: string) => {
  const lower = occasion.toLowerCase();
  const name = recipient || "";
  const nameSuffix = name ? `, ${name}` : "";

  if (lower.includes("birthday"))     return `Happy Birthday${nameSuffix}! 🎉`;
  if (lower.includes("farewell"))     return `Farewell${nameSuffix}! We'll Miss You 👋`;
  if (lower.includes("welcome"))      return `Welcome to the Team${nameSuffix}! 🎊`;
  if (lower.includes("thank"))        return `Thank You${nameSuffix}! 🙏`;
  if (lower.includes("anniversary"))  return `Happy Anniversary${nameSuffix}! 🥳`;
  if (lower.includes("graduation"))   return `Congrats on Graduating${nameSuffix}! 🎓`;
  if (lower.includes("wedding"))      return `Congratulations${nameSuffix}! 💍`;
  if (lower.includes("baby"))         return `Congrats${nameSuffix}! 👶`;
  if (lower.includes("house"))        return `Welcome to Your New Home${nameSuffix}! 🏠`;
  if (lower.includes("well"))         return `Get Well Soon${nameSuffix}! 💐`;
  if (lower.includes("job"))          return `Congrats on the New Job${nameSuffix}! 🌟`;
  if (lower.includes("holiday") || lower.includes("christmas"))
    return `Season's Greetings${nameSuffix}! 🎄`;
  if (occasion)                       return `${occasion}${nameSuffix} 💌`;
  return name ? `A Special Card for ${name} 💌` : "";
};

// ── Quick delivery presets ────────────────────────────────────────────────
const getPresetDate = (days: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  // Format for datetime-local: YYYY-MM-DDTHH:MM
  return d.toISOString().slice(0, 16);
};

const DELIVERY_PRESETS = [
  { label: "Tomorrow 9am",  getValue: () => getPresetDate(1) },
  { label: "In 3 days",     getValue: () => getPresetDate(3) },
  { label: "Next week",     getValue: () => getPresetDate(7) },
  { label: "In 2 weeks",    getValue: () => getPresetDate(14) },
];

// ── Component ─────────────────────────────────────────────────────────────
export default function CreateCardPage() {
  const router = useRouter();

  const [occasion, setOccasion]   = useState("");
  const [recipient, setRecipient] = useState("");
  const [title, setTitle]         = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderName, setSenderName]         = useState("");
  const [deliveryDate, setDeliveryDate]     = useState("");
  const [selectedCover, setSelectedCover]   = useState(DEFAULT_COVER);
  const [hasCustomCover, setHasCustomCover] = useState(false);
  const [isLoading, setIsLoading]           = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPreview, setShowPreview]       = useState(false);

  // Pick up cover from gallery
  useEffect(() => {
    const stored = localStorage.getItem("selected_cover");
    if (stored) {
      setSelectedCover(stored);
      setHasCustomCover(true);
      localStorage.removeItem("selected_cover");
    }
  }, []);

  // Auto-suggest title from occasion + recipient
  useEffect(() => {
    setTitle(generateTitle(occasion, recipient));
  }, [occasion, recipient]);

  // Detect theme from occasion
  const theme = detectTheme(occasion);

  // Progress calculation
  const fields = [occasion, recipient, recipientEmail, senderName, deliveryDate];
  const completedCount = fields.filter(Boolean).length;
  const progress = (completedCount / fields.length) * 100;

  // Friendly relative time for delivery date
  const getRelativeTime = () => {
    if (!deliveryDate) return null;
    const target = new Date(deliveryDate).getTime();
    const now = Date.now();
    const diff = target - now;
    if (diff < 0) return "⚠️ Date is in the past";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `📅 In ${days} day${days > 1 ? "s" : ""}, ${hours}h`;
    if (hours > 0) return `⏰ In ${hours} hour${hours > 1 ? "s" : ""}`;
    return "⏰ In less than an hour";
  };

  const handleCreateCard = async () => {
    if (!recipient || !title || !recipientEmail || !senderName) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("cards")
      .insert([{
        card_type:       occasion || "Card",
        recipient_name:  recipient,
        card_title:      title,
        template:        "Elegant Purple",
        recipient_email: recipientEmail.toLowerCase(),
        sender_name:     senderName,
        delivery_date:   deliveryDate ? new Date(deliveryDate).toISOString() : null,
        payment_status:  "pending",
        cover_image:     selectedCover,
      }])
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("Something went wrong while creating the card.");
      setIsLoading(false);
      return;
    }

    router.push(`/payment-required?cardId=${data.id}`);
  };

  // Minimum delivery date (now)
  const minDate = new Date().toISOString().slice(0, 16);

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Header with progress bar ── */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 text-center">
          <h1 className="text-3xl font-extrabold text-slate-800">
            ✉️ Create Your Card
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {progress === 100 ? "Looking great! Ready to send 🎉" : `You're ${Math.round(progress)}% there`}
          </p>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${theme.from}, ${theme.to})`,
            }}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 p-6 lg:p-10">

        {/* ════════════════════════════════════════
            LEFT — Live Card Preview
        ════════════════════════════════════════ */}
        <section className="flex flex-col items-center lg:sticky lg:top-6 lg:self-start">

          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 w-full overflow-hidden">

            {/* Cover image with live overlay */}
            <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-slate-50 mb-4">
              <img
                src={selectedCover}
                alt="Selected cover"
                className="w-full h-full object-cover"
              />
              {/* Themed gradient overlay */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                }}
              />
              {/* Live text overlay */}
              <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                <p className="text-xs uppercase tracking-widest opacity-80 mb-1">
                  {theme.emoji} {occasion || "Your Card"}
                </p>
                <h2
                  className="text-2xl font-extrabold leading-tight mb-2 drop-shadow-lg"
                  style={{ fontFamily: "Dancing Script, cursive", fontSize: "2.2rem", fontWeight: 700 }}
                >
                  {title || "Your card title appears here"}
                </h2>
                {recipient && (
                  <p className="text-sm opacity-90 drop-shadow">
                    For <span className="font-bold">{recipient}</span>
                    {senderName && <> · from <span className="font-bold">{senderName}</span></>}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(`/choose-cover?current=${encodeURIComponent(selectedCover)}`)
              }
              className="w-full border-2 border-dashed border-slate-300 text-slate-600 px-6 py-3 rounded-2xl font-semibold hover:border-violet-400 hover:text-violet-700 transition"
            >
              🖼 Choose a Different Cover
            </button>

            {hasCustomCover && (
              <p className="text-xs text-violet-500 text-center mt-2">
                ✨ Custom cover selected
              </p>
            )}
          </div>

          {/* Preview button */}
          {recipient && title && (
            <button
              onClick={() => setShowPreview(true)}
              className="mt-4 text-sm text-slate-500 hover:text-violet-700 transition underline"
            >
              👁 Preview what {recipient} will see
            </button>
          )}
        </section>

        {/* ════════════════════════════════════════
            RIGHT — Form
        ════════════════════════════════════════ */}
        <section className="space-y-6">

          {/* Step 1: The Occasion */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-extrabold">1</span>
              What's the occasion?
            </h3>

            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Birthday, Wedding, Graduation, Farewell…"
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-base"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />

              {/* Suggestion chips */}
              {showSuggestions && !occasion && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {OCCASION_SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setOccasion(s.label)}
                      className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-violet-50 hover:text-violet-700 text-sm text-slate-700 transition border border-slate-200"
                    >
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              💡 Don't see your occasion? Just type it — anything goes!
            </p>
          </div>

          {/* Step 2: Who */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-extrabold">2</span>
              Who's it for &amp; from?
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Who's this for? 💝
                </label>
                <input
                  type="text"
                  placeholder="Their name"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Their email 📧
                </label>
                <input
                  type="email"
                  placeholder="Where to deliver"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  And who's it from? 💌
                </label>
                <input
                  type="text"
                  placeholder="Your name or team name"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Step 3: Card Title */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-extrabold">3</span>
              Card title
              <span className="ml-2 font-normal text-xs text-violet-500">✨ auto-suggested, you can edit</span>
            </h3>

            <input
              type="text"
              placeholder="Your card title"
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-base"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Step 4: When */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-sm font-extrabold">4</span>
              When should we deliver it?
            </h3>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2 mb-3">
              {DELIVERY_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDeliveryDate(p.getValue())}
                  className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-violet-50 hover:text-violet-700 text-sm text-slate-700 transition border border-slate-200"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <input
              type="datetime-local"
              min={minDate}
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />

            {deliveryDate && (
              <p className="mt-2 text-sm font-semibold" style={{ color: theme.from }}>
                {getRelativeTime()}
              </p>
            )}
          </div>

          {/* Pricing banner */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3 border"
            style={{
              background: `linear-gradient(135deg, ${theme.from}10, ${theme.to}10)`,
              borderColor: `${theme.from}30`,
            }}
          >
            <span className="text-2xl">💜</span>
            <div className="flex-1">
              <p className="font-bold text-slate-800">$4.99 one-time</p>
              <p className="text-xs text-slate-500">
                Unlimited signers · Photos · Scheduled delivery · Lifetime access
              </p>
            </div>
          </div>

          {/* Submit button */}
          <button
            onClick={handleCreateCard}
            disabled={isLoading}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg"
            style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
          >
            {isLoading ? "Creating your card..." : "Continue to Payment →"}
          </button>
        </section>
      </div>

      {/* ── Preview modal ── */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              📧 What {recipient} will see in their inbox
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
              <p className="text-xs text-slate-400 mb-1">Subject:</p>
              <p className="font-bold text-slate-700">💌 {title}</p>
              <p className="text-xs text-slate-400 mt-2 mb-1">Preview:</p>
              <p className="text-sm text-slate-600 italic">
                Dear {recipient}, {senderName || "your team"} has put together a special card just for you...
              </p>
            </div>
            <p className="text-xs text-slate-500 italic">
              ⏰ Will be delivered on the date you chose above.
            </p>
            <button
              onClick={() => setShowPreview(false)}
              className="mt-4 w-full bg-slate-100 text-slate-700 py-2 rounded-xl font-semibold hover:bg-slate-200 transition"
            >
              Close preview
            </button>
          </div>
        </div>
      )}
    </main>
  );
}