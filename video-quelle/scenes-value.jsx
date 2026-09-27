// Scene 3 (9-14s): Hidden value reveal
// Scene 4 (14-20s): Eco-points uplift
// Scene 5 (20-25s): Fair market comparison

function SceneHiddenValue() {
  return (
    <Sprite start={9} end={14.5}>
      <SceneHiddenValueInner />
    </Sprite>
  );
}

function SceneHiddenValueInner() {
  const { localTime } = useSprite();

  // Eyebrow
  const ebOpacity = animate({ from: 0, to: 1, start: 0.3, end: 0.9 })(localTime);

  // Big rotating headline (typewriter feel via line reveal)
  const h1Opacity = animate({ from: 0, to: 1, start: 0.5, end: 1.2 })(localTime);
  const h1Y = animate({ from: 22, to: 0, start: 0.5, end: 1.3, ease: Easing.easeOutCubic })(localTime);

  const h2Opacity = animate({ from: 0, to: 1, start: 0.9, end: 1.6 })(localTime);
  const h2Y = animate({ from: 22, to: 0, start: 0.9, end: 1.7, ease: Easing.easeOutCubic })(localTime);

  // Highlight underline grows
  const underlineW = animate({ from: 0, to: 480, start: 1.6, end: 2.4, ease: Easing.easeOutCubic })(localTime);

  // Side photo strip slides in
  const photoX = animate({ from: 100, to: 0, start: 0.3, end: 1.6, ease: Easing.easeOutCubic })(localTime);
  const photoOpacity = animate({ from: 0, to: 1, start: 0.3, end: 1.4 })(localTime);

  // Numbers appear
  const numOpacity = animate({ from: 0, to: 1, start: 2.2, end: 3.0 })(localTime);
  const numY = animate({ from: 16, to: 0, start: 2.2, end: 3.0, ease: Easing.easeOutCubic })(localTime);

  // Animated counter old vs new
  const oldT = clamp((localTime - 2.2) / 1.4, 0, 1);
  const oldVal = Math.round(21600 * Easing.easeOutCubic(oldT));

  const newT = clamp((localTime - 3.0) / 1.6, 0, 1);
  const newVal = Math.round(41600 * Easing.easeOutCubic(newT));

  const arrowOpacity = animate({ from: 0, to: 1, start: 3.4, end: 3.9 })(localTime);

  const exit = animate({ from: 1, to: 0, start: 5.0, end: 5.5, ease: Easing.easeInCubic })(localTime);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#0d1410',
      opacity: exit,
      display: 'flex',
    }}>
      {/* Left content column */}
      <div style={{
        flex: 1.15,
        padding: '120px 80px 100px 110px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 13,
          letterSpacing: '0.32em',
          color: '#c4a866',
          textTransform: 'uppercase',
          marginBottom: 28,
          opacity: ebOpacity,
        }}>
          02 · Versteckter Wert
        </div>

        <div style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 68,
          fontWeight: 400,
          color: '#ebe4d4',
          lineHeight: 1.08,
          letterSpacing: '-0.01em',
        }}>
          <div style={{ opacity: h1Opacity, transform: `translateY(${h1Y}px)` }}>
            Was wie Wiese aussieht,
          </div>
          <div style={{
            opacity: h2Opacity,
            transform: `translateY(${h2Y}px)`,
            fontStyle: 'italic',
            color: '#c4a866',
            position: 'relative',
            paddingBottom: 12,
          }}>
            ist oft Kapital.
            <div style={{
              position: 'absolute',
              left: 0, bottom: 0,
              width: underlineW, height: 2,
              background: '#c4a866',
            }}/>
          </div>
        </div>

        {/* Comparison numbers */}
        <div style={{
          marginTop: 80,
          display: 'flex', alignItems: 'center', gap: 48,
          opacity: numOpacity,
          transform: `translateY(${numY}px)`,
        }}>
          <ValueBlock
            label="Marktpreis ohne Aufwertung"
            value={`${oldVal.toLocaleString('de-DE')} €`}
            tone="muted"
          />

          <div style={{
            opacity: arrowOpacity,
            color: '#c4a866',
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: 48,
            fontStyle: 'italic',
          }}>→</div>

          <ValueBlock
            label="Mit Kompensationspotenzial"
            value={`${newVal.toLocaleString('de-DE')} €`}
            tone="gold"
          />
        </div>

        <div style={{
          marginTop: 28,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 12,
          letterSpacing: '0.18em',
          color: 'rgba(235, 228, 212, 0.4)',
          textTransform: 'uppercase',
          opacity: animate({ from: 0, to: 1, start: 4.0, end: 4.6 })(localTime),
        }}>
          ~ Beispiel: 1 ha Grünland, Kreismittel 2025 + Ökopunkte, vorsichtig gerechnet ~
        </div>
      </div>

      {/* Right photo strip */}
      <div style={{
        flex: 0.85,
        position: 'relative',
        opacity: photoOpacity,
        transform: `translateX(${photoX}px)`,
      }}>
        <PhotoPlaceholder label="Detailaufnahme · Wiesengras" tone="grass" />
        {/* Subtle gradient edge fade */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 80,
          background: 'linear-gradient(90deg, #0d1410 0%, transparent 100%)',
        }}/>
      </div>
    </div>
  );
}

function ValueBlock({ label, value, tone }) {
  const isGold = tone === 'gold';
  return (
    <div>
      <div style={{
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 11,
        letterSpacing: '0.2em',
        color: 'rgba(235, 228, 212, 0.5)',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: 56,
        fontWeight: 400,
        color: isGold ? '#c4a866' : 'rgba(235, 228, 212, 0.55)',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        textDecoration: isGold ? 'none' : 'line-through',
        textDecorationColor: 'rgba(235, 228, 212, 0.3)',
      }}>
        {value}
      </div>
    </div>
  );
}

function SceneEcoPoints() {
  return (
    <Sprite start={14} end={20.5}>
      <SceneEcoPointsInner />
    </Sprite>
  );
}

function SceneEcoPointsInner() {
  const { localTime } = useSprite();

  const ebOpacity = animate({ from: 0, to: 1, start: 0.2, end: 0.8 })(localTime);
  const titleOpacity = animate({ from: 0, to: 1, start: 0.4, end: 1.2 })(localTime);
  const titleY = animate({ from: 18, to: 0, start: 0.4, end: 1.3, ease: Easing.easeOutCubic })(localTime);

  // Three cards reveal staggered
  const cards = [
    {
      eyebrow: 'I',
      title: 'Ökopunkte',
      body: 'Naturschutzmaßnahmen erzeugen handelbare Punkte. Bauträger müssen ausgleichen — Sie liefern.',
      delay: 1.2,
    },
    {
      eyebrow: 'II',
      title: 'Renaturierung',
      body: 'Aus konventioneller Wiese wird Biotop. Der Hektarwert steigt — oft um das Dreifache.',
      delay: 1.8,
    },
    {
      eyebrow: 'III',
      title: 'Forstprämien',
      body: 'Aufforstung & nachhaltige Bewirtschaftung werden langfristig vergütet.',
      delay: 2.4,
    },
  ];

  const exit = animate({ from: 1, to: 0, start: 6.0, end: 6.5, ease: Easing.easeInCubic })(localTime);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#0d1410',
      padding: '90px 110px',
      opacity: exit,
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 13,
        letterSpacing: '0.32em',
        color: '#c4a866',
        textTransform: 'uppercase',
        marginBottom: 24,
        opacity: ebOpacity,
      }}>
        03 · Wertaufbau
      </div>

      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: 68,
        fontWeight: 400,
        color: '#ebe4d4',
        lineHeight: 1.05,
        letterSpacing: '-0.01em',
        marginBottom: 60,
        opacity: titleOpacity,
        transform: `translateY(${titleY}px)`,
        maxWidth: 1100,
      }}>
        Drei Wege, <span style={{ fontStyle: 'italic', color: '#c4a866' }}>den Wert zu heben.</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 28,
      }}>
        {cards.map((c, i) => {
          const cardOp = animate({ from: 0, to: 1, start: c.delay, end: c.delay + 0.6 })(localTime);
          const cardY = animate({ from: 24, to: 0, start: c.delay, end: c.delay + 0.7, ease: Easing.easeOutCubic })(localTime);
          return (
            <div key={i} style={{
              border: '1px solid rgba(196, 168, 102, 0.28)',
              padding: '36px 32px 40px',
              background: 'rgba(196, 168, 102, 0.04)',
              opacity: cardOp,
              transform: `translateY(${cardY}px)`,
              minHeight: 320,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 42,
                fontStyle: 'italic',
                color: '#c4a866',
                marginBottom: 20,
                lineHeight: 1,
              }}>
                {c.eyebrow}
              </div>
              <div style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 36,
                color: '#ebe4d4',
                marginBottom: 18,
                lineHeight: 1.1,
              }}>
                {c.title}
              </div>
              <div style={{
                width: 36, height: 1,
                background: 'rgba(196, 168, 102, 0.5)',
                marginBottom: 18,
              }}/>
              <div style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 16,
                lineHeight: 1.55,
                color: 'rgba(235, 228, 212, 0.72)',
              }}>
                {c.body}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SceneFairMarket() {
  return (
    <Sprite start={25.5} end={30.7}>
      <SceneFairMarketInner />
    </Sprite>
  );
}

function SceneFairMarketInner() {
  const { localTime } = useSprite();

  const ebOpacity = animate({ from: 0, to: 1, start: 0.2, end: 0.8 })(localTime);
  const titleOpacity = animate({ from: 0, to: 1, start: 0.4, end: 1.2 })(localTime);
  const titleY = animate({ from: 18, to: 0, start: 0.4, end: 1.3, ease: Easing.easeOutCubic })(localTime);

  // Zwei Wege statt eines Balkenvergleichs (keine unbelegten Prozentzahlen).
  const wege = [
    { tag: 'A', titel: 'Wir kaufen selbst', text: 'Die TR Vertriebs GmbH kauft Ihre Fläche — ohne Makler, ohne Provision.', delay: 1.2 },
    { tag: 'B', titel: 'Wir vermitteln', text: 'Passende Käufer oder Pächter aus der Region — für Sie als Eigentümer kostenlos.', delay: 1.6 },
  ];

  const captionOp = animate({ from: 0, to: 1, start: 3.2, end: 3.8 })(localTime);
  const captionY = animate({ from: 14, to: 0, start: 3.2, end: 3.9, ease: Easing.easeOutCubic })(localTime);

  const exit = animate({ from: 1, to: 0, start: 5.0, end: 5.5, ease: Easing.easeInCubic })(localTime);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#0d1410',
      padding: '90px 110px',
      opacity: exit,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 13,
        letterSpacing: '0.32em',
        color: '#c4a866',
        textTransform: 'uppercase',
        marginBottom: 24,
        opacity: ebOpacity,
      }}>
        05 · Zwei Wege
      </div>

      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: 64,
        fontWeight: 400,
        color: '#ebe4d4',
        lineHeight: 1.05,
        letterSpacing: '-0.01em',
        marginBottom: 56,
        opacity: titleOpacity,
        transform: `translateY(${titleY}px)`,
        maxWidth: 1100,
      }}>
        Selbst kaufen oder vermitteln. <span style={{ fontStyle: 'italic', color: '#c4a866' }}>Sie entscheiden.</span>
      </div>

      <div style={{ display: 'flex', gap: 48, flex: 1, alignItems: 'flex-start' }}>
        {wege.map((w) => {
          const op = animate({ from: 0, to: 1, start: w.delay, end: w.delay + 0.7 })(localTime);
          const y = animate({ from: 20, to: 0, start: w.delay, end: w.delay + 0.8, ease: Easing.easeOutCubic })(localTime);
          return (
            <div key={w.tag} style={{
              flex: 1,
              opacity: op,
              transform: `translateY(${y}px)`,
              border: '1px solid rgba(196, 168, 102, 0.45)',
              borderRadius: 18,
              padding: '36px 40px',
              background: 'rgba(235, 228, 212, 0.04)',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                fontSize: 13,
                letterSpacing: '0.24em',
                color: '#c4a866',
                marginBottom: 14,
              }}>
                WEG {w.tag}
              </div>
              <div style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 44,
                color: '#ebe4d4',
                lineHeight: 1.1,
                marginBottom: 14,
              }}>
                {w.titel}
              </div>
              <div style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 19,
                color: 'rgba(235, 228, 212, 0.72)',
                lineHeight: 1.5,
              }}>
                {w.text}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 32,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 17,
        color: 'rgba(235, 228, 212, 0.6)',
        opacity: captionOp,
        transform: `translateY(${captionY}px)`,
        maxWidth: 820,
        lineHeight: 1.5,
      }}>
        Anonym in der Flächenbörse nur mit Ihrer Zustimmung — Kontaktdaten erst, wenn beide Seiten zugestimmt haben.
      </div>
    </div>
  );
}

window.SceneHiddenValue = SceneHiddenValue;
window.SceneEcoPoints = SceneEcoPoints;
window.SceneFairMarket = SceneFairMarket;
