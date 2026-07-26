import logoPsu from '../assets/logo-psu.png';

/* The official PSU seal. The source PNG is an opaque white square with the seal
   nearly filling it, so it's always drawn on a white chip clipped to a circle —
   that hides the square corners on the navy surfaces (sidebar, navbar, auth panel)
   and still reads correctly on light backgrounds. */
export default function Logo({ size = 40, shadow = '0 2px 6px rgba(0,0,0,0.18)', style, className }) {
  return (
    <div
      className={className}
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: '50%', background: '#fff',
        padding: Math.max(1, Math.round(size * 0.05)),
        boxShadow: shadow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      <img
        src={logoPsu}
        alt="Pangasinan State University"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}
