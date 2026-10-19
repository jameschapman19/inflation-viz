'use client';
import { useRouter } from 'next/navigation';
import { useEmbedSearch } from '@/kit/embedSearch';

export default function BirthPicker({ crop, years, current }: { crop: string; years: number[]; current?: number }) {
  const router = useRouter();
  const embed = useEmbedSearch();
  return (
    <label className="birth-picker">
      I was born in
      <div className="select-wrap">
        <select value={current ?? ''} onChange={e => router.push(`/born/${crop}/${e.target.value}${embed}`)}>
          {current === undefined && <option value="" disabled>choose a year</option>}
          {[...years].reverse().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </label>
  );
}
