export default function Landing() {
  return (
    <div className="min-h-screen bg-underground flex flex-col items-center justify-center text-white p-10">
      <h1 className="text-7xl font-bold mb-3 tracking-tight">RiverIQ</h1>
      <p className="text-lg mb-12 opacity-70 tracking-wide uppercase">
        Texas Hold&apos;em AI Coaching
      </p>
      <a
        href="/game"
        className="px-10 py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-xl rounded-xl shadow-2xl transition"
      >
        Sit at the Table →
      </a>
    </div>
  )
}
