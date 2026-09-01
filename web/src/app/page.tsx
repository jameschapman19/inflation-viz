import { Chart } from "@/components/Chart";
import {
  bankRate,
  formatDelta,
  giltBreakevenInflation,
  hasForecast,
  headlineStats,
  realWageGrowth,
  rpiStat,
} from "@/lib/data";
import { formatPercent } from "@/lib/format";

export default function HomePage() {
  const rpi = rpiStat();
  const stats = rpi ? [...headlineStats(), rpi] : headlineStats();
  const wageGrowth = realWageGrowth();
  const rate = bankRate();
  const breakeven = giltBreakevenInflation();

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
                <span className="stat-value">{formatPercent(stat.value)}</span>
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
                  {formatPercent(wageGrowth.value)}
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

      {(rate || breakeven) && (
        <section>
          <h2>Interest rates &amp; markets</h2>
          <p className="lede">
            The Bank of England&apos;s own lever for bringing inflation back to target, and what
            the bond market itself expects inflation to average over the next decade — a second,
            independent forecast alongside this project&apos;s own.
          </p>
          <div className="stat-row">
            {rate && (
              <div className="stat-tile">
                <div className="stat-label">Bank Rate</div>
                <div className="stat-value-row">
                  <span className="stat-value">{formatPercent(rate.value, 2)}</span>
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
            )}
            {breakeven && (
              <div className={`stat-tile band-${breakeven.band}`}>
                <div className="stat-label">{breakeven.name}</div>
                <div className="stat-value-row">
                  <span className="stat-value">{formatPercent(breakeven.value, 2)}</span>
                  {breakeven.deltaFromPreviousMonth ? (
                    <span className="stat-delta">
                      {formatDelta(breakeven.deltaFromPreviousMonth)} vs last month
                    </span>
                  ) : null}
                </div>
                <div className="stat-meta">
                  {breakeven.period} &middot; <a href={breakeven.sourceUrl}>source</a>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
