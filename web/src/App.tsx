import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0c0d0e] text-slate-100 flex flex-col">
      <header className="h-14 border-b border-white/5 flex items-center px-4">
        <h1 className="text-sm font-semibold">Chaos Raft Sandbox</h1>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <p className="text-xs text-slate-500">Initializing cluster simulation engine...</p>
      </main>
    </div>
  );
}
