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
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
