export type SummaryKpis = {
  disbursements: number;
  portfolio: number;
  delinquency: number;
  index: number;
};

export type MonthlySummary = {
  month: string;
  disbursements: number;
  portfolio: number;
  delinquency: number;
  index: number;
};

export type SummaryResponse = {
  kpis: SummaryKpis;
  monthlyTotals: MonthlySummary[];
};

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "/api"
).replace(/\/+$/, "");

export const fetchSummary = async (): Promise<SummaryResponse> => {
  const response = await fetch(`${API_BASE_URL}/summary`);

  if (!response.ok) {
    throw new Error("No se pudo obtener el resumen.");
  }

  return (await response.json()) as SummaryResponse;
};
