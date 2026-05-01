import { ImageResponse } from "next/og";

export const alt = "Lippe Forst — Ackerland, Wiesen & Wald im Kreis Lippe verkaufen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#faf8f3",
          background:
            "radial-gradient(ellipse at 80% 0%, rgba(200,155,60,0.12) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(47,93,58,0.45) 0%, transparent 60%), linear-gradient(135deg, #1f2e22 0%, #0d1410 70%, #050807 100%)",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* Top: brand + eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#2f5d3a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "#c89b3c",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "#faf8f3",
                fontFamily: "serif",
              }}
            >
              Lippe Forst
            </span>
            <span
              style={{
                fontSize: 14,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#c89b3c",
                marginTop: 4,
                fontFamily: "sans-serif",
              }}
            >
              Kreis Lippe · Ostwestfalen
            </span>
          </div>
        </div>

        {/* Middle: headline */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <p
            style={{
              fontSize: 78,
              lineHeight: 1.05,
              fontWeight: 600,
              fontFamily: "serif",
              color: "#faf8f3",
              margin: 0,
              letterSpacing: "-0.015em",
            }}
          >
            Ihre Fläche verdient
            <br />
            einen guten Nachfolger.
          </p>
          <p
            style={{
              marginTop: 26,
              fontSize: 26,
              lineHeight: 1.45,
              color: "rgba(250,248,243,0.78)",
              fontFamily: "sans-serif",
              maxWidth: 900,
            }}
          >
            Direktankauf, Verpachtung &amp; Bewertung von Ackerland, Wiesen und Wald — fair, regional, diskret.
          </p>
        </div>

        {/* Bottom: badges */}
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {[
            "Ohne Provision",
            "100 % Diskretion",
            "Antwort in 24 h",
          ].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 18,
                color: "rgba(250,248,243,0.85)",
                fontFamily: "sans-serif",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#c89b3c",
                }}
              />
              {t}
            </div>
          ))}
          <div
            style={{
              marginLeft: "auto",
              fontSize: 18,
              color: "rgba(250,248,243,0.55)",
              fontFamily: "sans-serif",
              letterSpacing: "0.06em",
            }}
          >
            lippeforst.de
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
