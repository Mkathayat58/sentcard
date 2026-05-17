"use client";

import { useState } from "react";

export default function CreateCardPage() {

  const [cardType, setCardType] = useState("Farewell Card");
  const [recipient, setRecipient] = useState("");
  const [title, setTitle] = useState("");

  const handleCreateCard = () => {
    console.log("Card Type:", cardType);
    console.log("Recipient:", recipient);
    console.log("Title:", title);

    alert("Card Created Successfully!");
  };

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="max-w-2xl mx-auto bg-white p-10 rounded-2xl shadow-lg">

        <h1 className="text-4xl font-bold mb-8 text-center">
          Create Your Group Card
        </h1>

        <div className="mb-6">
          <label className="block mb-2 font-semibold">
            Card Type
          </label>

          <select
            className="w-full border p-4 rounded-xl"
            value={cardType}
            onChange={(e) => setCardType(e.target.value)}
          >
            <option>Farewell Card</option>
            <option>Welcome Card</option>
            <option>Birthday Card</option>
            <option>Thank You Card</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-semibold">
            Recipient Name
          </label>

          <input
            type="text"
            placeholder="Enter recipient name"
            className="w-full border p-4 rounded-xl"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-semibold">
            Card Title
          </label>

          <input
            type="text"
            placeholder="Farewell John!"
            className="w-full border p-4 rounded-xl"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <button
          className="w-full bg-purple-700 text-white py-4 rounded-xl font-bold text-lg hover:bg-purple-800"
          onClick={handleCreateCard}
        >
          Create Card
        </button>

      </div>
    </main>
  );
}


