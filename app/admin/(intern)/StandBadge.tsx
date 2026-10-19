import Link from "next/link";
import { TON_KLASSE, type Anzeige } from "@/lib/admin/online-stand";

/** Abzeichen mit kleiner Zeile darunter — für die Spalten „Konto“ und „Auf der Seite“ der Anfragen-Liste. */
export default function StandBadge({ a }: { a: Anzeige }) {
  const badge = (
    <span className={`lfa-badge ${TON_KLASSE[a.ton]}`} title={a.tipp}>
      {a.label}
    </span>
  );
  return (
    <div className="lfa-zelle-stapel">
      {a.href && a.oeffentlich ? (
        <a href={a.href} target="_blank" rel="noopener" className="lfa-stand-link">
          {badge}
        </a>
      ) : a.href ? (
        <Link href={a.href} className="lfa-stand-link">
          {badge}
        </Link>
      ) : (
        badge
      )}
      {a.detail && (
        <span className="lfa-klein" title={a.tipp}>
          {a.detail}
        </span>
      )}
    </div>
  );
}
