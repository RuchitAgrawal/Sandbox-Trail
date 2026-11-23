import React from 'react';
import { X, Play, Info, ArrowRight } from 'lucide-react';
import { useSimStore } from '../store/useSimStore';
import { clientWrite, healAll, setLinkDropRate, setPartition, toggleCrash } from '../engine/wasmBridge';

export const ScenarioModal: React.FC = () => {
  const { activeScenario, setActiveScenario, snapshot } = useSimStore();

  if (!activeScenario) return null;

  const scenarios: Record<
    string,
    {
      title: string;
      desc: string;
      steps: string[];
      setup: () => void;
    }
  > = {
    'normal-election': {
      title: 'Scenario 1: Leader Election Walkthrough',
      desc: 'Observe how randomized election timeouts (150–300ms) prevent split votes and allow a single candidate to achieve majority quorum.',
      steps: [
        'Watch the radial rings around followers fill clockwise.',
        'The fastest node increments term, votes for itself, and broadcasts RequestVote RPCs.',
        'Upon receiving 3 of 5 votes, it turns Emerald (Leader) and begins sending blue Heartbeat dots.',
      ],
      setup: () => {
        healAll();
      },
    },
    'split-brain': {
      title: 'Scenario 2: 3 vs 2 Network Partition (Split-Brain Test)',
      desc: 'Sever communication between nodes {0, 1} and {2, 3, 4}. Observe that the minority partition cannot elect a leader or commit entries.',
      steps: [
        'Links between minority {0, 1} and majority {2, 3, 4} are severed (red dashed lines).',
        'Minority nodes {0, 1} spin in candidate elections but never reach quorum (3 votes).',
        'Majority {2, 3, 4} elects a leader and continues committing writes safely.',
      ],
      setup: () => {
        healAll();
        // Cut minority 0, 1 from majority 2, 3, 4
        for (const a of [0, 1]) {
          for (const b of [2, 3, 4]) {
            setPartition(a, b, true);
          }
        }
      },
    },
    'leader-crash': {
      title: 'Scenario 3: Leader Crash Mid-Write',
      desc: 'Submit a client write to the active leader, then immediately crash it to test leader failover and election recovery.',
      steps: [
        'Client command is appended to current leader.',
        'Leader is crashed (red dashed node).',
        'Followers detect heartbeat loss, trigger new elections, and elect an up-to-date successor.',
      ],
      setup: () => {
        healAll();
        if (snapshot?.invariant_status.current_leader !== null && snapshot?.invariant_status.current_leader !== undefined) {
          const leader = snapshot.invariant_status.current_leader;
          clientWrite(leader, 'SET x = 999');
          setTimeout(() => toggleCrash(leader), 50);
        }
      },
    },
    'flaky-loss': {
      title: 'Scenario 4: Flaky Loss Network (30% Drop Rate)',
      desc: 'Inject 30% randomized packet loss across all inter-node links to visualize Raft resilience under unreliable transport.',
      steps: [
        'All links set to 30% packet loss.',
        'Packets that are lost display a red X explosion mid-flight.',
        'Heartbeats and elections automatically retry until consistency is achieved.',
      ],
      setup: () => {
        healAll();
        for (let a = 0; a < 5; a++) {
          for (let b = a + 1; b < 5; b++) {
            setLinkDropRate(a, b, 0.3);
          }
        }
      },
    },
  };

  const current = scenarios[activeScenario];
  if (!current) return null;

  return (
    <div className="absolute left-4 bottom-14 z-20 max-w-md bg-surface-1/95 backdrop-blur-md p-4 rounded-md border border-hairline shadow-2xl space-y-3 select-none text-xs font-sans">
      <div className="flex items-center justify-between border-b border-hairline pb-2">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-ink">{current.title}</h3>
        </div>
        <button
          onClick={() => setActiveScenario(null)}
          className="text-ink-subtle hover:text-ink p-0.5 rounded-sm"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-ink-muted leading-relaxed">{current.desc}</p>

      <div className="bg-surface-2 p-2.5 rounded border border-hairline space-y-1.5 font-mono text-[11px]">
        <span className="text-ink-subtle font-semibold block text-[10px] uppercase">
          Key Things to Watch:
        </span>
        {current.steps.map((s, idx) => (
          <div key={idx} className="flex items-start space-x-1.5 text-ink-muted">
            <ArrowRight className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
            <span>{s}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end space-x-2 pt-1">
        <button
          onClick={current.setup}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-sm bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Apply Scenario</span>
        </button>
      </div>
    </div>
  );
};
