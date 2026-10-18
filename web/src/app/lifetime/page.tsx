import Link from "next/link";
import { YearPicker } from "@/components/YearPicker";
import { FIRST_BIRTH_YEAR, lastBirthYear } from "@/lib/lifetime";

export const metadata = {
  title: "Inflation in your lifetime — Inflation Radar (UK)",
  description: "How much UK prices have risen since you were born.",
};

export default function LifetimePage() {
  const last = lastBirthYear();
  const years = Array.from({ length: last - FIRST_BIRTH_YEAR + 1 }, (_, i) => FIRST_BIRTH_YEAR + i);
  return (
    <>
      <section className="page-header">
        <h1>Inflation in your lifetime</h1>
        <p className="lede">
          Pick your birth year to see how far UK prices have risen since, as a stripe for every month of your life.
          ONS&apos;s CPI series starts in {FIRST_BIRTH_YEAR}, so that is the earliest year available.
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
