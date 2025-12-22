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
