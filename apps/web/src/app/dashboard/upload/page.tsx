import type { Metadata } from "next";
import { UploadForm } from "@/components/UploadForm";

export const metadata: Metadata = { title: "Upload Video" };

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold text-white">Upload Video</h1>
      <UploadForm />
    </div>
  );
}
