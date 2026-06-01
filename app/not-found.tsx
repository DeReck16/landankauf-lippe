import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 bg-[#1c2519] text-white">
      <p className="text-7xl font-black text-[#c89b3c] mb-4">404</p>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
        Seite nicht gefunden
      </h1>
      <p className="text-white/70 max-w-md mb-8">
        Diese Seite gibt es nicht (mehr). Auf der Startseite finden Sie alles rund um Ackerland, Wald und Wiesen im Kreis Lippe.
      </p>
      <Link
        href="/"
        className="px-8 py-4 bg-[#c89b3c] text-[#1c2519] font-bold tracking-widest text-sm rounded-full hover:scale-105 transition-all"
      >
        Zur Startseite
      </Link>
    </main>
  );
}
