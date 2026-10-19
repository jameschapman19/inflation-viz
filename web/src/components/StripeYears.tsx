/** Year tick labels under a strip, positioned by month index. Only Januaries
 * whose year is a multiple of `every` are labelled. */
export function StripeYears({ dates, every }: { dates: string[]; every: number }) {
  return (
    <div className="stripe-years" aria-hidden="true">
      {dates.map((ds, i) =>
        ds.slice(5, 7) === "01" && Number(ds.slice(0, 4)) % every === 0 ? (
          <span key={ds} style={{ left: `${((i + 0.5) / dates.length) * 100}%` }}>
            {ds.slice(0, 4)}
          </span>
        ) : null,
      )}
    </div>
  );
}
