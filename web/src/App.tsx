import React from 'react';
import { useSimStore } from './store/useSimStore';

export default function App() {
  const isRunning = useSimStore(state => state.isRunning);
  return (
    <div className="min-h-screen bg-[#0c0d0e] text-slate-100 flex flex-col font-sans select-none">
      <header className="h-14 border-b border-white/5 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-wide">Chaos Raft Sandbox</h1>
        </div>
      </header>
      <main className="flex-1 relative overflow-hidden bg-dot-pattern" />
    </div>
  );
}
