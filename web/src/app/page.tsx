import { Chart } from "@/components/Chart";
import { headlineStats } from "@/lib/data";

export default function HomePage() {
  const stats = headlineStats();

  return (
    <>
      <section className="hero">
        <span className="pill">Live data</span>
        <h1>UK inflation, traced to its source</h1>
        <p className="lede">Every number on this site is one click from the official series that produced it.</p>

        <div className="stat-row">
          {stats.map((stat) => (
            <div className="stat-tile" key={stat.name}>
              <div className="stat-label">{stat.name}</div>
              <div className="stat-value">{stat.value.toFixed(1)}%</div>
              <div className="stat-meta">
                {stat.period} &middot; <a href={stat.sourceUrl}>source</a>
                {stat.nextRelease ? ` · next release ${stat.nextRelease}` : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="chart-section">
        <Chart chart="headline" />
      </section>
    </>
  );
}
