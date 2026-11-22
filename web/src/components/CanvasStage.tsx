import React, { useRef, useEffect } from 'react';

export const CanvasStage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
