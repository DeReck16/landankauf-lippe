// Scene 1 (0-4s): Brand intro
// Scene 2 (4-9s): Problem - dormant land

function SceneIntro() {
  // 0 - 4s
  return (
    <Sprite start={0} end={4.2}>
      <SceneIntroInner />
    </Sprite>
  );
}

function SceneIntroInner() {
  const { localTime, duration } = useSprite();

  // Hairline rule grows from center
  const ruleW = animate({ from: 0, to: 720, start: 0.2, end: 1.4, ease: Easing.easeOutCubic })(localTime);
  const ruleOpacity = animate({ from: 0, to: 1, start: 0.1, end: 0.6 })(localTime);

  // Wordmark slides up + fades
  const wmOpacity = animate({ from: 0, to: 1, start: 0.6, end: 1.4 })(localTime);
  const wmY = animate({ from: 24, to: 0, start: 0.6, end: 1.6, ease: Easing.easeOutCubic })(localTime);

  // Tagline
  const tagOpacity = animate({ from: 0, to: 1, start: 1.2, end: 2.0 })(localTime);
  const tagY = animate({ from: 12, to: 0, start: 1.2, end: 2.0, ease: Easing.easeOutCubic })(localTime);

  // Exit
  const exit = animate({ from: 1, to: 0, start: 3.6, end: 4.2, ease: Easing.easeInCubic })(localTime);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: exit,
    }}>
      {/* Tiny eyebrow */}
      <div style={{
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 13,
        letterSpacing: '0.32em',
        color: 'rgba(235, 228, 212, 0.5)',
        textTransform: 'uppercase',
        marginBottom: 32,
        opacity: wmOpacity,
      }}>
        Marktplatz für Wald & Wiese · Est. 2024
      </div>

      {/* Hairline above */}
      <div style={{
        width: ruleW, height: 1,
        background: 'rgba(196, 168, 102, 0.55)',
        opacity: ruleOpacity,
        marginBottom: 36,
      }}/>

      {/* Wordmark */}
      <div style={{
        fontFamily: '"Cormorant Garamond", "Times New Roman", serif',
        fontSize: 124,
        fontWeight: 400,
        letterSpacing: '-0.01em',
        color: '#ebe4d4',
        lineHeight: 1.15,
        opacity: wmOpacity,
        transform: `translateY(${wmY}px)`,
        textAlign: 'center',
        padding: '0 0 12px 0',
      }}>
        Lippe <span style={{ fontStyle: 'italic', color: '#c4a866' }}>Forst</span>
      </div>

      {/* Hairline below */}
      <div style={{
        width: ruleW, height: 1,
        background: 'rgba(196, 168, 102, 0.55)',
        opacity: ruleOpacity,
        marginTop: 36,
      }}/>

      {/* Tagline */}
      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: 26,
        fontStyle: 'italic',
        color: 'rgba(235, 228, 212, 0.78)',
        letterSpacing: '0.02em',
        marginTop: 32,
        opacity: tagOpacity,
        transform: `translateY(${tagY}px)`,
      }}>
        Den wahren Wert Ihrer Fläche entdecken.
      </div>
    </div>
  );
}

function SceneProblem() {
  // 4 - 9s
  return (
    <Sprite start={4} end={9.5}>
      <SceneProblemInner />
    </Sprite>
  );
}

function SceneProblemInner() {
  const { localTime } = useSprite();

  // Image entry
  const imgOpacity = animate({ from: 0, to: 1, start: 0.2, end: 1.4, ease: Easing.easeOutCubic })(localTime);
  const imgScale = animate({ from: 1.06, to: 1.0, start: 0.2, end: 1.6, ease: Easing.easeOutCubic })(localTime);

  // Slow Ken Burns drift
  const kbScale = 1 + 0.04 * (localTime / 5.5);

  // Vignette/text overlay
  const overlayOpacity = animate({ from: 0, to: 1, start: 0.8, end: 1.6 })(localTime);

  // Eyebrow
  const ebOpacity = animate({ from: 0, to: 1, start: 1.0, end: 1.6 })(localTime);
  const ebX = animate({ from: -12, to: 0, start: 1.0, end: 1.6, ease: Easing.easeOutCubic })(localTime);

  // Headline (split lines)
  const h1Opacity = animate({ from: 0, to: 1, start: 1.4, end: 2.1 })(localTime);
  const h1Y = animate({ from: 18, to: 0, start: 1.4, end: 2.1, ease: Easing.easeOutCubic })(localTime);

  const h2Opacity = animate({ from: 0, to: 1, start: 1.7, end: 2.4 })(localTime);
  const h2Y = animate({ from: 18, to: 0, start: 1.7, end: 2.4, ease: Easing.easeOutCubic })(localTime);

  // Stat reveal
  const statOpacity = animate({ from: 0, to: 1, start: 2.6, end: 3.3 })(localTime);
  const statY = animate({ from: 14, to: 0, start: 2.6, end: 3.3, ease: Easing.easeOutCubic })(localTime);

  // Counter
  const counterT = clamp((localTime - 2.6) / 1.4, 0, 1);
  const counterVal = Math.round(42 * Easing.easeOutCubic(counterT));

  // Exit
  const exit = animate({ from: 1, to: 0, start: 5.0, end: 5.5, ease: Easing.easeInCubic })(localTime);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      opacity: exit,
    }}>
      {/* Photo placeholder fills full canvas */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: imgOpacity,
        transform: `scale(${imgScale * kbScale})`,
        transformOrigin: 'center',
      }}>
        <PhotoPlaceholder label="Brachliegende Wiese · Sommer" tone="meadow" />
      </div>

      {/* Dark gradient overlay for legibility */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(105deg, rgba(13,20,16,0.92) 0%, rgba(13,20,16,0.65) 45%, rgba(13,20,16,0.2) 100%)',
        opacity: overlayOpacity,
      }}/>

      {/* Content column */}
      <div style={{
        position: 'absolute',
        left: 110, top: 0, bottom: 0,
        width: 820,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {/* Eyebrow */}
        <div style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 13,
          letterSpacing: '0.32em',
          color: '#c4a866',
          textTransform: 'uppercase',
          marginBottom: 28,
          opacity: ebOpacity,
          transform: `translateX(${ebX}px)`,
        }}>
          01 · Das Problem
        </div>

        {/* Headline */}
        <div style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 86,
          fontWeight: 400,
          color: '#ebe4d4',
          lineHeight: 1.02,
          letterSpacing: '-0.01em',
          marginBottom: 8,
        }}>
          <div style={{
            opacity: h1Opacity,
            transform: `translateY(${h1Y}px)`,
          }}>
            Ihre Fläche liegt brach
          </div>
          <div style={{
            opacity: h2Opacity,
            transform: `translateY(${h2Y}px)`,
            fontStyle: 'italic',
            color: '#c4a866',
          }}>
            — und niemand merkt's.
          </div>
        </div>

        {/* Stat block */}
        <div style={{
          marginTop: 56,
          opacity: statOpacity,
          transform: `translateY(${statY}px)`,
          display: 'flex',
          alignItems: 'baseline',
          gap: 24,
          paddingTop: 24,
          borderTop: '1px solid rgba(196, 168, 102, 0.35)',
          maxWidth: 640,
        }}>
          <div style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: 96,
            fontWeight: 400,
            color: '#c4a866',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {counterVal}<span style={{ fontSize: 56 }}>%</span>
          </div>
          <div style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 17,
            color: 'rgba(235, 228, 212, 0.75)',
            lineHeight: 1.45,
            maxWidth: 360,
          }}>
            der privaten Wald- und Wiesenflächen<br/>in Deutschland werden nicht aktiv bewirtschaftet.
          </div>
        </div>
      </div>
    </div>
  );
}

window.SceneIntro = SceneIntro;
window.SceneProblem = SceneProblem;
