"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardId = searchParams.get("cardId");

  useEffect(() => {
    const markAsPaid = async () => {
      if (!cardId) return;

      await supabase
        .from("cards")
        .update({ payment_status: "paid" })
        .eq("id", cardId);

      router.push(`/sign-card?id=${cardId}`);
    };

    markAsPaid();
  }, [cardId, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-2xl font-bold">Payment successful. Activating your card...</p>
    </main>
  );
}