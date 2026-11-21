import { useSimStore } from '../store/useSimStore';
import { ClientWriteAck, SimSnapshot } from '../types/sim';

interface WasmSimulationController {
  tick(delta_ms: bigint): void;
  get_snapshot(): SimSnapshot;
  get_snapshot_at(ring_index: number): SimSnapshot;
  get_ring_buffer_len(): number;
  client_write(node_id: number, cmd: string): ClientWriteAck;
  set_partition(a: number, b: number, cut: boolean): void;
  set_link_latency(a: number, b: number, base_ms: bigint, extra_lag_ms: bigint): void;
  set_link_drop_rate(a: number, b: number, rate: number): void;
  toggle_crash(node_id: number): void;
  heal_all(): void;
  export_replay(): string;
}

let controller: WasmSimulationController | null = null;
let latestSnapshot: SimSnapshot | null = null;
let hudInterval: number | null = null;

export async function initWasm(nodeCount: number = 5, seed: number = 42): Promise<boolean> {
  try {
    // Dynamic import of wasm-pack generated module
    const wasmModule = await import('../wasm/sim_wasm.js');
    if (typeof wasmModule.default === 'function') {
      await wasmModule.default();
    }

    controller = new wasmModule.SimulationController(nodeCount, BigInt(seed));
    latestSnapshot = controller!.get_snapshot();
    useSimStore.getState().setSnapshot(latestSnapshot);
    useSimStore.getState().setRingBufferLen(controller!.get_ring_buffer_len());

    // Throttle React HUD updates to ~10Hz (100ms) to avoid 60fps React re-renders
    if (hudInterval) {
      clearInterval(hudInterval);
    }
    hudInterval = window.setInterval(() => {
      if (latestSnapshot && !useSimStore.getState().scrubbing) {
        useSimStore.getState().setSnapshot(latestSnapshot);
      }
      if (controller) {
        useSimStore.getState().setRingBufferLen(controller.get_ring_buffer_len());
      }
    }, 100);

    return true;
  } catch (err) {
    console.error('Failed to initialize WASM simulation controller:', err);
    return false;
  }
}

export function tickAndGetSnapshot(deltaMs: number): SimSnapshot | null {
  if (!controller) return null;
  controller.tick(BigInt(Math.max(1, Math.round(deltaMs))));
  latestSnapshot = controller.get_snapshot();
  return latestSnapshot;
}

export function getLatestSnapshot(): SimSnapshot | null {
  return latestSnapshot;
}

export function getSnapshotAt(ringIndex: number): SimSnapshot | null {
  if (!controller) return null;
  try {
    return controller.get_snapshot_at(ringIndex);
  } catch {
    return null;
  }
}

export function getRingBufferLen(): number {
  if (!controller) return 0;
  return controller.get_ring_buffer_len();
}

export function setPartition(a: number, b: number, cut: boolean): void {
  if (!controller) return;
  controller.set_partition(a, b, cut);
  latestSnapshot = controller.get_snapshot();
}

export function setLinkLatency(a: number, b: number, baseMs: number, extraLagMs: number): void {
  if (!controller) return;
  controller.set_link_latency(a, b, BigInt(baseMs), BigInt(extraLagMs));
  latestSnapshot = controller.get_snapshot();
}

export function setLinkDropRate(a: number, b: number, rate: number): void {
  if (!controller) return;
  controller.set_link_drop_rate(a, b, rate);
  latestSnapshot = controller.get_snapshot();
}

export function toggleCrash(nodeId: number): void {
  if (!controller) return;
  controller.toggle_crash(nodeId);
  latestSnapshot = controller.get_snapshot();
}

export function healAll(): void {
  if (!controller) return;
  controller.heal_all();
  latestSnapshot = controller.get_snapshot();
}

export function clientWrite(nodeId: number, cmd: string): ClientWriteAck | null {
  if (!controller) return null;
  try {
    const ack = controller.client_write(nodeId, cmd);
    latestSnapshot = controller.get_snapshot();
    return ack;
  } catch (e) {
    console.error('clientWrite failed:', e);
    return null;
  }
}

export function exportReplay(): string | null {
  if (!controller) return null;
  try {
    return controller.export_replay();
  } catch {
    return null;
  }
}
