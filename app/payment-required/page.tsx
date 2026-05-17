"use client";

import { useSearchParams } from "next/navigation";

export default function PaymentRequiredPage() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get("cardId");

  const handlePayment = async () => {
    if (!cardId) {
      alert("Missing card ID.");
      return;
    }

    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cardId }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Could not start payment.");
    }
  };

  return (

    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-10">
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-xl p-10 text-center">
        <h1 className="text-4xl font-bold text-purple-700 mb-6">
          Your Card Is Ready 🎉
        </h1>

        <p className="text-lg text-slate-700 mb-8">
          Complete your payment to activate the signer link, photo uploads,
          scheduled delivery, and email sending.
        </p>

        <div className="bg-purple-50 rounded-2xl p-6 mb-8">
          <p className="text-2xl font-bold text-purple-700">
            Premium Group E-Card
          </p>
          <p className="text-4xl font-bold mt-3">$4.99 AUD</p>
        </div>

        <button
          onClick={handlePayment}
          className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700"
        >
          Pay Now
        </button>

        <p className="text-sm text-slate-500 mt-6">
          Secure payment powered by Stripe.
        </p>
      </div>
    </main>
  );
}