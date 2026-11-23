import React from 'react';
import { HeaderBar } from './components/HeaderBar';
import { CanvasStage } from './components/CanvasStage';
import { ChaosToolbar } from './components/ChaosToolbar';
import { NodeInspector } from './components/NodeInspector';
import { TimelineScrubber } from './components/TimelineScrubber';
import { LinkPopover } from './components/LinkPopover';
import { ScenarioModal } from './components/ScenarioModal';

export const App: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-screen bg-canvas text-ink overflow-hidden select-none font-sans">
      {/* Top Header Bar */}
      <HeaderBar />

      {/* Main Interactive Stage */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Central Canvas2D Visualizer */}
        <CanvasStage />

        {/* Floating Chaos Toolbar (Pointer, Scissor, Crash, Write) */}
        <ChaosToolbar />

        {/* Floating Link Latency / Partition Configuration Popover */}
        <LinkPopover />

        {/* Guided Scenario Step-by-Step Overlay */}
        <ScenarioModal />

        {/* Right Drawer: Node Replicated Log & State Inspector */}
        <NodeInspector />
      </div>

      {/* Bottom Time-Travel Scrubber & Action Replay Bar */}
      <TimelineScrubber />
    </div>
  );
};

export default App;
