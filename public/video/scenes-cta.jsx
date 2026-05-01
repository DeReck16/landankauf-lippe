// Scene 6 (25-29s): Naturschutz / ESG
// Scene 7 (29-32s): Persönliche Beratung
// Scene 8 (32-35s): CTA Kontaktformular

function SceneNature() {
  return (
    <Sprite start={30.7} end={35.2}>
      <SceneNatureInner />
    </Sprite>
  );
}

function SceneNatureInner() {
  const { localTime } = useSprite();

  const imgOp = animate({ from: 0, to: 1, start: 0.1, end: 1.2, ease: Easing.easeOutCubic })(localTime);
  const imgScale = 1 + 0.05 * (localTime / 4.5);

  const overlayOp = animate({ from: 0, to: 1, start: 0.6, end: 1.4 })(localTime);

  const ebOp = animate({ from: 0, to: 1, start: 0.9, end: 1.5 })(localTime);
  const titleOp = animate({ from: 0, to: 1, start: 1.2, end: 2.0 })(localTime);
  const titleY = animate({ from: 22, to: 0, start: 1.2, end: 2.0, ease: Easing.easeOutCubic })(localTime);

  const subOp = animate({ from: 0, to: 1, start: 2.0, end: 2.6 })(localTime);

  const exit = animate({ from: 1, to: 0, start: 4.0, end: 4.5, ease: Easing.easeInCubic })(localTime);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: exit }}>
      <div style={{
        position: 'absolute', inset: 0,
        opacity: imgOp,
        transform: `scale(${imgScale})`,
      }}>
        <PhotoPlaceholder label="Mischwald · Buche & Eiche" tone="forest" />
      </div>

      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(13,20,16,0.45) 0%, rgba(13,20,16,0.4) 50%, rgba(13,20,16,0.92) 100%)',
        opacity: overlayOp,
      }}/>

      <div style={{
        position: 'absolute',
        left: 110, right: 110, bottom: 110,
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 13,
          letterSpacing: '0.32em',
          color: '#c4a866',
          textTransform: 'uppercase',
          marginBottom: 24,
          opacity: ebOp,
        }}>
          06 · Beitrag zum Naturschutz
        </div>

        <div style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 78,
          fontWeight: 400,
          color: '#ebe4d4',
          lineHeight: 1.04,
          letterSpacing: '-0.01em',
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          maxWidth: 1180,
        }}>
          Verkaufen heißt nicht <span style={{ fontStyle: 'italic', color: '#c4a866' }}>aufgeben</span> —
          <br/>es heißt, Verantwortung in <span style={{ fontStyle: 'italic', color: '#c4a866' }}>gute Hände</span> zu legen.
        </div>

        <div style={{
          marginTop: 28,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 18,
          color: 'rgba(235, 228, 212, 0.7)',
          opacity: subOp,
          maxWidth: 700,
          lineHeight: 1.5,
        }}>
          Käufer, die Ihre Fläche dauerhaft renaturieren oder nachhaltig bewirtschaften — geprüft, dokumentiert, ESG-konform.
        </div>
      </div>
    </div>
  );
}

function SceneAdvisory() {
  return (
    <Sprite start={35.2} end={38.7}>
      <SceneAdvisoryInner />
    </Sprite>
  );
}

function SceneAdvisoryInner() {
  const { localTime } = useSprite();

  const ebOp = animate({ from: 0, to: 1, start: 0.2, end: 0.8 })(localTime);
  const titleOp = animate({ from: 0, to: 1, start: 0.4, end: 1.2 })(localTime);
  const titleY = animate({ from: 18, to: 0, start: 0.4, end: 1.3, ease: Easing.easeOutCubic })(localTime);

  const subOp = animate({ from: 0, to: 1, start: 1.0, end: 1.7 })(localTime);

  const photoOp = animate({ from: 0, to: 1, start: 0.6, end: 1.5 })(localTime);
  const photoX = animate({ from: 60, to: 0, start: 0.6, end: 1.6, ease: Easing.easeOutCubic })(localTime);

  // Three small process steps
  const steps = [
    { n: '01', label: 'Anfrage' },
    { n: '02', label: 'Bewertung' },
    { n: '03', label: 'Verkauf' },
  ];

  const exit = animate({ from: 1, to: 0, start: 3.0, end: 3.5, ease: Easing.easeInCubic })(localTime);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#0d1410',
      opacity: exit,
      display: 'flex',
    }}>
      {/* Left: photo of advisor */}
      <div style={{
        flex: 0.7,
        position: 'relative',
        opacity: photoOp,
        transform: `translateX(${-photoX}px)`,
      }}>
        <PhotoPlaceholder label="Berater · Försterhaus" tone="portrait" />
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
          background: 'linear-gradient(-90deg, #0d1410 0%, transparent 100%)',
        }}/>
      </div>

      {/* Right: text */}
      <div style={{
        flex: 1.0,
        padding: '120px 110px 100px 60px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 13,
          letterSpacing: '0.32em',
          color: '#c4a866',
          textTransform: 'uppercase',
          marginBottom: 24,
          opacity: ebOp,
        }}>
          07 · Verkauf in 3 Schritten
        </div>

        <div style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 60,
          fontWeight: 400,
          color: '#ebe4d4',
          lineHeight: 1.05,
          letterSpacing: '-0.01em',
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}>
          Sie sprechen mit einem
          <span style={{ fontStyle: 'italic', color: '#c4a866' }}> Förster</span> —
          nicht mit einem Algorithmus.
        </div>

        <div style={{
          marginTop: 36,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 17,
          color: 'rgba(235, 228, 212, 0.7)',
          opacity: subOp,
          lineHeight: 1.55,
          maxWidth: 480,
        }}>
          Drei einfache Schritte. Kostenlos und unverbindlich.
        </div>

        {/* Steps */}
        <div style={{
          marginTop: 36,
          display: 'flex',
          gap: 36,
          opacity: subOp,
        }}>
          {steps.map((s, i) => {
            const stepOp = animate({ from: 0, to: 1, start: 1.4 + i * 0.25, end: 2.0 + i * 0.25 })(localTime);
            return (
              <div key={i} style={{ opacity: stepOp }}>
                <div style={{
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontSize: 11,
                  letterSpacing: '0.2em',
                  color: '#c4a866',
                  marginBottom: 8,
                }}>
                  {s.n}
                </div>
                <div style={{
                  fontFamily: '"Cormorant Garamond", serif',
                  fontSize: 28,
                  color: '#ebe4d4',
                  fontStyle: 'italic',
                }}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SceneCTA() {
  return (
    <Sprite start={38.7} end={42.5}>
      <SceneCTAInner />
    </Sprite>
  );
}

function SceneCTAInner() {
  const { localTime } = useSprite();

  // Top mini-wordmark
  const wmOp = animate({ from: 0, to: 1, start: 0.1, end: 0.6 })(localTime);

  // Headline
  const ruleW = animate({ from: 0, to: 320, start: 0.3, end: 1.0, ease: Easing.easeOutCubic })(localTime);
  const titleOp = animate({ from: 0, to: 1, start: 0.5, end: 1.2 })(localTime);
  const titleY = animate({ from: 22, to: 0, start: 0.5, end: 1.3, ease: Easing.easeOutCubic })(localTime);

  // CTA button
  const btnOp = animate({ from: 0, to: 1, start: 1.2, end: 1.8 })(localTime);
  const btnScale = animate({ from: 0.94, to: 1.0, start: 1.2, end: 1.8, ease: Easing.easeOutBack })(localTime);

  // Pulsing accent
  const pulse = 1 + 0.04 * Math.sin(localTime * 4);

  // Footer line
  const footOp = animate({ from: 0, to: 1, start: 1.8, end: 2.4 })(localTime);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#0d1410',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 80,
    }}>
      {/* Mini wordmark top */}
      <div style={{
        position: 'absolute',
        top: 60, left: 0, right: 0,
        textAlign: 'center',
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: 22,
        letterSpacing: '0.04em',
        color: 'rgba(235, 228, 212, 0.8)',
        opacity: wmOp,
      }}>
        Lippe <span style={{ fontStyle: 'italic', color: '#c4a866' }}>Forst</span>
      </div>

      {/* Hairline */}
      <div style={{
        width: ruleW, height: 1,
        background: 'rgba(196, 168, 102, 0.55)',
        marginBottom: 36,
      }}/>

      {/* Eyebrow */}
      <div style={{
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 13,
        letterSpacing: '0.32em',
        color: '#c4a866',
        textTransform: 'uppercase',
        marginBottom: 24,
        opacity: titleOp,
      }}>
        Ihr nächster Schritt
      </div>

      {/* Headline */}
      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: 96,
        fontWeight: 400,
        color: '#ebe4d4',
        lineHeight: 1.0,
        letterSpacing: '-0.015em',
        textAlign: 'center',
        opacity: titleOp,
        transform: `translateY(${titleY}px)`,
        maxWidth: 1300,
      }}>
        Lassen Sie Ihre Fläche
        <br/>
        <span style={{ fontStyle: 'italic', color: '#c4a866' }}>kostenlos bewerten.</span>
      </div>

      {/* Hairline below */}
      <div style={{
        width: ruleW, height: 1,
        background: 'rgba(196, 168, 102, 0.55)',
        marginTop: 36,
        marginBottom: 48,
      }}/>

      {/* CTA Button */}
      <div style={{
        opacity: btnOp,
        transform: `scale(${btnScale * pulse})`,
        transformOrigin: 'center',
      }}>
        <div style={{
          padding: '20px 44px',
          background: '#c4a866',
          color: '#0d1410',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 16,
        }}>
          <span>Jetzt bewerten</span>
          <span style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: 22, fontStyle: 'italic',
          }}>→</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: 50, left: 0, right: 0,
        textAlign: 'center',
        opacity: footOp,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 12,
        letterSpacing: '0.24em',
        color: 'rgba(235, 228, 212, 0.45)',
        textTransform: 'uppercase',
      }}>
        lippe-forst.de  ·  Antwort innerhalb von 48 Stunden
      </div>
    </div>
  );
}

window.SceneNature = SceneNature;
window.SceneAdvisory = SceneAdvisory;
window.SceneCTA = SceneCTA;
