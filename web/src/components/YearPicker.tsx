"use client";

import { useRouter } from "next/navigation";
import { useEmbedSearch } from "@/kit/embedSearch";

export function YearPicker({ years, current }: { years: number[]; current?: number }) {
  const router = useRouter();
  const embed = useEmbedSearch();
  return (
    <label className="year-picker">
      I was born in
      <select
        value={current ?? ""}
        onChange={(event) => router.push(`/lifetime/${event.target.value}${embed}`)}
      >
        {current === undefined && (
          <option value="" disabled>
            choose a year
          </option>
        )}
        {[...years].reverse().map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}
