import React from 'react';
import { X, Zap, WifiOff, Clock } from 'lucide-react';
import { useSimStore } from '../store/useSimStore';
import { setLinkDropRate, setLinkLatency, setPartition } from '../engine/wasmBridge';

export const LinkPopover: React.FC = () => {
  const { selectedLink, setSelectedLink, snapshot } = useSimStore();

  if (!selectedLink || !snapshot) return null;

  const link = snapshot.links.find(
    (l) =>
      (l.a === selectedLink.a && l.b === selectedLink.b) ||
      (l.a === selectedLink.b && l.b === selectedLink.a)
  );

  if (!link) return null;

  return (
    <div className="absolute right-84 top-16 z-20 w-72 bg-surface-1/95 backdrop-blur-md p-4 rounded-md border border-hairline shadow-2xl space-y-3.5 select-none font-sans text-xs">
      <div className="flex items-center justify-between border-b border-hairline pb-2">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-semibold text-ink">
            Link (N{link.a} ↔ N{link.b})
          </span>
        </div>
        <button
          onClick={() => setSelectedLink(null)}
          className="text-ink-subtle hover:text-ink p-0.5 rounded-sm"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Partition Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-ink-muted flex items-center space-x-1.5">
          <WifiOff className="w-3.5 h-3.5 text-red-400" />
          <span>Cut Partition:</span>
        </span>
        <button
          onClick={() => setPartition(link.a, link.b, !link.partitioned)}
          className={`px-3 py-1 rounded-sm text-xs font-mono font-medium border transition-colors ${
            link.partitioned
              ? 'bg-red-950/60 text-red-400 border-red-900 hover:bg-red-900/40'
              : 'bg-surface-3 text-ink-subtle border-hairline hover:bg-surface-4'
          }`}
        >
          {link.partitioned ? 'PARTITIONED' : 'CONNECTED'}
        </button>
      </div>

      {/* Extra Lag Slider */}
      <div className="space-y-1">
        <div className="flex justify-between font-mono text-[11px]">
          <span className="text-ink-subtle flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Extra Lag:</span>
          </span>
          <span className="text-ink">+{link.extra_lag_ms}ms</span>
        </div>
        <input
          type="range"
          min={0}
          max={400}
          step={20}
          value={link.extra_lag_ms}
          onChange={(e) =>
            setLinkLatency(link.a, link.b, link.base_latency_ms, parseInt(e.target.value))
          }
          className="w-full h-1 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Packet Drop Rate Slider */}
      <div className="space-y-1">
        <div className="flex justify-between font-mono text-[11px]">
          <span className="text-ink-subtle">Packet Loss:</span>
          <span className="text-ink">{Math.round(link.drop_rate * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={link.drop_rate}
          onChange={(e) => setLinkDropRate(link.a, link.b, parseFloat(e.target.value))}
          className="w-full h-1 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>
    </div>
  );
};
