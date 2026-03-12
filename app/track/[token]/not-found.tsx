export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-semibold">Tracking Link Not Found</h1>
        <p className="mt-2 text-sm text-white/70">
          This tracking link is invalid or expired. Please contact support.
        </p>
      </div>
    </main>
  );
}

