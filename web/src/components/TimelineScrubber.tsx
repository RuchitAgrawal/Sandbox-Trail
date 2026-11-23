import React from 'react';
import { History, Download, Rewind } from 'lucide-react';
import { useSimStore } from '../store/useSimStore';
import { exportReplay, getSnapshotAt } from '../engine/wasmBridge';

export const TimelineScrubber: React.FC = () => {
  const {
    scrubbing,
    setScrubbing,
    scrubIndex,
    setScrubIndex,
    ringBufferLen,
    setSnapshot,
  } = useSimStore();

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    setScrubIndex(idx);
    setScrubbing(true);

    const historicalSnap = getSnapshotAt(idx);
    if (historicalSnap) {
      setSnapshot(historicalSnap);
    }
  };

  const handleResumeLive = () => {
    setScrubbing(false);
  };

  const handleExportReplay = () => {
    const jsonStr = exportReplay();
    if (!jsonStr) return;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chaos-raft-replay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <footer className="h-10 bg-surface-1 border-t border-hairline px-4 flex items-center justify-between z-20 select-none text-xs">
      <div className="flex items-center space-x-2">
        <History className="w-4 h-4 text-ink-subtle" />
        <span className="text-ink-muted font-sans font-medium">Time-Travel Scrubber:</span>
        {scrubbing && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/50 text-amber-400 border border-amber-900/40">
            Historical Replay Mode
          </span>
        )}
      </div>

      {/* Scrubber slider */}
      <div className="flex-1 max-w-2xl mx-6 flex items-center space-x-3">
        <input
          type="range"
          min={0}
          max={Math.max(0, ringBufferLen - 1)}
          value={scrubbing ? scrubIndex : Math.max(0, ringBufferLen - 1)}
          onChange={handleSliderChange}
          disabled={ringBufferLen <= 1}
          className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <span className="font-mono text-[11px] text-ink-subtle min-w-[70px]">
          {ringBufferLen > 0
            ? `${scrubbing ? scrubIndex : ringBufferLen - 1}/${ringBufferLen - 1}`
            : '0/0'}
        </span>
      </div>

      {/* Live toggle & export replay */}
      <div className="flex items-center space-x-2">
        {scrubbing && (
          <button
            onClick={handleResumeLive}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-sm bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors"
          >
            <Rewind className="w-3.5 h-3.5" />
            <span>Resume Live</span>
          </button>
        )}

        <button
          onClick={handleExportReplay}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-sm bg-surface-2 border border-hairline text-ink-muted hover:text-ink hover:bg-surface-3 text-xs transition-colors"
          title="Export deterministic action log for 100% reproducible replay"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Replay</span>
        </button>
      </div>
    </footer>
  );
};
