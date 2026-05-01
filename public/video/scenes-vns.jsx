// Scene VNS (between EcoPoints and FairMarket): Vertragsnaturschutz,
// extensive Bewirtschaftung & Entwicklung — Beratungsangebot.

function SceneVNS() {
  return (
    <Sprite start={20.5} end={25.5}>
      <SceneVNSInner />
    </Sprite>
  );
}

function SceneVNSInner() {
  const { localTime } = useSprite();

  const ebOp = animate({ from: 0, to: 1, start: 0.2, end: 0.8 })(localTime);
  const titleOp = animate({ from: 0, to: 1, start: 0.4, end: 1.2 })(localTime);
  const titleY = animate({ from: 18, to: 0, start: 0.4, end: 1.3, ease: Easing.easeOutCubic })(localTime);

  // Side line/seal column - photo strip on the left
  const photoOp = animate({ from: 0, to: 1, start: 0.3, end: 1.4 })(localTime);
  const photoX = animate({ from: -50, to: 0, start: 0.3, end: 1.4, ease: Easing.easeOutCubic })(localTime);

  // List items (4)
  const items = [
    { tag: 'VNS', label: 'Vertragsnaturschutz', body: 'Vergütete Bewirtschaftungs­auflagen über mehrjährige Verträge.', delay: 1.4 },
    { tag: 'EXT', label: 'Extensive Bewirtschaftung', body: 'Reduzierte Düngung, späte Mahd — höhere Förderung, mehr Artenvielfalt.', delay: 1.8 },
    { tag: 'ENT', label: 'Entwicklung & Aufwertung', body: 'Renaturierung, Hecken, Blühstreifen — wir planen den Pfad.', delay: 2.2 },
    { tag: 'BER', label: 'Persönliche Beratung', body: 'Förster prüfen Ihre Fläche — kostenlos und unverbindlich.', delay: 2.6 },
  ];

  const exit = animate({ from: 1, to: 0, start: 4.5, end: 5.0, ease: Easing.easeInCubic })(localTime);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#0d1410',
      opacity: exit,
      display: 'flex',
    }}>
      {/* Left: photo strip with overlaid seal */}
      <div style={{
        flex: 0.55,
        position: 'relative',
        opacity: photoOp,
        transform: `translateX(${photoX}px)`,
      }}>
        <PhotoPlaceholder label="Blühwiese · VNS-Programm" tone="meadow" />
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 60,
          background: 'linear-gradient(-90deg, #0d1410 0%, transparent 100%)',
        }}/>
        {/* Seal */}
        <div style={{
          position: 'absolute',
          left: 60, bottom: 80,
          border: '1px solid rgba(196, 168, 102, 0.55)',
          padding: '20px 24px',
          background: 'rgba(13,20,16,0.78)',
          maxWidth: 320,
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 10,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#c4a866',
            marginBottom: 10,
          }}>
            ▢ Förderfähig
          </div>
          <div style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: 28,
            fontStyle: 'italic',
            color: '#ebe4d4',
            lineHeight: 1.15,
          }}>
            Bis zu <span style={{ color: '#c4a866' }}>950 €/ha</span> jährlich.
          </div>
        </div>
      </div>

      {/* Right content */}
      <div style={{
        flex: 1,
        padding: '90px 110px 90px 60px',
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
          04 · Beratung & Förderung
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
          marginBottom: 44,
        }}>
          Auch wer <span style={{ fontStyle: 'italic', color: '#c4a866' }}>nicht verkaufen</span> möchte —
          <br/>profitiert.
        </div>

        {/* Items list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {items.map((it, i) => {
            const op = animate({ from: 0, to: 1, start: it.delay, end: it.delay + 0.5 })(localTime);
            const ix = animate({ from: 18, to: 0, start: it.delay, end: it.delay + 0.55, ease: Easing.easeOutCubic })(localTime);
            return (
              <div key={i} style={{
                opacity: op,
                transform: `translateX(${ix}px)`,
                display: 'grid',
                gridTemplateColumns: '90px 1fr',
                gap: 28,
                alignItems: 'baseline',
                paddingTop: 14,
                borderTop: '1px solid rgba(196, 168, 102, 0.18)',
              }}>
                <div style={{
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  color: '#c4a866',
                }}>
                  {it.tag}
                </div>
                <div>
                  <div style={{
                    fontFamily: '"Cormorant Garamond", serif',
                    fontSize: 28,
                    color: '#ebe4d4',
                    lineHeight: 1.2,
                    marginBottom: 4,
                  }}>
                    {it.label}
                  </div>
                  <div style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: 15,
                    color: 'rgba(235, 228, 212, 0.65)',
                    lineHeight: 1.45,
                  }}>
                    {it.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.SceneVNS = SceneVNS;
