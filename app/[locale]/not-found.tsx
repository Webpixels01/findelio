import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6 text-center">
      <div>
        <p className="text-7xl font-extrabold text-[var(--accent)]">404</p>
        <h1 className="mt-4 text-3xl font-extrabold">{t("title")}</h1>
        <Link href="/" className="primary-button mt-7 h-12 px-6">{t("home")}</Link>
      </div>
    </main>
  );
}
