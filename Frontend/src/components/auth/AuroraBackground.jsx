// Quiet, single-tone background — soft top gradient, no animated orbs.
const AuroraBackground = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 bg-ink-950">
    <div
      className="absolute inset-x-0 top-0 h-[420px] opacity-60"
      style={{
        background:
          'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(124, 58, 237, 0.18) 0%, transparent 70%)',
      }}
    />
  </div>
)

export default AuroraBackground
