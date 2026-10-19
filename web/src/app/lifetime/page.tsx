import Link from "next/link";
import { YearPicker } from "@/components/YearPicker";
import { birthYears } from "@/lib/lifetime";

export const metadata = {
  title: "Inflation in your lifetime — Inflation Radar (UK)",
  description: "How much UK prices have risen since you were born.",
};

export default function LifetimePage() {
  const years = birthYears();
  return (
    <>
      <section className="page-header">
        <h1>Inflation in your lifetime</h1>
        <p className="lede">
          Pick your birth year to see how far UK prices have risen since, as a stripe for every month of your life.
          ONS&apos;s CPI series starts in 1989, so for earlier birth years this uses RPI, the headline measure of its day, which ran higher.
        </p>
      </section>
      <YearPicker years={years} />
      <ul className="year-grid">
        {years.map((year) => (
          <li key={year}>
            <Link href={`/lifetime/${year}`}>{year}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
