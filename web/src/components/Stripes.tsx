"use client";

import { useRef, useState } from "react";
import { StripeStrip } from "./StripeStrip";

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);

/** The headline stripes as a scrubber track: drag or click to move the
 * cursor, arrow keys to step. Months outside `[from, to]` are dimmed — the
 * drilled-in node has no data there. */
export function Stripes({
  values,
  projectedFrom,
  from,
  to,
  index,
  describe,
  onSeek,
  onCommit,
}: {
  values: number[];
  projectedFrom: number | null;
  from: number;
  to: number;
  index: number;
  /** "Oct 2022 · 11.1%" for the month at an index. */
  describe: (index: number) => string;
  onSeek: (index: number) => void;
  /** Called once a drag or key press settles, with the final index. */
  onCommit: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  const pct = (i: number) => `${((i + 0.5) / n) * 100}%`;

  const indexAt = (clientX: number) => {
    const box = ref.current!.getBoundingClientRect();
    return clamp(Math.floor(((clientX - box.left) / box.width) * n), 0, n - 1);
  };

  return (
    <div
      ref={ref}
      className="stripes"
      role="slider"
      tabIndex={0}
      aria-label="Month"
      aria-valuemin={from}
      aria-valuemax={to}
      aria-valuenow={index}
      aria-valuetext={describe(index)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = indexAt(event.clientX);
        onSeek(dragging.current);
      }}
      onPointerMove={(event) => {
        const i = indexAt(event.clientX);
        setHover(i);
        if (dragging.current !== null) {
          dragging.current = i;
          onSeek(i);
        }
      }}
      onPointerUp={() => {
        if (dragging.current !== null) onCommit(dragging.current);
        dragging.current = null;
      }}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 12 : 1;
        const next =
          event.key === "ArrowLeft" ? index - step
          : event.key === "ArrowRight" ? index + step
          : event.key === "Home" ? from
          : event.key === "End" ? to
          : null;
        if (next === null) return;
        event.preventDefault();
        const target = clamp(next, from, to);
        onSeek(target);
        onCommit(target);
      }}
    >
      <StripeStrip values={values} projectedFrom={projectedFrom} label="CPI 12-month rate by month, coloured against the 2% target" />
      <div className="stripe-dim" style={{ left: 0, width: `${(from / n) * 100}%` }} />
      <div className="stripe-dim" style={{ right: 0, width: `${((n - 1 - to) / n) * 100}%` }} />
      <div className="stripe-cursor" style={{ left: pct(index) }} />
      {hover !== null && (
        <div className="stripe-hover" style={{ left: `clamp(70px, ${pct(hover)}, calc(100% - 70px))` }}>
          {describe(hover)}
        </div>
      )}
    </div>
  );
}
