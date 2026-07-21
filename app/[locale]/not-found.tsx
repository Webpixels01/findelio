import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6 text-center">
      <div>
        <p className="text-7xl font-extrabold text-[var(--accent)]">404</p>
        <h1 className="mt-4 text-3xl font-extrabold">Seite nicht gefunden</h1>
        <Link href="/" className="primary-button mt-7 h-12 px-6">Zur Startseite</Link>
      </div>
    </main>
  );
}
