import { EmbedCode } from "@/kit/EmbedCode";
import { ShareBar } from "@/kit/ShareBar";
import { Replay } from "@/components/Replay";
import { buildReplayData, splitReplay } from "@/lib/replay";

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
      <Replay data={splitReplay(buildReplayData()).initial} />
      <ShareBar title="Replay UK inflation" filename="uk-inflation-replay" />
      <EmbedCode path="/replay" height={980} title="Replay UK inflation" />
    </>
  );
}
