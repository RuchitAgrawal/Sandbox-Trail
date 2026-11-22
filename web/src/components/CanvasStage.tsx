import React, { useEffect, useRef, useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import {
  calculateNodeLayout,
  NodeLayout,
  Point,
  setCustomNodePosition,
} from '../engine/layout';
import {
  findIntersectedLinks,
  findLinkNear,
  findNodeAt,
} from '../engine/hitTest';
import { renderSimulation } from '../engine/renderer';
import {
  getLatestSnapshot,
  setPartition,
  tickAndGetSnapshot,
  toggleCrash,
} from '../engine/wasmBridge';

export const CanvasStage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    paused,
    speed,
    tool,
    selectedNodeId,
    setSelectedNodeId,
    selectedLink,
    setSelectedLink,
    scrubbing,
    clusterSize,
  } = useSimStore();

  // Mouse interaction state
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    id: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);
  const [scissorLine, setScissorLine] = useState<{
    start: Point;
    end: Point;
  } | null>(null);

  // Layout cache
  const layoutRef = useRef<NodeLayout[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      layoutRef.current = calculateNodeLayout(clusterSize, rect.width, rect.height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    const renderLoop = (now: number) => {
      const deltaMs = (now - lastTime) * speed;
      lastTime = now;

      // Advance deterministic simulation when not paused and not scrubbing
      let currentSnapshot = getLatestSnapshot();
      if (!paused && !scrubbing && deltaMs > 0) {
        currentSnapshot = tickAndGetSnapshot(deltaMs);
      }

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.save();
        ctx.scale(dpr, dpr);

        layoutRef.current = calculateNodeLayout(clusterSize, rect.width, rect.height);

        renderSimulation(ctx, rect.width, rect.height, currentSnapshot, layoutRef.current, {
          selectedNodeId,
          selectedLink,
          hoveredNodeId,
          scissorStart: scissorLine?.start || null,
          scissorEnd: scissorLine?.end || null,
        });

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [paused, speed, scrubbing, selectedNodeId, selectedLink, hoveredNodeId, scissorLine, clusterSize]);

  // Canvas Mouse Coordinates Helper
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const hitNode = findNodeAt(coords.x, coords.y, layoutRef.current);

    if (tool === 'pointer') {
      if (hitNode !== null) {
        setDraggingNode({
          id: hitNode,
          startX: coords.x,
          startY: coords.y,
          hasMoved: false,
        });
      } else {
        const snap = getLatestSnapshot();
        if (snap) {
          const hitLink = findLinkNear(coords.x, coords.y, snap.links, layoutRef.current);
          setSelectedLink(hitLink);
          if (!hitLink) {
            setSelectedNodeId(null);
          }
        }
      }
    } else if (tool === 'scissor') {
      setScissorLine({
        start: coords,
        end: coords,
      });
    } else if (tool === 'crash') {
      if (hitNode !== null) {
        toggleCrash(hitNode);
      }
    } else if (tool === 'write') {
      if (hitNode !== null) {
        setSelectedNodeId(hitNode);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    // Update hovered node
    const hit = findNodeAt(coords.x, coords.y, layoutRef.current);
    setHoveredNodeId(hit);

    if (draggingNode) {
      const dist = Math.hypot(coords.x - draggingNode.startX, coords.y - draggingNode.startY);
      setCustomNodePosition(draggingNode.id, coords);
      if (dist > 4) {
        setDraggingNode((prev) => (prev ? { ...prev, hasMoved: true } : null));