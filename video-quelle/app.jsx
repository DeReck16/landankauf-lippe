// app.jsx — Szenenfolge des Erklärfilms (früher inline in index.html)
  function App() {
    return (
      <Stage
        width={1920}
        height={1080}
        duration={42.5}
        background="#0d1410"
      >
        {/* Persistent vignette + grain on every scene */}
        <GlobalVignette />

        <SceneIntro />
        <SceneProblem />
        <SceneHiddenValue />
        <SceneEcoPoints />
        <SceneVNS />
        <SceneFairMarket />
        <SceneNature />
        <SceneAdvisory />
        <SceneCTA />

        {/* Persistent timecode bug */}
        <TimecodeBug />
      </Stage>
    );
  }

  function GlobalVignette() {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)',
      }}/>
    );
  }

  function TimecodeBug() {
    const time = useTime();
    const tc = (() => {
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      const f = Math.floor((time * 24) % 24);
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;
    })();
    return (
      <div style={{
        position: 'absolute',
        top: 32, right: 32,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 11,
        letterSpacing: '0.18em',
        color: 'rgba(196, 168, 102, 0.55)',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        zIndex: 101,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#c4a866',
          boxShadow: '0 0 8px #c4a866',
        }}/>
        REC · {tc}
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
