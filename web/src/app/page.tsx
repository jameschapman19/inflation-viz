import { Chart } from "@/components/Chart";
import {
  bankRate,
  formatDelta,
  hasForecast,
  headlineStats,
  realWageGrowth,
  rpiStat,
} from "@/lib/data";

export default function HomePage() {
  const rpi = rpiStat();
  const stats = rpi ? [...headlineStats(), rpi] : headlineStats();
  const wageGrowth = realWageGrowth();
  const rate = bankRate();

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
          Colour bands each 12-month rate against the Bank of England&apos;s 2% target, and pay
          against zero real growth.
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

      {rate && (
        <section>
          <h2>Bank Rate</h2>
          <p className="lede">
            The Bank of England&apos;s own policy rate — its lever for bringing inflation back to
            target. Shown without a colour band: unlike a 12-month rate, a policy rate has no
            target of its own to be near or far from.
          </p>
          <div className="stat-row">
            <div className="stat-tile">
              <div className="stat-label">Bank Rate</div>
              <div className="stat-value-row">
                <span className="stat-value">{rate.value.toFixed(2)}%</span>
                {rate.deltaFromPreviousMonth ? (
                  <span className="stat-delta">
                    {formatDelta(rate.deltaFromPreviousMonth)} vs last month
                  </span>
                ) : null}
              </div>
              <div className="stat-meta">
                {rate.period} &middot; <a href={rate.sourceUrl}>source</a>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
