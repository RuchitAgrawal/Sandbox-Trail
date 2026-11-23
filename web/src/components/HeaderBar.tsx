import React from 'react';
import { Play, Pause, RotateCcw, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react';
import { useSimStore, SimSpeed } from '../store/useSimStore';
import { initWasm } from '../engine/wasmBridge';

export const HeaderBar: React.FC = () => {
  const {
    paused,
    togglePause,
    speed,
    setSpeed,
    seed,
    setSeed,
    snapshot,
    activeScenario,
    setActiveScenario,
  } = useSimStore();

  const handleSpeedChange = (newSpeed: SimSpeed) => {
    setSpeed(newSpeed);
  };

  const handleResetCluster = () => {
    initWasm(5, seed);
  };

  const electionSafetyOk = snapshot?.invariant_status.election_safety === 'Ok';
  const logMatchingOk = snapshot?.invariant_status.log_matching === 'Ok';
  const currentLeader = snapshot?.invariant_status.current_leader;
  const leaderTerm = snapshot?.invariant_status.leader_term;

  return (
    <header className="h-12 bg-surface-1 border-b border-hairline px-4 flex items-center justify-between z-20 select-none">
      {/* Brand & Core Badge */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm tracking-tight text-ink font-sans">
            CHAOS RAFT
          </span>
        </div>
        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-3 text-ink-subtle border border-hairline">
          Rust/WASM Core
        </span>
        <span className="text-xs font-mono text-ink-tertiary">
          Tick: {snapshot ? `${snapshot.tick}ms` : '0ms'}
        </span>
      </div>

      {/* Center Controls: Play, Speed, Presets */}
      <div className="flex items-center space-x-3">
        {/* Play/Pause */}
        <button
          onClick={togglePause}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-sm text-xs font-medium border transition-colors ${
            paused
              ? 'bg-amber-950/40 text-amber-400 border-amber-900/50 hover:bg-amber-900/30'
              : 'bg-surface-2 text-ink border-hairline hover:bg-surface-3'
          }`}
        >
          {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* Speed Selector Pills */}
        <div className="flex items-center bg-surface-2 rounded-sm p-0.5 border border-hairline">
          {([0.25, 0.5, 1, 2, 4] as SimSpeed[]).map((s) => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded-xs transition-colors ${
                speed === s
                  ? 'bg-primary text-white font-medium'
                  : 'text-ink-subtle hover:text-ink hover:bg-surface-3'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Guided Scenario Presets Dropdown */}
        <select
          value={activeScenario || ''}
          onChange={(e) => setActiveScenario(e.target.value || null)}
          className="bg-surface-2 border border-hairline text-ink text-xs rounded-sm px-2.5 py-1 focus:outline-none focus:border-primary font-sans"
        >
          <option value="">Scenarios: Free Sandbox</option>
          <option value="normal-election">Scenario 1: Leader Election</option>
          <option value="split-brain">Scenario 2: 3v2 Split-Brain Partition</option>
          <option value="leader-crash">Scenario 3: Leader Crash Mid-Write</option>
          <option value="flaky-loss">Scenario 4: Flaky Loss Network</option>
        </select>

        {/* Seed & Reset */}
        <div className="flex items-center space-x-1 bg-surface-2 px-2 py-1 rounded-sm border border-hairline text-xs font-mono">
          <span className="text-ink-subtle text-[11px]">Seed:</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
            className="w-12 bg-transparent text-ink text-xs focus:outline-none font-mono"
          />
          <button
            onClick={handleResetCluster}
            title="Reset cluster with current seed"
            className="text-ink-subtle hover:text-ink"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right: Invariant Safety Badges */}
      <div className="flex items-center space-x-2 font-mono text-xs">
        {/* Election Safety */}
        <div
          className={`flex items-center space-x-1 px-2 py-1 rounded-sm border ${
            electionSafetyOk
              ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50'
              : 'bg-red-950/50 text-red-400 border-red-900'
          }`}
          title="At most one leader can be elected in a given term (§5.2)"
        >
          {electionSafetyOk ? (
            <ShieldCheck className="w-3.5 h-3.5" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
          )}
          <span className="text-[11px]">
            {electionSafetyOk ? 'Election Safety' : 'Safety Violated!'}
          </span>
        </div>

        {/* Log Matching */}
        <div
          className={`flex items-center space-x-1 px-2 py-1 rounded-sm border ${
            logMatchingOk
              ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50'
              : 'bg-red-950/50 text-red-400 border-red-900'
          }`}
          title="Logs never diverge across committed entries (§5.3)"
        >
          {logMatchingOk ? (
            <ShieldCheck className="w-3.5 h-3.5" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
          )}
          <span className="text-[11px]">
            {logMatchingOk ? 'Log Matching' : 'Log Diverged!'}
          </span>
        </div>

        {/* Current Leader */}
        <div className="px-2 py-1 bg-surface-2 border border-hairline rounded-sm text-[11px] text-ink-muted">
          {currentLeader !== null && currentLeader !== undefined ? (
            <span className="text-emerald-400 font-medium">
              Leader: N{currentLeader} (T{leaderTerm})
            </span>
          ) : (
            <span className="text-amber-400">No Leader (Electing)</span>
          )}
        </div>
      </div>
    </header>
  );
};
