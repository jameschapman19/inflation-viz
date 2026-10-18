import { EmbedCode } from "@/kit/EmbedCode";
import { Waffle } from "@/components/Waffle";
import { buildWaffleData } from "@/lib/waffle";

export const metadata = {
  title: "Where your £100 goes — Inflation Radar (UK)",
  description: "How the UK household basket has changed since 1988, as a £100 waffle.",
};

export default function PoundPage() {
  const data = buildWaffleData();
  return (
    <>
      <section className="page-header">
        <h1>Where your £100 goes</h1>
        <p className="lede">
          Each square is £1 of household spending, split the way ONS weights the CPI basket. Drag back through{" "}
          {data.years[0]}–{data.years[data.years.length - 1]} and watch food shrink while housing and leisure grow.
        </p>
      </section>
      <Waffle data={data} />
      <p className="muted">
        Squares are rounded to whole pounds; the table shows the unrounded ONS weights (per mille of household spending, refreshed each
        January/February).
      </p>
      <EmbedCode path="/pound" height={900} title="Where your £100 goes" />
    </>
  );
}
