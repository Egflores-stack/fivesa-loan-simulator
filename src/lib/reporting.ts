import { formatCurrency, formatPercent, type LoanSummary } from "@/lib/loanCalculations";

export const CONTROL_SUMMARY_COLUMNS = ["Concepto", "Valor"] as const;

export type ControlSummaryRow = {
  label: string;
  value: string;
};

export type ControlSummaryParams = {
  amount: number;
  downPayment: number;
  termMonths: number;
  annualRate: number;
  summary: LoanSummary;
};

export const buildControlSummaryRows = ({
  amount,
  downPayment,
  termMonths,
  annualRate,
  summary,
}: ControlSummaryParams): ControlSummaryRow[] => [
  {
    label: "Monto solicitado",
    value: formatCurrency(amount),
  },
  {
    label: "Enganche",
    value: formatCurrency(downPayment),
  },
  {
    label: "Monto a financiar",
    value: formatCurrency(summary.effectiveAmount),
  },
  {
    label: "Plazo",
    value: `${termMonths} meses`,
  },
  {
    label: "Tasa anual",
    value: formatPercent(annualRate),
  },
  {
    label: "Pago mensual",
    value: formatCurrency(summary.monthlyPayment),
  },
  {
    label: "Total de intereses",
    value: formatCurrency(summary.totalInterest),
  },
  {
    label: "Total a pagar",
    value: formatCurrency(summary.totalPayment),
  },
];

const escapeCsvValue = (value: string) =>
  value.includes(",") || value.includes("\n") || value.includes("\"")
    ? `"${value.replaceAll("\"", "\"\"")}"`
    : value;

export const buildReportCsv = ({
  rows,
  amortization,
}: {
  rows: ControlSummaryRow[];
  amortization: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}) => {
  const summaryLines = [
    CONTROL_SUMMARY_COLUMNS.join(","),
    ...rows.map((row) =>
      [row.label, row.value].map(escapeCsvValue).join(",")
    ),
  ];

  const amortizationLines = [
    "",
    "Tabla de amortización",
    ["Mes", "Pago", "Capital", "Interés", "Saldo"].join(","),
    ...amortization.map((row) =>
      [
        row.month.toString(),
        formatCurrency(row.payment),
        formatCurrency(row.principal),
        formatCurrency(row.interest),
        formatCurrency(row.balance),
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ];

  return [...summaryLines, ...amortizationLines].join("\n");
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const buildReportPdfHtml = ({
  rows,
  amortization,
}: {
  rows: ControlSummaryRow[];
  amortization: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}) => {
  const controlRowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td>${row.label}</td>
          <td>${row.value}</td>
        </tr>
      `
    )
    .join("");

  const amortizationRowsHtml = amortization
    .map(
      (row) => `
        <tr>
          <td>${row.month}</td>
          <td>${formatNumber(row.payment)}</td>
          <td>${formatNumber(row.principal)}</td>
          <td>${formatNumber(row.interest)}</td>
          <td>${formatNumber(row.balance)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Reporte de crédito</title>
        <style>
          body {
            font-family: "Inter", Arial, sans-serif;
            color: #111827;
            margin: 24px;
          }
          h1 {
            font-size: 20px;
            margin-bottom: 12px;
          }
          h2 {
            font-size: 16px;
            margin: 24px 0 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 6px 8px;
            text-align: left;
          }
          th {
            background: #f3f4f6;
          }
          .small {
            font-size: 11px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <h1>Reporte de simulación</h1>
        <p class="small">Generado desde el simulador de crédito.</p>

        <h2>Resumen de control</h2>
        <table>
          <thead>
            <tr>
              <th>${CONTROL_SUMMARY_COLUMNS[0]}</th>
              <th>${CONTROL_SUMMARY_COLUMNS[1]}</th>
            </tr>
          </thead>
          <tbody>
            ${controlRowsHtml}
          </tbody>
        </table>

        <h2>Tabla de amortización</h2>
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Pago</th>
              <th>Capital</th>
              <th>Interés</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${amortizationRowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;
};

export const openReportPdf = (html: string) => {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

export const downloadCsv = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
