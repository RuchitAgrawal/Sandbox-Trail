import React, { useState } from 'react';
import { X, Send, Skull, RotateCcw, Database, AlertCircle } from 'lucide-react';
import { useSimStore } from '../store/useSimStore';
import { clientWrite, toggleCrash } from '../engine/wasmBridge';

export const NodeInspector: React.FC = () => {
  const { selectedNodeId, setSelectedNodeId, snapshot } = useSimStore();
  const [commandInput, setCommandInput] = useState('SET key = 42');
  const [writeFeedback, setWriteFeedback] = useState<string | null>(null);

  if (selectedNodeId === null || !snapshot) {
    return null;
  }

  const node = snapshot.nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const handleSendWrite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const ack = clientWrite(node.id, commandInput.trim());
    if (ack) {
      if (ack.success) {
        setWriteFeedback(`Accepted at index ${ack.index}`);
      } else {
        setWriteFeedback(
          ack.leader_hint !== null && ack.leader_hint !== undefined
            ? `Redirect: Leader is Node ${ack.leader_hint}`
            : 'Rejected: Not the leader'
        );
      }
    }
    setTimeout(() => setWriteFeedback(null), 3000);
  };

  const roleBadgeColor = {
    Leader: 'bg-emerald-950/60 text-emerald-400 border-emerald-900',
    Candidate: 'bg-amber-950/60 text-amber-400 border-amber-900',
    Follower: 'bg-slate-900/60 text-slate-300 border-slate-700',
    Crashed: 'bg-red-950/60 text-red-400 border-red-900',
  }[node.role];

  return (
    <aside className="w-80 bg-surface-1 border-l border-hairline flex flex-col z-20 select-none overflow-hidden h-[calc(100vh-3rem-2.5rem)]">
      {/* Header */}
      <div className="h-12 border-b border-hairline px-4 flex items-center justify-between bg-surface-1">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-ink">Node {node.id} Inspector</span>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="text-ink-subtle hover:text-ink p-1 rounded-sm hover:bg-surface-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status card */}
        <div className="bg-surface-2 p-3 rounded-md border border-hairline space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-subtle font-mono">Role:</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${roleBadgeColor}`}>
              {node.role}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 border-t border-hairline">
            <div>
              <span className="text-ink-subtle text-[11px]">Current Term:</span>
              <p className="text-ink font-semibold">{node.current_term}</p>
            </div>
            <div>
              <span className="text-ink-subtle text-[11px]">Voted For:</span>
              <p className="text-ink font-semibold">
                {node.voted_for !== null ? `Node ${node.voted_for}` : 'None'}
              </p>
            </div>
            <div>
              <span className="text-ink-subtle text-[11px]">Commit Index:</span>
              <p className="text-emerald-400 font-semibold">{node.commit_index}</p>
            </div>
            <div>
              <span className="text-ink-subtle text-[11px]">Last Applied:</span>
              <p className="text-ink font-semibold">{node.last_applied}</p>
            </div>
          </div>

          {/* Crash / Restart button */}
          <button
            onClick={() => toggleCrash(node.id)}
            className={`w-full mt-2 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-sm text-xs font-medium border transition-colors ${
              node.role === 'Crashed'
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/30'
                : 'bg-red-950/40 text-red-400 border-red-900/50 hover:bg-red-900/30'
            }`}
          >
            {node.role === 'Crashed' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart Node</span>
              </>
            ) : (
              <>
                <Skull className="w-3.5 h-3.5" />
                <span>Crash Node</span>
              </>
            )}
          </button>
        </div>

        {/* Client Write input form */}
        <div className="bg-surface-2 p-3 rounded-md border border-hairline space-y-2">
          <span className="text-xs font-mono text-ink-subtle block">Send Client Command:</span>
          <form onSubmit={handleSendWrite} className="flex space-x-1.5">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="e.g. SET x = 10"
              className="flex-1 bg-surface-3 border border-hairline text-ink text-xs px-2.5 py-1.5 rounded-sm focus:outline-none focus:border-primary font-mono"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 bg-primary text-white rounded-sm hover:bg-primary-hover text-xs transition-colors flex items-center justify-center"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>

          {writeFeedback && (
            <div className="text-[11px] font-mono text-amber-400 flex items-center space-x-1 mt-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>{writeFeedback}</span>
            </div>
          )}
        </div>

        {/* Replicated Log Entries Table */}
        <div className="bg-surface-2 rounded-md border border-hairline overflow-hidden">
          <div className="px-3 py-2 border-b border-hairline flex items-center justify-between">
            <span className="text-xs font-mono text-ink-subtle">
              Replicated Log ({node.log_entries.length - 1} entries)
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {node.log_entries.length <= 1 ? (
              <div className="p-3 text-center text-xs font-mono text-ink-tertiary">
                Log is empty (sentinel index 0)
              </div>
            ) : (
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-surface-3 text-ink-subtle border-b border-hairline">
                  <tr>
                    <th className="py-1 px-2.5">Idx</th>
                    <th className="py-1 px-2">Term</th>
                    <th className="py-1 px-2">Command</th>
                    <th className="py-1 px-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {node.log_entries.slice(1).map((entry) => {
                    const isCommitted = entry.index <= node.commit_index;
                    return (
                      <tr key={entry.index} className="hover:bg-surface-3/50">
                        <td className="py-1 px-2.5 text-ink-subtle">{entry.index}</td>
                        <td className="py-1 px-2 text-ink-muted">T{entry.term}</td>
                        <td className="py-1 px-2 text-ink truncate max-w-[90px]">
                          {entry.command}
                        </td>
                        <td className="py-1 px-2.5 text-right">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] ${
                              isCommitted
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60'
                                : 'bg-amber-950/60 text-amber-400 border border-amber-900/60'
                            }`}
                          >
                            {isCommitted ? 'Commit' : 'Uncom'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Node Event Logs */}
        <div className="bg-surface-2 rounded-md border border-hairline overflow-hidden">
          <div className="px-3 py-1.5 border-b border-hairline">
            <span className="text-xs font-mono text-ink-subtle">Recent Events</span>
          </div>
          <div className="p-2.5 max-h-36 overflow-y-auto space-y-1 font-mono text-[10px] text-ink-muted">
            {node.node_log.slice(-15).map((log, i) => (
              <div key={i} className="leading-tight text-ink-subtle hover:text-ink">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
