// src/lib/postgresAuth.ts
export interface PostgresUser {
  id: number;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  role: string;
  is_super_admin?: boolean;
  created_at?: string;
}

// Configuracion de la API
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

// Funcion para login
export const loginWithPostgres = async (credentials: {
  username: string;
  password: string;
}): Promise<{ token: string; user: PostgresUser }> => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error en el login' }));
    throw new Error(error.message || 'Error en el login');
  }

  const data = await response.json();
  return { token: data.token, user: data.user };
};

// Funcion para obtener usuario actual
export const getCurrentUser = async (token: string): Promise<PostgresUser> => {
  const response = await fetch(`${API_URL}/auth/profile`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('No autorizado');
  }

  const data = await response.json();
  return data.user;
};

// Funcion para logout (el backend no expone logout, se maneja local)
export const logoutFromPostgres = async (): Promise<void> => {
  return;
};
