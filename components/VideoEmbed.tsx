"use client";

import { useState } from "react";
import Link from "next/link";

export default function VideoEmbed() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="bg-[#0d1410] text-white py-16 md:py-20 px-5">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr] items-center">
        <div>
          <span className="eyebrow text-[color:var(--color-accent)]">Erklärfilm · 42 Sek.</span>
          <hr className="divider mt-3 bg-[color:var(--color-accent)]" />
          <h2 className="text-3xl md:text-4xl text-white">In 42 Sekunden, was wir machen.</h2>
          <p className="mt-4 text-white/80 leading-relaxed">
            Wie aus einer brachliegenden Wiese ein verlässlicher Ertrag wird — über Direktankauf, Vertragsnaturschutz, Ökopunkte oder eine kombinierte Strategie. Ohne Voice-Over, in Ihrem Tempo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/flaeche-bewerten" className="btn-on-dark">
              Jetzt bewerten
            </Link>
            <Link href="/kontakt#formular" className="btn-secondary border-white/40 text-white hover:bg-white/10">
              Direkt anfragen
            </Link>
          </div>
        </div>
        <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#050807]">
          {!playing ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Video abspielen"
              className="absolute inset-0 flex items-center justify-center group cursor-pointer"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 50%, rgba(45,74,54,0.45), rgba(13,20,16,0.95))",
              }}
            >
              <div
                aria-hidden
                className="absolute inset-0 opacity-30 pointer-events-none bg-cover bg-center"
                style={{ backgroundImage: "url('/wald.webp')" }}
              />
              <div className="absolute inset-0 bg-[#050807]/40" />
              <div className="relative flex flex-col items-center gap-4 z-10">
                <span className="block w-20 h-20 rounded-full bg-[color:var(--color-accent)]/95 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xl">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#0d1410">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <p className="font-serif text-xl text-white">Lippe Forst — Erklärfilm</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent)]">42 Sek. · ohne Ton</p>
              </div>
            </button>
          ) : (
            <iframe
              src="/video/index.html"
              title="Lippe Forst Erklärfilm"
              className="absolute inset-0 w-full h-full border-0"
              loading="lazy"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </section>
  );
}
