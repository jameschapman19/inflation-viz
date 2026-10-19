import { FoodLink } from "@/components/FoodLink";
import { EmbedCode } from "@/kit/EmbedCode";
import { productUrl } from "@/kit/products";
import { buildFoodData } from "@/lib/food";

export const metadata = {
  title: "From wheat to bread — Inflation Radar (UK)",
  description: "How closely UK food inflation follows world crop prices, and how unstable the lag is.",
};

export default function FoodPage() {
  const data = buildFoodData();
  const bread = data.pairs[0];
  const [all, early, late] = bread.windows;
  const fmt = (w: typeof all) => (w.best ? `${w.best.lag} months (r = ${w.best.r.toFixed(2)})` : "no clear lead");
  // The wording follows the numbers: this page is rebuilt whenever either data set refreshes.
  const gap = early.best && late.best ? Math.abs(early.best.lag - late.best.lag) : null;
  const steady = gap !== null && gap < 3;

  return (
    <>
      <section className="page-header">
        <h1>From wheat to bread</h1>
        <p className="lede">
          Over {all.label}, UK {bread.cpiName.toLowerCase()} inflation follows the world wheat price most closely when the price leads by{" "}
          <b>{fmt(all)}</b>.{" "}
          {steady ? "The lead was similar in both halves of the period" : "The lead is not a constant"}: it was <b>{fmt(early)}</b> in {early.label} and{" "}
          <b>{fmt(late)}</b> in {late.label}. Slide the lead to see how the two curves line up.
        </p>
      </section>

      <FoodLink data={data} />

      <section>
        <h2>Strongest lead, by period</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pair</th>
                {bread.windows.map((w) => (
                  <th key={w.key}>{w.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.pairs.map((pair) => (
                <tr key={pair.id}>
                  <td>{pair.label}</td>
                  {pair.windows.map((w) => (
                    <td key={w.key}>{w.best ? `${w.best.lag} months · r = ${w.best.r.toFixed(2)}` : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>How to read this</h2>
        <p className="muted">
          Both lines are 12-month changes, so they share one axis and neighbouring months overlap heavily: a high correlation shows the curves move together, not
          that there are many independent observations behind it. The best lead is the one that maximises the correlation among {data.pairs[0].windows[0].profile.length}{" "}
          candidates, which flatters it; the table shows how it differs between the two halves of the sample. The dashed section
          past the latest published month is what the past link would imply if it held; it is an illustration, not a forecast. Wheat is one input to the price of bread
          beside labour, energy, packaging and retail margins, and a US-dollar export price reaches UK shops through the exchange rate.
        </p>
        <p className="muted">
          Sources: ONS CPI — <a href={bread.cpiSource.source_url}>{bread.cpiSource.cdid}</a> (and the bread-and-cereals and rice series linked from the{" "}
          <a href="/methodology">methodology</a>); crop prices — <a href={data.sourceUrl}>{data.source}</a>, benchmark: {bread.benchmark}, vintage {data.vintage}. See the
          crops themselves in <a href={productUrl("agriculture", "/wheat")}>Agriculture Radar</a>.
        </p>
      </section>
      <EmbedCode path="/food" height={1100} title="From wheat to bread" />
    </>
  );
}
