"use client";

import { useEffect, useState } from "react";
import { setHash, useHash } from "@/kit/hash";
import { squaresFor } from "@/lib/waffleMath";
import type { WaffleData } from "@/lib/waffle";

const STEP_MS = 450;
const MOMENT_YEARS = [1988, 2000, 2010];

const pound = (perMille: number) => `£${(perMille / 10).toFixed(1)}`;

export function Waffle({ data }: { data: WaffleData }) {
  const { years, divisions, weights } = data;
  const last = years.length - 1;

  // The selected year lives in the URL hash (`/pound#1995`), so every state
  // is a shareable link. The server snapshot is empty, so the first client
  // render matches the server's.
  const hash = useHash();
  const linked = years.indexOf(Number(hash.slice(1)));
  const index = linked >= 0 ? linked : last;
  const [playing, setPlaying] = useState(false);
  const isPlaying = playing && index < last;

  const select = (next: number) => setHash(String(years[next]));

  useEffect(() => {
    if (!isPlaying) return;
    const id = setTimeout(() => setHash(String(years[index + 1])), STEP_MS);
    return () => clearTimeout(id);
  }, [isPlaying, index, years]);

  const then = weights[index];
  const now = weights[last];
  const squares = squaresFor(then).flatMap((count, division) => Array<number>(count).fill(division));

  return (
    <>
      <div className="replay-moments" role="group" aria-label="Jump to a year">
        {MOMENT_YEARS.filter((y) => years.includes(y)).map((y) => (
          <button key={y} type="button" className={years[index] === y ? "range-btn active" : "range-btn"} onClick={() => { setPlaying(false); select(years.indexOf(y)); }}>
            {y}
          </button>
        ))}
        <button type="button" className={index === last ? "range-btn active" : "range-btn"} onClick={() => { setPlaying(false); select(last); }}>
          {years[last]} (now)
        </button>
      </div>

      <section className="chart-section waffle-section">
        <div
          className="waffle"
          role="img"
          aria-label={`Where £100 of household spending went in ${years[index]}: ${divisions
            .map((d, i) => `${d.name} ${pound(then[i])}`)
            .join(", ")}`}
        >
          {squares.map((division, i) => (
            <span
              key={i}
              className="waffle-cell"
              style={{ background: `light-dark(${divisions[division].light}, ${divisions[division].dark})` }}
            />
          ))}
        </div>

        <table className="waffle-table">
          <caption>
            Of every £100 spent, in <b>{years[index]}</b> vs {years[last]}
          </caption>
          <thead>
            <tr>
              <th>Division</th>
              <th>{years[index]}</th>
              <th>{years[last]}</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {divisions.map((d, i) => {
              const change = (now[i] - then[i]) / 10;
              return (
                <tr key={d.coicop}>
                  <td>
                    <span className="swatch" style={{ background: `light-dark(${d.light}, ${d.dark})` }} />
                    {d.name}
                  </td>
                  <td>{pound(then[i])}</td>
                  <td>{pound(now[i])}</td>
                  <td className="muted">
                    {Math.abs(change) < 0.05 ? "–" : `${change > 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="replay-controls waffle-controls">
          <button
            type="button"
            className="range-btn active replay-play"
            onClick={() => {
              if (isPlaying) return setPlaying(false);
              if (index >= last) select(0);
              setPlaying(true);
            }}
          >
            {isPlaying ? "Pause" : index >= last ? "Replay" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={last}
            value={index}
            aria-label="Year"
            aria-valuetext={String(years[index])}
            onChange={(event) => {
              setPlaying(false);
              select(Number(event.target.value));
            }}
          />
        </div>
      </section>
    </>
  );
}
