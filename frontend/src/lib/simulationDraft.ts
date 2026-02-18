export type AmortizationItem = {
  numeroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  seguroVida: number;
  seguroDanos: number;
  cuotaTotal: number;
  saldoCapital: number;
};

export type SimulationDraft = {
  monto_solicitado: number;
  plazo_meses: number;
  frecuencia: "SEMANAL" | "QUINCENAL" | "MENSUAL";
  tasa_interes: number;
  tipo_credito: string;
  destino: string;
  firstDueDate: string;
  rates: {
    seguroVidaPct: number;
    seguroDanosPct: number;
    comisionPct: number;
  };
  calculation: {
    cuotaReferencial: number;
    totalComision: number;
  };
  amortization: AmortizationItem[];
};

export const SIMULATION_DRAFT_STORAGE_KEY = "credia_simulation_draft";
