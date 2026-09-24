"use client";

/** Absende-Knopf mit Sicherheitsabfrage (z. B. Freigabe, Sperre, Vorlage freigeben). */
export default function BestaetigenKnopf({
  children,
  frage,
  tipp,
  className = "lfa-knopf lfa-knopf-klein",
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  frage: string;
  tipp: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      title={tipp}
      disabled={disabled}
      name={name}
      value={value}
      onClick={(e) => {
        if (!window.confirm(frage)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
