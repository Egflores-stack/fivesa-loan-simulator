import type { CommissionType, PaymentFrequency } from "@/lib/loanCalculations";

export type LoanRequest = {
  id: string;
  type: "Nueva" | "Refinanciamiento";
  currency: "NIO" | "USD";
  amount: number;
  termMonths: number;
  monthlyRate: number;
  paymentFrequency: PaymentFrequency;
  commissionType: CommissionType;
  commissionValue: number;
  previousBalance?: number | null;
  responsible: string;
  manager: string;
  paymentDates?: string | null;
  status: string;
  requestDate: string;
};

type RequestPayload = Omit<
  LoanRequest,
  "id" | "status" | "requestDate"
> & {
  status?: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const buildHeaders = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const normalizeRequest = (payload: any): LoanRequest => ({
  id: payload.id,
  type: payload.type,
  currency: payload.currency,
  amount: Number(payload.amount),
  termMonths: Number(payload.term_months ?? payload.termMonths),
  monthlyRate: Number(payload.monthly_rate ?? payload.monthlyRate),
  paymentFrequency: payload.payment_frequency ?? payload.paymentFrequency,
  commissionType: payload.commission_type ?? payload.commissionType,
  commissionValue: Number(payload.commission_value ?? payload.commissionValue),
  previousBalance: payload.previous_balance ?? payload.previousBalance ?? null,
  responsible: payload.responsible,
  manager: payload.manager,
  paymentDates: payload.payment_dates ?? payload.paymentDates ?? null,
  status: payload.status,
  requestDate: payload.request_date ?? payload.requestDate,
});

export const fetchLoanRequests = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/requests?status=pending`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("No se pudieron cargar las solicitudes.");
  }

  const data = (await response.json()) as { requests: any[] };
  return data.requests.map(normalizeRequest);
};

export const createLoanRequest = async (token: string, payload: RequestPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/requests`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || "No se pudo guardar la solicitud.");
  }

  const data = (await response.json()) as { request: any };
  return normalizeRequest(data.request);
};

export const updateLoanRequest = async (
  token: string,
  id: string,
  payload: RequestPayload
) => {
  const response = await fetch(`${API_BASE_URL}/api/requests/${id}`, {
    method: "PUT",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || "No se pudo actualizar la solicitud.");
  }

  const data = (await response.json()) as { request: any };
  return normalizeRequest(data.request);
};

export const deleteLoanRequest = async (token: string, id: string) => {
  const response = await fetch(`${API_BASE_URL}/api/requests/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("No se pudo eliminar la solicitud.");
  }
};
