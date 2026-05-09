import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const BAR_COUNT = 80;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = ((s * 1664525) + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateBars(trackId: string): number[] {
  const seed = trackId.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7);
  const rng = seededRandom(seed);
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const rand = rng();
    const pos = i / BAR_COUNT;
    const envelope = Math.pow(Math.sin(pos * Math.PI), 0.4) * 0.45 + 0.55;
    return Math.max(0.07, Math.min(1, rand * envelope));
  });
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface WaveformScrubberProps {
  trackId: string;
  progress: number;
  onSeek: (ratio: number) => void;
  accentColor?: string;
  dimColor?: string;
  playheadColor?: string;
  height?: number;
  className?: string;
}

export function WaveformScrubber({
  trackId,
  progress,
  onSeek,
  accentColor = 'var(--cyan)',
  dimColor = 'var(--muted)',
  playheadColor = '#ffffff',
  height = 36,
  className,
}: WaveformScrubberProps) {
  const bars = useMemo(() => generateBars(trackId), [trackId]);
  const containerRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(400);

  const zoomRef = useRef(MIN_ZOOM);
  const startRef = useRef(0);
  const isDragging = useRef(false);
  const pageOffsetX = useRef(0);
  const [, forceUpdate] = useState(0);

  // Reset zoom/pan when track changes
  useEffect(() => {
    zoomRef.current = MIN_ZOOM;
    startRef.current = 0;
    forceUpdate(n => n + 1);
  }, [trackId]);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function getVisibleWidth() {
    return 1 / zoomRef.current;
  }

  function seekFromLocalX(localX: number) {
    const ratio = clamp(
      startRef.current + (clamp(localX, 0, width) / width) * getVisibleWidth(),
      0,
      0.99,
    );
    onSeek(ratio);
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    const rect = containerRef.current!.getBoundingClientRect();
    pageOffsetX.current = rect.left;
    isDragging.current = true;
    seekFromLocalX(e.clientX - rect.left);
    e.preventDefault();
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const lx = e.clientX - pageOffsetX.current;
    if (lx >= 0 && lx <= width) {
      seekFromLocalX(lx);
    }
  }, [width]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Scroll to zoom, centred on cursor
  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const midRatio = clamp(cursorX / width, 0, 1);
    const factor = e.deltaY > 0 ? 0.85 : 1 / 0.85;
    const newZoom = clamp(zoomRef.current * factor, MIN_ZOOM, MAX_ZOOM);
    const newVisibleWidth = 1 / newZoom;
    const anchor = startRef.current + midRatio * getVisibleWidth();
    startRef.current = clamp(anchor - midRatio * newVisibleWidth, 0, 1 - newVisibleWidth);
    zoomRef.current = newZoom;
    forceUpdate(n => n + 1);
  }

  const visibleStart = startRef.current;
  const visibleWidth = getVisibleWidth();
  const progressFraction = progress / 100;
  const playheadX = ((progressFraction - visibleStart) / visibleWidth) * width;

  const BAR_SLOT = width / BAR_COUNT;
  const BAR_W = Math.max(2, BAR_SLOT - 2.5);

  return (
    <svg
      ref={containerRef}
      className={`waveform-scrubber${className ? ` ${className}` : ''}`}
      height={height}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{ width: '100%', cursor: 'pointer', display: 'block', userSelect: 'none' }}
    >
      {bars.map((h, i) => {
        const barCenterTrackPos = visibleStart + ((i + 0.5) / BAR_COUNT) * visibleWidth;
        const isPlayed = barCenterTrackPos <= progressFraction;
        const barH = Math.max(2, h * height * 0.88);
        const x = i * BAR_SLOT + (BAR_SLOT - BAR_W) / 2;
        const y = (height - barH) / 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={BAR_W}
            height={barH}
            rx={BAR_W / 2}
            fill={isPlayed ? accentColor : dimColor}
            opacity={isPlayed ? 1 : 0.35}
          />
        );
      })}
      {playheadX >= 0 && playheadX <= width && (
        <>
          <rect
            x={playheadX - 1.5}
            y={0}
            width={3}
            height={height}
            rx={1.5}
            fill={playheadColor}
            opacity={0.9}
          />
          <rect
            x={playheadX - 5}
            y={(height - 10) / 2}
            width={10}
            height={10}
            rx={5}
            fill={playheadColor}
            opacity={1}
          />
        </>
      )}
    </svg>
  );
}
