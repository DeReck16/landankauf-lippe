import type { Dokument } from "@/lib/vertraege/dokument";

/**
 * Bildschirmansicht eines Vertragsdokuments — derselbe Text wie im PDF.
 * Stile: app/vertrag.css (Präfix lfd-), eingebunden in Verwaltung und Kundenbereich.
 */
export default function VertragsText({ dok, kompakt = false }: { dok: Dokument; kompakt?: boolean }) {
  return (
    <article className={`lfd ${kompakt ? "lfd-kompakt" : ""}`}>
      <h2 className="lfd-titel">{dok.titel}</h2>
      {dok.untertitel && <p className="lfd-untertitel">{dok.untertitel}</p>}
      {dok.bloecke.map((b, i) => {
        switch (b.t) {
          case "h2":
            return <h3 key={i} className="lfd-h2">{b.text}</h3>;
          case "h3":
            return <h4 key={i} className="lfd-h3">{b.text}</h4>;
          case "p":
            return <p key={i} className="lfd-p">{b.text}</p>;
          case "liste":
            return b.nummeriert ? (
              <ol key={i} className="lfd-liste lfd-liste-nr">
                {b.items.map((x, j) => <li key={j}>{x}</li>)}
              </ol>
            ) : (
              <ul key={i} className="lfd-liste">
                {b.items.map((x, j) => <li key={j}>{x}</li>)}
              </ul>
            );
          case "kasten":
            return (
              <div key={i} className="lfd-kasten">
                {b.titel && <p className="lfd-kasten-titel">{b.titel}</p>}
                {b.absaetze.map((a, j) => <p key={j}>{a}</p>)}
              </div>
            );
          case "felder":
            return (
              <dl key={i} className="lfd-felder">
                {b.zeilen.map(([n, w], j) => (
                  <div key={j}>
                    <dt>{n}</dt>
                    <dd>{w}</dd>
                  </div>
                ))}
              </dl>
            );
          case "trenner":
            return <hr key={i} className="lfd-trenner" />;
        }
      })}
    </article>
  );
}
