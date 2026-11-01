import { setRequestLocale } from "next-intl/server";
import { ReviewManager } from "@/components/customer-reviews";

export default async function ReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReviewManager />;
}
