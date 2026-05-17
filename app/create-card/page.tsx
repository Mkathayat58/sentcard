"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const CARD_TYPES = [
  "Farewell Card",
  "Birthday Card",
  "Welcome Card",
  "Thank You Card",
  "Work Anniversary",
];

const DEFAULT_COVER = "/covers/default-cover.svg";

const TITLE_SUGGESTIONS: Record<string, (name: string) => string> = {
  "Farewell Card":    (n) => `Farewell${n ? ", " + n : ""}! We'll Miss You 👋`,
  "Birthday Card":    (n) => `Happy Birthday${n ? ", " + n : ""}! 🎉`,
  "Welcome Card":     (n) => `Welcome to the Team${n ? ", " + n : ""}! 🎊`,
  "Thank You Card":   (n) => `Thank You${n ? ", " + n : ""}! 🙏`,
  "Work Anniversary": (n) => `Happy Work Anniversary${n ? ", " + n : ""}! 🥳`,
};

export default function CreateCardPage() {
  const router = useRouter();

  const [cardType, setCardType] = useState("Farewell Card");
  const [recipient, setRecipient] = useState("");
  const [title, setTitle] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [selectedCover, setSelectedCover] = useState(DEFAULT_COVER);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCustomCover, setHasCustomCover] = useState(false);

  // Pick up cover when returning from /choose-cover
  useEffect(() => {
    const stored = localStorage.getItem("selected_cover");
    if (stored) {
      setSelectedCover(stored);
      setHasCustomCover(true);
      localStorage.removeItem("selected_cover");
    }
  }, []);

  // Auto-suggest title when card type or recipient name changes
  useEffect(() => {
    setTitle(TITLE_SUGGESTIONS[cardType]?.(recipient) ?? "");
  }, [cardType, recipient]);

  const handleCreateCard = async () => {
    if (!recipient || !title || !recipientEmail || !senderName) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("cards")
      .insert([{
        card_type:       cardType,
        recipient_name:  recipient,
        card_title:      title,
        template:        "Elegant Purple",
        recipient_email: recipientEmail.toLowerCase(),
        sender_name:     senderName,
        delivery_date: deliveryDate ? new Date(deliveryDate).toISOString() : null,
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

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5 shadow-sm text-center">
        <h1 className="text-3xl font-extrabold text-slate-800">
          ✉️ Create Your Card
        </h1>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 p-6 lg:p-10">

        {/* LEFT — Cover Preview */}
        <section className="flex flex-col items-center lg:sticky lg:top-6 lg:self-start">
  <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 w-full">
            <img
              src={selectedCover}
              alt="Selected cover"
              className="w-full aspect-[16/10] object-contain rounded-2xl bg-slate-50 mb-4"
            />

            <button
              type="button"
              onClick={() =>
                router.push(`/choose-cover?current=${encodeURIComponent(selectedCover)}`)
              }
              className="w-full border-2 border-dashed border-slate-300 text-slate-600 px-6 py-3 rounded-2xl font-semibold hover:border-violet-400 hover:text-violet-700 transition"
            >
              Choose a Different Cover
            </button>

            {hasCustomCover && (
              <p className="text-xs text-violet-500 text-center mt-2">
                ✨ Custom cover selected
              </p>
            )}
          </div>
        </section>

        {/* RIGHT — Form */}
        <section className="space-y-8">

          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              1. Who is this card for &amp; from?
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Recipient Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Johnson"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Recipient Email *</label>
                <input
                  type="email"
                  placeholder="sarah@company.com"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-600 mb-1">Your Name (Sender) *</label>
                <input
                  type="text"
                  placeholder="e.g. The Engineering Team"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4">2. Card Details</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Card Type</label>
                <select
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value)}
                >
                  {CARD_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Card Title</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Delivery Date &amp; Time (Must Have)
                </label>
                <input
                  type="datetime-local"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateCard}
            disabled={isLoading}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-violet-600 to-indigo-500 disabled:opacity-50"
          >
            {isLoading ? "Creating your card..." : "Continue to Payment →"}
          </button>
        </section>
      </div>
    </main>
  );
}