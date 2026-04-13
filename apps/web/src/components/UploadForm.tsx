"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { VideoUploadUrlResponse } from "@nichestream/types";

const VIDEO_STYLES = ["digital", "traditional", "mixed_media", "3d"];
const VIDEO_TOOLS = ["procreate", "clip_studio", "photoshop", "krita", "affinity", "blender", "maya", "traditional_media", "other"];
const VIDEO_GENRES = ["animation", "comic", "illustration", "character_design", "concept_art", "afro_fantasy", "sci_fi", "animation_short", "process_video", "tutorial", "speedart", "other"];

/**
 * Multi-step video upload form:
 * 1. Get a direct upload URL from Cloudflare Stream
 * 2. Upload the file directly to Stream (bypasses our Worker)
 * 3. PATCH the video record with title, description, visibility, and BlerdArt metadata
 */
export function UploadForm() {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "meta" | "uploading" | "done">("select");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "subscribers_only" | "unlocked_only">("public");
  const [style, setStyle] = useState("");
  const [tool, setTool] = useState("");
  const [genre, setGenre] = useState("");
  const [tags, setTags] = useState("");
  const [humanCreatedAffirmed, setHumanCreatedAffirmed] = useState(true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("video/")) {
      setError("Please select a video file.");
      return;
    }

    if (selected.size > 10 * 1024 * 1024 * 1024) {
      setError("File size must be under 10 GB.");
      return;
    }

    setFile(selected);
    setTitle(selected.name.replace(/\.[^.]+$/, ""));
    setError(null);
    setStep("meta");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStep("uploading");
    setError(null);

    try {
      // Step 1: Get upload URL
      const { uploadUrl, videoId } = await api.post<VideoUploadUrlResponse>(
        "/api/videos/upload-url",
        { maxDurationSeconds: 7200 },
      );

      // Step 2: Upload file directly to Cloudflare Stream
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.open("POST", uploadUrl);
        const formData = new FormData();
        formData.append("file", file);
        xhr.send(formData);
      });

      // Step 3: Update video metadata
      await api.patch(`/api/videos/${videoId}`, {
        title: title.trim() || "Untitled",
        description: description.trim() || undefined,
        visibility,
        status: "ready",
        // BlerdArt metadata (optional)
        ...(style && { style }),
        ...(tool && { tool }),
        ...(genre && { genre }),
        ...(tags && { tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }),
        // Creator affirmation and watermark
        humanCreatedAffirmed,
        watermarkEnabled,
      });

      setStep("done");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("meta");
    }
  }

  if (step === "done") {
    return (
      <div className="rounded-xl border border-green-700 bg-green-950 p-8 text-center">
        <p className="text-xl font-bold text-green-400">Upload complete! 🎉</p>
        <p className="mt-2 text-neutral-300">Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-700 bg-red-950 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {step === "select" && (
        <div>
          <label
            htmlFor="video-file"
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-700 bg-neutral-900 p-12 transition hover:border-brand-500"
          >
            <svg
              className="h-12 w-12 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-neutral-300">
              Click to select or drag a video file
            </span>
            <span className="text-sm text-neutral-500">MP4, MOV, AVI up to 10 GB</span>
          </label>
          <input
            id="video-file"
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="sr-only"
            aria-label="Select video file"
          />
        </div>
      )}

      {(step === "meta" || step === "uploading") && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Progress bar */}
          {step === "uploading" && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-neutral-300">Uploading…</span>
                <span className="tabular-nums text-neutral-400">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-700">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-neutral-300">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              disabled={step === "uploading"}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none disabled:opacity-50"
              placeholder="My awesome video"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-neutral-300">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={5000}
              disabled={step === "uploading"}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none disabled:opacity-50"
              placeholder="Tell viewers what this video is about"
            />
          </div>

          <div>
            <label htmlFor="visibility" className="mb-1 block text-sm font-medium text-neutral-300">
              Visibility
            </label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              disabled={step === "uploading"}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-white focus:border-brand-500 focus:outline-none disabled:opacity-50"
            >
              <option value="public">Public</option>
              <option value="subscribers_only">Subscribers Only</option>
              <option value="unlocked_only">Pay-Per-View (Unlock)</option>
            </select>
          </div>

          {/* BlerdArt Metadata (Optional) */}
          <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
            <p className="mb-4 text-sm font-medium text-neutral-300">Creative Details (Optional)</p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="style" className="mb-1 block text-xs font-medium text-neutral-400">
                  Art Style
                </label>
                <select
                  id="style"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  disabled={step === "uploading"}
                  className="w-full rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select style</option>
                  {VIDEO_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tool" className="mb-1 block text-xs font-medium text-neutral-400">
                  Primary Tool
                </label>
                <select
                  id="tool"
                  value={tool}
                  onChange={(e) => setTool(e.target.value)}
                  disabled={step === "uploading"}
                  className="w-full rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select tool</option>
                  {VIDEO_TOOLS.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="genre" className="mb-1 block text-xs font-medium text-neutral-400">
                  Genre
                </label>
                <select
                  id="genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  disabled={step === "uploading"}
                  className="w-full rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select genre</option>
                  {VIDEO_GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tags" className="mb-1 block text-xs font-medium text-neutral-400">
                  Tags (comma-separated)
                </label>
                <input
                  id="tags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={step === "uploading"}
                  maxLength={200}
                  placeholder="digital art, character design, tutorial"
                  className="w-full rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Creator Affirmation & Watermark */}
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={humanCreatedAffirmed}
                onChange={(e) => setHumanCreatedAffirmed(e.target.checked)}
                disabled={step === "uploading"}
                className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 accent-brand-500 disabled:opacity-50"
              />
              <span className="text-sm text-neutral-300">
                I affirm this video is human-created
                <span className="block text-xs text-neutral-500">
                  Help combat AI art and IP theft. AI creations must be labeled as such.
                </span>
              </span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={watermarkEnabled}
                onChange={(e) => setWatermarkEnabled(e.target.checked)}
                disabled={step === "uploading"}
                className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 accent-brand-500 disabled:opacity-50"
              />
              <span className="text-sm text-neutral-300">
                Add BlerdArt watermark
                <span className="block text-xs text-neutral-500">
                  Visible watermark protects your artwork from unauthorized use.
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={step === "uploading" || !title.trim() || !humanCreatedAffirmed}
            className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {step === "uploading" ? "Uploading…" : "Upload Video"}
          </button>
        </form>
      )}
    </div>
  );
}
