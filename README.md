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
|  |   - Owns SimState & Snapshot 