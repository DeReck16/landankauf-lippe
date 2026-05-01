"use client";

import { useState } from "react";

type Props = {
  encoded: string;
  type?: "tel" | "mailto" | "whatsapp";
  prefix?: string;
  label?: string;
  className?: string;
  revealedClassName?: string;
};

function decode(encoded: string) {
  if (typeof window === "undefined") return "";
  try {
    return atob(encoded);
  } catch {
    return "";
  }
}

export default function ClickToReveal({
  encoded,
  type = "tel",
  prefix = "",
  label = "Nummer anzeigen",
  className = "",
  revealedClassName = "",
}: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);

  function handle() {
    const value = decode(encoded);
    setRevealed(value);
  }

  if (!revealed) {
    return (
      <button type="button" onClick={handle} className={className}>
        {prefix}
        <span className="underline">{label}</span>
      </button>
    );
  }

  const display =
    type === "tel"
      ? formatPhone(revealed)
      : type === "whatsapp"
        ? `WhatsApp: ${formatPhone(revealed)}`
        : revealed;

  const href =
    type === "tel"
      ? `tel:${revealed.replace(/\s/g, "")}`
      : type === "whatsapp"
        ? `https://wa.me/${revealed.replace(/[^0-9]/g, "")}`
        : `mailto:${revealed}`;

  return (
    <a href={href} className={revealedClassName || className} rel="nofollow noopener" target={type === "whatsapp" ? "_blank" : undefined}>
      {prefix}
      {display}
    </a>
  );
}

function formatPhone(p: string) {
  const cleaned = p.replace(/[^+0-9]/g, "");
  if (cleaned.startsWith("+49")) {
    const rest = cleaned.slice(3);
    return `0${rest.slice(0, 3)} ${rest.slice(3)}`;
  }
  return p;
}
