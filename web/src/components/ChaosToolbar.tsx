import React from 'react';
import { MousePointer, Scissors, Skull, Edit3 } from 'lucide-react';
import { useSimStore, ToolMode } from '../store/useSimStore';
import { healAll } from '../engine/wasmBridge';

export const ChaosToolbar: React.FC = () => {
  const { tool, setTool } = useSimStore();

  const tools: { id: ToolMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
    {
      id: 'pointer',
      label: 'Pointer / Drag Node / Link Config',
      icon: <MousePointer className="w-4 h-4" />,
      shortcut: 'V',
    },
    {
      id: 'scissor',
      label: 'Scissor (Drag to cut / partition links)',
      icon: <Scissors className="w-4 h-4" />,
      shortcut: 'C',
    },
    {
      id: 'crash',
      label: 'Crash / Restart Node',
      icon: <Skull className="w-4 h-4" />,
      shortcut: 'K',
    },
    {
      id: 'write',
      label: 'Client Write Command',
      icon: <Edit3 className="w-4 h-4" />,
      shortcut: 'W',
    },
  ];

  return (
    <div className="absolute left-4 top-16 z-20 flex flex-col space-y-1 bg-surface-1/90 backdrop-blur-md p-1.5 rounded-md border border-hairline shadow-2xl">
      <div className="px-2 py-1 text-[10px] font-mono text-ink-subtle uppercase tracking-wider border-b border-hairline mb-1">
        Chaos Tools
      </div>

      {tools.map((t) => {
        const isActive = tool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.shortcut})`}
            className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-sm text-xs transition-colors ${
              isActive
                ? 'bg-primary text-white font-medium'
                : 'text-ink-muted hover:text-ink hover:bg-surface-2'
            }`}
          >
            {t.icon}
            <span className="font-sans text-xs">{t.id.charAt(0).toUpperCase() + t.id.slice(1)}</span>
            <span className="ml-auto text-[10px] font-mono text-ink-tertiary">
              {t.shortcut}
            </span>
          </button>
        );
      })}

      <div className="border-t border-hairline mt-1 pt-1">
        <button
          onClick={healAll}
          title="Heal all active network partitions"
          className="w-full flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-950/40 rounded-sm transition-colors border border-emerald-900/30"
        >
          <span className="text-[11px] font-mono">Heal All Links</span>
        </button>
      </div>
    </div>
  );
};
