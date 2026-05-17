"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

// ── Gallery: add or remove covers here ────────────────────────────────────────
const GALLERY = {
  "Default":          ["/covers/default-cover.svg"],
  "Birthday":         ["/covers/birthday.svg"],
  "Farewell":         ["/covers/farewell.svg"],
  "Welcome":          ["/covers/welcome.svg"],
  "Thank You":        ["/covers/thank-you.svg"],
  "Work Anniversary": ["/covers/anniversary.svg"],
};

const CATEGORIES = Object.keys(GALLERY);

export default function ChooseCoverPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCover = searchParams.get("current") || "";

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedCover, setSelectedCover]   = useState<string>(currentCover);
  const [isUploading, setIsUploading]       = useState(false);

  // Upload custom cover
const [uploadedFileName, setUploadedFileName] = useState<string>("");

const handleUpload = async (file: File) => {
  setIsUploading(true);
  setUploadedFileName("");

  const ext      = file.name.split(".").pop();
  const fileName = `custom-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("card-covers")
    .upload(fileName, file);

  if (error) {
    console.error(error);
    alert("Upload failed. Please try again.");
    setIsUploading(false);
    return;
  }

  const { data } = supabase.storage.from("card-covers").getPublicUrl(fileName);
  setSelectedCover(data.publicUrl);
  setUploadedFileName(file.name);
  setIsUploading(false);
};

  // Confirm & return to create-card
  const handleConfirm = () => {
    if (!selectedCover) {
      alert("Please select or upload a cover first.");
      return;
    }
    localStorage.setItem("selected_cover", selectedCover);
    router.push("/create-card");
  };

  const displayedCovers =
    activeCategory === "All"
      ? Object.values(GALLERY).flat()
      : GALLERY[activeCategory as keyof typeof GALLERY] || [];

  return (
    <main className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b px-6 py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-sm text-slate-500 hover:text-slate-800 transition"
          >
            ← Back
          </button>

        </div>
        <button
          onClick={handleConfirm}
          disabled={!selectedCover}
          className="bg-violet-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-violet-800 disabled:opacity-40 transition"
        >
          Use Selected →
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 lg:p-10">

        {/* Upload your own */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-8">
          <h3 className="text-lg font-bold text-slate-800 mb-2">📤 Upload Your Own Cover</h3>
          <p className="text-sm text-slate-500 mb-4">
            Use a personal photo or design. JPG, PNG or SVG, max 5MB.
          </p>
          <label className={`flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed rounded-xl py-6 transition ${
  uploadedFileName
    ? "border-emerald-400 bg-emerald-50"
    : "border-violet-300 bg-violet-50 hover:bg-violet-100"
}`}>
  {isUploading ? (
    <>
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      <span className="text-sm font-semibold text-violet-700">Uploading…</span>
    </>
  ) : uploadedFileName ? (
    <>
      <span className="text-3xl">✅</span>
      <span className="text-sm font-bold text-emerald-700">
        Uploaded successfully!
      </span>
      <span className="text-xs text-emerald-600 truncate max-w-xs">
        {uploadedFileName}
      </span>
      <span className="text-xs text-slate-500 mt-1">
        Click here to upload a different image
      </span>
    </>
  ) : (
    <>
      <span className="text-2xl">📷</span>
      <span className="text-sm font-semibold text-violet-700">
        Click to choose an image from your device
      </span>
    </>
  )}
  <input
    type="file"
    accept="image/*"
    className="hidden"
    disabled={isUploading}
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    }}
  />
</label>
        </div>

        {/* Gallery */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">🎨 Browse Gallery</h3>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                activeCategory === "All"
                  ? "bg-violet-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  activeCategory === cat
                    ? "bg-violet-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Cover grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedCovers.map((cover) => (
              <button
                key={cover}
                onClick={() => setSelectedCover(cover)}
                className={`relative aspect-[4/3] overflow-hidden rounded-xl border-4 bg-slate-50 transition ${
                  selectedCover === cover
                    ? "border-violet-600 scale-[1.02] shadow-lg"
                    : "border-transparent hover:border-slate-300"
                }`}
              >
                <img src={cover} alt="Cover option" className="w-full h-full object-contain" />
                {selectedCover === cover && (
                  <span className="absolute top-2 right-2 bg-violet-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    ✓ Selected
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}