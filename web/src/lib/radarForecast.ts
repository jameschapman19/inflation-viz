// Generated from radar-contracts v0.1.0. Sync with the coordinated release tool.
export interface ForecastBand { level: number; lo: number; hi: number; }
export interface ForecastPoint {
  unique_id: string; ds: string; yhat: number;
  lo: number | null; hi: number | null; bands: ForecastBand[] | null;
}
export interface ForecastExport {
  schemaVersion: 2; generatedAt: string | null; dataVintage: string | null;
  forecastOrigin: string | null; horizonMonths: number; level: number | null;
  coverage: { included: string[]; missing: string[] };
  totalUniqueId: string | null; points: ForecastPoint[];
  runId?: string; status?: 'experimental' | 'validated';
  evaluationBasis?: 'revised_history' | 'release_vintages';
  series?: Record<string, { unit: string; intervalStatus: 'experimental' | 'undercovered_in_recent_evaluation' }>;
}
