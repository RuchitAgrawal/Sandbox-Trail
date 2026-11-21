import { create } from 'zustand';
import { SimSnapshot } from '../types/sim';

export type ToolMode = 'pointer' | 'scissor' | 'crash' | 'write';
export type SimSpeed = 0.25 | 0.5 | 1 | 2 | 4;

interface SimStateStore {
  // Playback state
  paused: boolean;
  speed: SimSpeed;
  seed: number;
  clusterSize: number;

  // Active Tool
  tool: ToolMode;

  // Inspections
  selectedNodeId: number | null;
  selectedLink: { a: number; b: number } | null;

  // Time-travel scrubber state
  scrubbing: boolean;
  scrubIndex: number;
  ringBufferLen: number;

  // Snapshot updated at 10Hz for HUD panels
  snapshot: SimSnapshot | null;

  // Guided Scenarios
  activeScenario: string | null;

  // Actions
  setPaused: (paused: boolean) => void;
  togglePause: () => void;
  setSpeed: (speed: SimSpeed) => void;
  setSeed: (seed: number) => void;
  setClusterSize: (size: number) => void;
  setTool: (tool: ToolMode) => void;
  setSelectedNodeId: (id: number | null) => void;
  setSelectedLink: (link: { a: number; b: number } | null) => void;
  setScrubbing: (scrubbing: boolean) => void;
  setScrubIndex: (index: number) => void;
  setRingBufferLen: (len: number) => void;
  setSnapshot: (snapshot: SimSnapshot) => void;
  setActiveScenario: (scenario: string | null) => void;
}

export const useSimStore = create<SimStateStore>((set) => ({
  paused: false,
  speed: 1,
  seed: 42,
  clusterSize: 5,
  tool: 'pointer',
  selectedNodeId: null,
  selectedLink: null,
  scrubbing: false,
  scrubIndex: 0,
  ringBufferLen: 0,
  snapshot: null,
  activeScenario: null,

  setPaused: (paused) => set({ paused }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setSpeed: (speed) => set({ speed }),
  setSeed: (seed) => set({ seed }),
  setClusterSize: (clusterSize) => set({ clusterSize }),
  setTool: (tool) => set({ tool }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setSelectedLink: (selectedLink) => set({ selectedLink }),
  setScrubbing: (scrubbing) => set({ scrubbing }),
  setScrubIndex: (scrubIndex) => set({ scrubIndex }),
  setRingBufferLen: (ringBufferLen) => set({ ringBufferLen }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setActiveScenario: (activeScenario) => set({ activeScenario }),
}));
