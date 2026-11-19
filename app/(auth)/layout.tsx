export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="on-dark relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{
        background: 'linear-gradient(135deg, #050505 0%, #0a1628 35%, #0d2847 60%, #0066cc 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #0066cc, transparent)' }}
      />
      <div
        className="pointer-events-none absolute -right-20 -bottom-40 h-112 w-md rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
      <div className="absolute right-0 bottom-4 left-0 text-center text-[14px] text-white/30">
        UGT Reliability Lube Monitoring © 2026
      </div>
    </div>
  );
}
