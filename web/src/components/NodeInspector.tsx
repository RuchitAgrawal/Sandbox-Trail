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