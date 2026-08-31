import { Chart } from "@/components/Chart";
import { formatDelta, hasForecast, headlineStats, realWageGrowth } from "@/lib/data";

export default function HomePage() {
  const stats = headlineStats();
  const wageGrowth = realWageGrowth();

  return (
    <>
      <section className="hero">
        <span className="pill">Live data</span>
        <h1>UK inflation, traced to its source</h1>
        <p className="lede">Every number on this site is one click from the official series that produced it.</p>

        <div className="stat-row">
          {stats.map((stat) => (
            <div className={`stat-tile band-${stat.band}`} key={stat.name}>
              <div className="stat-label">{stat.name}</div>
              <div className="stat-value-row">
                <span className="stat-value">{stat.value.toFixed(1)}%</span>
                {stat.deltaFromPreviousMonth !== null && (
                  <span className="stat-delta">{formatDelta(stat.deltaFromPreviousMonth)} vs last month</span>
                )}
              </div>
              <div className="stat-meta">
                {stat.period} &middot; <a href={stat.sourceUrl}>source</a>
                {stat.nextRelease ? ` · next release ${stat.nextRelease}` : null}
              </div>
            </div>
          ))}
          {wageGrowth && (
            <div className={`stat-tile${wageGrowth.band ? ` band-${wageGrowth.band}` : ""}`}>
              <div className="stat-label">Pay vs prices</div>
              <div className="stat-value-row">
                <span className="stat-value">
                  {wageGrowth.value > 0 ? "+" : ""}
                  {wageGrowth.value.toFixed(1)}%
                </span>
                {wageGrowth.deltaFromPreviousMonth !== null && (
                  <span className="stat-delta">
                    {formatDelta(wageGrowth.deltaFromPreviousMonth)} vs last month
                  </span>
                )}
              </div>
              <div className="stat-meta">
                Real regular pay growth, {wageGrowth.period} &middot;{" "}
                <a href={wageGrowth.sourceUrl}>source</a>
              </div>
            </div>
          )}
        </div>
        <p className="muted">
          Colour bands CPI/CPIH against the Bank of England&apos;s 2% target, and pay against zero
          real growth.
        </p>
      </section>

      <section className="chart-section">
        <Chart chart="headline" />
        {hasForecast() && (
          <p className="muted">
            Dashed line: this project&apos;s own short-term projection, not an ONS figure — see{" "}
            <a href="/methodology">Methodology</a>.
          </p>
        )}
      </section>
    </>
  );
}
