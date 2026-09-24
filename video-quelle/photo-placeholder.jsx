// Cinematic photo placeholder — striped + label, tone-tinted to suggest the
// kind of footage that should go there. Never tries to fake a real photo.

function PhotoPlaceholder({ label = 'Photo', tone = 'meadow' }) {
  // Tonal palettes for different "moods"
  const tones = {
    meadow: {
      bg1: '#3a4a30', bg2: '#2d3a25',
      stripe: 'rgba(196, 168, 102, 0.06)',
      tag: '#c4a866',
    },
    forest: {
      bg1: '#1f2a22', bg2: '#152019',
      stripe: 'rgba(196, 168, 102, 0.05)',
      tag: '#c4a866',
    },
    grass: {
      bg1: '#4a5538', bg2: '#3a4530',
      stripe: 'rgba(235, 228, 212, 0.05)',
      tag: '#ebe4d4',
    },
    portrait: {
      bg1: '#2a2620', bg2: '#1d1a15',
      stripe: 'rgba(196, 168, 102, 0.05)',
      tag: '#c4a866',
    },
  };

  const t = tones[tone] || tones.meadow;

  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative',
      background: `linear-gradient(135deg, ${t.bg1} 0%, ${t.bg2} 100%)`,
      overflow: 'hidden',
    }}>
      {/* Diagonal stripes */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `repeating-linear-gradient(135deg, transparent 0 22px, ${t.stripe} 22px 23px)`,
      }}/>

      {/* Subtle vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.35) 100%)',
      }}/>

      {/* Corner crop marks */}
      <CropMark pos="tl" />
      <CropMark pos="tr" />
      <CropMark pos="bl" />
      <CropMark pos="br" />

      {/* Label tag */}
      <div style={{
        position: 'absolute',
        top: 28, left: 28,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 10,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: t.tag,
        background: 'rgba(13,20,16,0.6)',
        padding: '6px 10px',
        border: `1px solid ${t.tag}66`,
      }}>
        ▢ Foto · {label}
      </div>
    </div>
  );
}

function CropMark({ pos }) {
  const size = 20;
  const stroke = 'rgba(235, 228, 212, 0.4)';
  const sw = 1;
  const offset = 28;

  const styles = {
    tl: { top: offset, left: offset },
    tr: { top: offset, right: offset, transform: 'rotate(90deg)' },
    bl: { bottom: offset, left: offset, transform: 'rotate(-90deg)' },
    br: { bottom: offset, right: offset, transform: 'rotate(180deg)' },
  };

  return (
    <div style={{
      position: 'absolute',
      width: size, height: size,
      ...styles[pos],
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: size, height: sw, background: stroke }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, width: sw, height: size, background: stroke }}/>
    </div>
  );
}

window.PhotoPlaceholder = PhotoPlaceholder;
