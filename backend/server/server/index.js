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
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
