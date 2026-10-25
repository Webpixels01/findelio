import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DesignPreview from "./preview";

export const metadata: Metadata = {
  title: "Findelio · Designvorschau",
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DesignPreview />;
}
