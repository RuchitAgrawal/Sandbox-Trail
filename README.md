# Chaos Raft Sandbox

A deterministic distributed systems simulator and chaos engineering visualizer. Built with a pure Rust discrete-event simulation engine, compiled to WebAssembly, and rendered with an HTML5 Canvas2D frontend styled after Linear and Vercel dark developer tooling.

---

## Architectural Principles

1. **Strict Separation of Simulation and Rendering**: All Raft state machines, randomized election timers, min-heap network queues, and fault injection matrices execute deterministically inside a single-threaded Rust core compiled to WebAssembly. The frontend never computes Raft transitions; it dispatches user commands and paints the resulting state snapshots at 60fps.
2. **Discrete Virtual Ticks**: Time advances explicitly in discrete millisecond increments (`sim.tick(delta_ms)` via internal 1ms steps). This guarantees 100% bit-for-bit identical replays regardless of monitor refresh rate (60Hz vs 120Hz) or playback speed (0.25x to 4x).
3. **Pure Rust Core (`sim-core`)**: The simulation logic is decoupled from browser and WASM APIs, allowing thousands of randomized fuzz and chaos tests to run natively via `cargo test` in milliseconds.
4. **Decoupled Render & HUD Loop**: The Canvas2D animation loop reads snapshots directly from the WASM bridge at 60Hz without React re-renders. The React HUD (Inspector drawer, safety badges, scrubber) is throttled to 10Hz to ensure zero layout thrashing.

---

## System Architecture

```
+-----------------------------------------------------------------------+
|                         BROWSER (React + Vite)                        |
|                                                                       |
|  +-----------------------------+    +------------------------------+  |
|  |   React UI / HUD (Zustand)  |    |   HTML5 Canvas (60fps Loop)  |  |
|  | - Chaos Toolbar (Scissors)  |    | - Nodes, States, Timers      |  |
|  | - Node Log Inspector        |    | - Flying Packets (RPCs)      |  |
|  | - Time-Travel Scrubber      |    | - Partition Lines & Lag      |  |
|  +--------------+--------------+    +--------------+---------------+  |
|                 | Commands                         ^ Snapshot         |
|                 v                                  | (60Hz pull)      |
+-----------------|----------------------------------|------------------+
                  |           WASM FFI Bridge        |
                  |   (wasm-bindgen + serde-wasm-bindgen)              |
+-----------------|----------------------------------|------------------+
|                 v                                  |                  |
|  +----------------------------------------------------------+        |
|  |            SimulationController  (sim-wasm)              |        |
|  |   - Owns SimState & Snapshot Ring Buffer                 |        |
|  |   - Serializes state snapshots to JS via serde           |        |
|  +----------------------------------------------------------+        |
|  |            sim-core  (Pure Rust Engine)                  |        |
|  |                                                          |        |
|  |  VirtualClock ──► VirtualNetwork ──► RaftNodes[]        |        |
|  |   (1ms Ticks,     (BinaryHeap,        (State Machines,   |        |
|  |   ChaCha8Rng)      Chaos Matrix)       Replicated Log)   |        |
|  |                                                          |        |
|  |  InvariantChecker ──► EventLog ──► SnapshotRingBuffer   |        |
|  +----------------------------------------------------------+        |
+-----------------------------------------------------------------------+
```

---

## Features & Capabilities

- **Raft Consensus Protocol (§5)**: Complete implementation of leader election, randomized timeouts (150–300ms), heartbeat intervals (50ms), and log replication with majority quorum commits.
- **Interactive Scissor Tool**: Drag a cut line across the stage to sever network communication between nodes. Intersected links toggle partition boundaries in real time.
- **Visual Packet Transitions**: RPC packets (`AppendEntries`, `RequestVote`, replies, client commands) animate linearly across links. Dropped or partitioned packets explode in red marker bursts at link midpoints.
- **Node Replicated Log Inspector**: Inspect each node's `currentTerm`, `votedFor`, `commitIndex`, and full replicated log entries color-coded by commitment status.
- **Real-Time Invariant Verification**: Continuous runtime verification of core safety guarantees:
  - *Election Safety*: At most one leader per term.
  - *Log Matching*: Committed entries never diverge across cluster logs.
- **Time-Travel Scrubber**: Ring-buffered state snapshots allow instant backward scrubbing to analyze split votes, elections, and recoveries.
- **Deterministic Replay Export**: Export the session's action log and PRNG seed to replay any chaos scenario bit-for-bit.

---

## Monorepo Layout

```
chaos-sandbox/
├── crates/
│   ├── sim-core/              # Pure Rust deterministic simulator
│   │   ├── src/
│   │   │   ├── clock.rs       # VirtualClock & seeded ChaCha8 PRNG
│   │   │   ├── network.rs     # Min-heap packet queue & link matrix
│   │   │   ├── raft/          # Raft state machines, logs & RPC definitions
│   │   │   ├── chaos.rs       # Fault injection rules
│   │   │   ├── invariants.rs  # Election safety & log matching checkers
│   │   │   ├── snapshot.rs    # Serializable state representations
│   │   │   ├── event_log.rs   # Append-only action log for replay
│   │   │   └── sim.rs         # SimState coordinator & 1ms step loop
│   │   └── tests/             # Unit and fuzz testing suite (12 tests)
│   └── sim-wasm/              # wasm-bindgen FFI bridge & controller
└── web/                       # React 18 + Vite + TypeScript frontend
    ├── src/
    │   ├── engine/            # Canvas renderer, layout math, WASM singleton
    │   ├── store/             # Zustand state management
    │   └── components/        # CanvasStage, Toolbar, Inspector, Scrubber
```

---

## Getting Started

### Prerequisites

- Rust (1.78+ or stable): `rustup default stable`
- WebAssembly Target: `rustup target add wasm32-unknown-unknown`
- wasm-pack: `cargo install wasm-pack`
- Node.js (18+) & npm

### Development Workflow

1. **Run Rust Core Tests**:
   ```bash
   cargo test --workspace
   ```

2. **Build WebAssembly Bundle**:
   ```bash
   wasm-pack build crates/sim-wasm --target web --out-dir ../../web/src/wasm
   ```

3. **Start Frontend Dev Server**:
   ```bash
   cd web
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.
