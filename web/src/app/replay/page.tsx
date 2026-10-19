import { EmbedCode } from "@/components/EmbedCode";
import { Replay } from "@/components/Replay";
import { buildReplayData } from "@/lib/replay";

export const metadata = { title: "Replay — Inflation Radar (UK)" };

export default function ReplayPage() {
  return (
    <>
      <section className="page-header">
        <h1>Replay UK inflation</h1>
        <p className="lede">
          Press play, or drag through time: each bar is a division&apos;s percentage-point
          contribution to the headline 12-month CPI rate, as published by ONS, re-ranked every
          month since November 2003. Click a bar to drill into that division&apos;s sub-categories
          and keep scrubbing. Past the last real month the bars fade — that&apos;s this project&apos;s
          own projection, not ONS data.
        </p>
      </section>
      <Replay data={buildReplayData()} />
      <EmbedCode path="/replay" height={980} title="Replay UK inflation" />
    </>
  );
}
