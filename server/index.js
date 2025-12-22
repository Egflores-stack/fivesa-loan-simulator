import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { query } from "./db.js";
import { authenticateToken, signToken } from "./auth.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || "*",
}));
app.use(express.json());

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: "Email y contraseña requeridos" });
  }

  try {
    const result = await query(
      "SELECT id, email, role, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Error al autenticar" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const result = await query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json({ user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener usuario" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  return res.status(204).send();
});

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatPercent = (value) => `${Number(value).toFixed(2)}%`;

const calculateLoan = ({ amount, downPayment, termMonths, annualRate }) => {
  const effectiveAmount = amount - downPayment;

  if (effectiveAmount <= 0 || termMonths <= 0) {
    return {
      loanAmount: amount,
      monthlyPayment: 0,
      totalPayment: 0,
      totalInterest: 0,
      effectiveAmount: 0,
    };
  }

  const monthlyRate = annualRate / 100 / 12;
  const monthlyPayment =
    monthlyRate === 0
      ? effectiveAmount / termMonths
      : (effectiveAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);

  const totalPayment = monthlyPayment * termMonths + downPayment;
  const totalInterest = totalPayment - amount;

  return {
    loanAmount: amount,
    monthlyPayment,
    totalPayment,
    totalInterest,
    effectiveAmount,
  };
};

const generateAmortizationTable = ({
  amount,
  downPayment,
  termMonths,
  annualRate,
}) => {
  const effectiveAmount = amount - downPayment;

  if (effectiveAmount <= 0 || termMonths <= 0) {
    return [];
  }

  const monthlyRate = annualRate / 100 / 12;
  const summary = calculateLoan({
    amount,
    downPayment,
    termMonths,
    annualRate,
  });
  const table = [];
  let balance = effectiveAmount;

  for (let month = 1; month <= termMonths; month += 1) {
    const interest = balance * monthlyRate;
    const principal = summary.monthlyPayment - interest;
    balance = Math.max(0, balance - principal);

    table.push({
      month,
      payment: summary.monthlyPayment,
      principal,
      interest,
      balance,
    });
  }

  return table;
};

const buildControlSummaryRows = ({
  amount,
  downPayment,
  termMonths,
  annualRate,
  summary,
}) => [
  { label: "Monto solicitado", value: formatCurrency(amount) },
  { label: "Enganche", value: formatCurrency(downPayment) },
  {
    label: "Monto a financiar",
    value: formatCurrency(summary.effectiveAmount),
  },
  { label: "Plazo", value: `${termMonths} meses` },
  { label: "Tasa anual", value: formatPercent(annualRate) },
  { label: "Pago mensual", value: formatCurrency(summary.monthlyPayment) },
  {
    label: "Total de intereses",
    value: formatCurrency(summary.totalInterest),
  },
  { label: "Total a pagar", value: formatCurrency(summary.totalPayment) },
];

const parseReportParams = (req, res) => {
  const { amount, downPayment, termMonths, annualRate } = req.body ?? {};
  const parsed = {
    amount: Number(amount),
    downPayment: Number(downPayment),
    termMonths: Number(termMonths),
    annualRate: Number(annualRate),
  };

  if (
    [parsed.amount, parsed.downPayment, parsed.termMonths, parsed.annualRate].some(
      (value) => Number.isNaN(value)
    )
  ) {
    res.status(400).json({ message: "Parámetros inválidos para el reporte" });
    return null;
  }

  return parsed;
};

app.post("/api/reports/summary", authenticateToken, (req, res) => {
  const params = parseReportParams(req, res);
  if (!params) return;

  const summary = calculateLoan(params);
  const controlRows = buildControlSummaryRows({ ...params, summary });

  res.json({
    summary,
    controlRows,
    columns: ["Concepto", "Valor"],
  });
});

app.post("/api/reports/amortization", authenticateToken, (req, res) => {
  const params = parseReportParams(req, res);
  if (!params) return;

  const amortization = generateAmortizationTable(params);
  res.json({ amortization });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
