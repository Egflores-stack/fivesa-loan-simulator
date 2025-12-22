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

app.get("/api/requests", authenticateToken, async (req, res) => {
  const status = req.query.status || "pending";
  try {
    const result = await query(
      "SELECT * FROM loan_requests WHERE status = $1 ORDER BY created_at DESC",
      [status]
    );
    return res.json({ requests: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Error al cargar solicitudes" });
  }
});

app.post("/api/requests", authenticateToken, async (req, res) => {
  const {
    type,
    currency,
    amount,
    termMonths,
    monthlyRate,
    paymentFrequency,
    commissionType,
    commissionValue,
    previousBalance,
    responsible,
    manager,
    paymentDates,
  } = req.body ?? {};

  if (
    !type ||
    !currency ||
    !amount ||
    !termMonths ||
    !monthlyRate ||
    !paymentFrequency ||
    !commissionType ||
    commissionValue === undefined ||
    !responsible ||
    !manager
  ) {
    return res.status(400).json({ message: "Datos incompletos" });
  }

  try {
    const result = await query(
      `INSERT INTO loan_requests
      (type, currency, amount, term_months, monthly_rate, payment_frequency, commission_type, commission_value, previous_balance, responsible, manager, payment_dates)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        type,
        currency,
        amount,
        termMonths,
        monthlyRate,
        paymentFrequency,
        commissionType,
        commissionValue,
        previousBalance ?? null,
        responsible,
        manager,
        paymentDates ?? null,
      ]
    );
    return res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Error al guardar solicitud" });
  }
});

app.put("/api/requests/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    type,
    currency,
    amount,
    termMonths,
    monthlyRate,
    paymentFrequency,
    commissionType,
    commissionValue,
    previousBalance,
    responsible,
    manager,
    paymentDates,
    status,
  } = req.body ?? {};

  try {
    const result = await query(
      `UPDATE loan_requests
      SET type = $1,
          currency = $2,
          amount = $3,
          term_months = $4,
          monthly_rate = $5,
          payment_frequency = $6,
          commission_type = $7,
          commission_value = $8,
          previous_balance = $9,
          responsible = $10,
          manager = $11,
          payment_dates = $12,
          status = $13
      WHERE id = $14
      RETURNING *`,
      [
        type,
        currency,
        amount,
        termMonths,
        monthlyRate,
        paymentFrequency,
        commissionType,
        commissionValue,
        previousBalance ?? null,
        responsible,
        manager,
        paymentDates ?? null,
        status ?? "pending",
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Solicitud no encontrada" });
    }

    return res.json({ request: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar solicitud" });
  }
});

app.delete("/api/requests/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      "DELETE FROM loan_requests WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Solicitud no encontrada" });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar solicitud" });
  }
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "Administrador") {
    return res.status(403).json({ message: "Acceso restringido" });
  }
  return next();
};

app.get("/api/config/users", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC"
    );
    return res.json({ users: result.rows });
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener usuarios" });
  }
});

app.post("/api/config/users", authenticateToken, requireAdmin, async (req, res) => {
  const { email, role, password } = req.body ?? {};

  if (!email || !role || !password) {
    return res.status(400).json({ message: "Email, rol y contraseña requeridos" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      "INSERT INTO users (email, role, password_hash) VALUES ($1, $2, $3) RETURNING id, email, role, created_at",
      [email, role, passwordHash]
    );
    return res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Error al crear usuario" });
  }
});

app.patch("/api/config/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { email, role, password } = req.body ?? {};

  if (!email && !role && !password) {
    return res.status(400).json({ message: "Debe enviar datos para actualizar" });
  }

  try {
    const updates = [];
    const values = [];
    let index = 1;

    if (email) {
      updates.push(`email = $${index}`);
      values.push(email);
      index += 1;
    }
    if (role) {
      updates.push(`role = $${index}`);
      values.push(role);
      index += 1;
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${index}`);
      values.push(passwordHash);
      index += 1;
    }

    values.push(id);
    const result = await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${index} RETURNING id, email, role, created_at`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json({ user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar usuario" });
  }
});

app.delete("/api/config/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (req.user?.id === id) {
    return res.status(400).json({ message: "No puedes eliminar tu propio usuario" });
  }

  try {
    const result = await query("DELETE FROM users WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar usuario" });
  }
});

app.get("/api/config/parameters", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      "SELECT dias_mora_vencido, cuotas_vencido FROM parameters ORDER BY id LIMIT 1"
    );
    if (result.rowCount === 0) {
      const insertResult = await query(
        "INSERT INTO parameters (id, dias_mora_vencido, cuotas_vencido) VALUES (1, 0, 0) RETURNING dias_mora_vencido, cuotas_vencido"
      );
      return res.json({ parameters: insertResult.rows[0] });
    }
    return res.json({ parameters: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener parámetros" });
  }
});

app.put("/api/config/parameters", authenticateToken, requireAdmin, async (req, res) => {
  const { diasMoraVencido, cuotasVencido } = req.body ?? {};

  if (
    typeof diasMoraVencido !== "number" ||
    typeof cuotasVencido !== "number" ||
    diasMoraVencido < 0 ||
    cuotasVencido < 0
  ) {
    return res.status(400).json({ message: "Parámetros inválidos" });
  }

  try {
    const result = await query(
      `INSERT INTO parameters (id, dias_mora_vencido, cuotas_vencido)
       VALUES (1, $1, $2)
       ON CONFLICT (id)
       DO UPDATE SET dias_mora_vencido = EXCLUDED.dias_mora_vencido,
                     cuotas_vencido = EXCLUDED.cuotas_vencido,
                     updated_at = now()
       RETURNING dias_mora_vencido, cuotas_vencido`,
      [diasMoraVencido, cuotasVencido]
    );
    return res.json({ parameters: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar parámetros" });
  }
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
const summaryData = {
  kpis: {
    disbursements: 18500000,
    portfolio: 96250000,
    delinquency: 3.8,
    index: 1.42,
  },
  monthlyTotals: [
    {
      month: "Enero 2024",
      disbursements: 2800000,
      portfolio: 90500000,
      delinquency: 3.5,
      index: 1.3,
    },
    {
      month: "Febrero 2024",
      disbursements: 3100000,
      portfolio: 91800000,
      delinquency: 3.6,
      index: 1.34,
    },
    {
      month: "Marzo 2024",
      disbursements: 3350000,
      portfolio: 93250000,
      delinquency: 3.7,
      index: 1.38,
    },
    {
      month: "Abril 2024",
      disbursements: 3600000,
      portfolio: 94700000,
      delinquency: 3.9,
      index: 1.4,
    },
    {
      month: "Mayo 2024",
      disbursements: 3650000,
      portfolio: 96250000,
      delinquency: 3.8,
      index: 1.42,
    },
  ],
};

app.get("/api/summary", (_req, res) => {
  return res.json(summaryData);
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
