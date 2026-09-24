import type { Metadata } from "next";
import "../vertrag.css";
import "./verwaltung.css";

export const metadata: Metadata = {
  title: { default: "Verwaltung", template: "%s · Verwaltung Lippe Forst" },
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: null },
};

export default function VerwaltungLayout({ children }: { children: React.ReactNode }) {
  return <div className="lfa">{children}</div>;
}
