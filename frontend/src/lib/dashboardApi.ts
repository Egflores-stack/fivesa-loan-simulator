// API para comunicarse con el backend del dashboard
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const AUTH_STORAGE_KEY = 'authToken';

// Obtener token del localStorage
const getToken = () => localStorage.getItem(AUTH_STORAGE_KEY);

// Configurar headers con autenticacion
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

export class ApiRequestError extends Error {
  status;
  code;
  fieldErrors;
  raw;

  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status || 500;
    this.code = options.code || 'INTERNAL_ERROR';
    this.fieldErrors = options.fieldErrors || {};
    this.raw = options.raw || null;
  }
}

// Manejo de errores
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error de conexion' }));
    if (response.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    throw new ApiRequestError(error.message || 'Error en la solicitud', {
      status: response.status,
      code: error.code,
      fieldErrors: error.fieldErrors,
      raw: error,
    });
  }
  return response.json();
};

// Obtener estadisticas del dashboard
export const getDashboardStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error obteniendo estadisticas:', error);
    throw error;
  }
};

// Obtener lista de clientes
export const getClients = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    throw error;
  }
};

export const getClientById = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error obteniendo detalle de cliente:', error);
    throw error;
  }
};

export const checkClientExists = async ({ identificacion, email }) => {
  try {
    const params = new URLSearchParams();
    if (identificacion) params.set('identificacion', identificacion);
    if (email) params.set('email', email);
    const query = params.toString();
    const response = await fetch(
      `${API_BASE_URL}/clients/exists${query ? `?${query}` : ''}`,
      { headers: getAuthHeaders() },
    );
    return await handleResponse(response);
  } catch (error) {
    console.error('Error validando cliente existente:', error);
    throw error;
  }
};

// Obtener lista de prestamos
export const getLoans = async (status = null) => {
  try {
    const url = status 
      ? `${API_BASE_URL}/loans?status=${status}`
      : `${API_BASE_URL}/loans`;
      
    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error obteniendo prestamos:', error);
    throw error;
  }
};

export const getLoanDetails = async (loanId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/loans/${loanId}`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error obteniendo detalle del prestamo:', error);
    throw error;
  }
};

export const registerInstallmentPayment = async (loanId, installmentNumber, paymentData) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/loans/${loanId}/installments/${installmentNumber}/pay`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(paymentData)
      }
    );
    return await handleResponse(response);
  } catch (error) {
    console.error('Error registrando pago de cuota:', error);
    throw error;
  }
};

// Crear nuevo cliente
export const createClient = async (clientData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(clientData)
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creando cliente:', error);
    throw error;
  }
};

// Crear nueva solicitud de prestamo
export const createLoan = async (loanData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/loans`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(loanData)
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creando prestamo:', error);
    throw error;
  }
};

// Aprobar prestamo
export const approveLoan = async (loanId, approvalData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/loans/${loanId}/approve`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(approvalData)
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error aprobando prestamo:', error);
    throw error;
  }
};

// Rechazar prestamo
export const rejectLoan = async (loanId, rejectionData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/loans/${loanId}/reject`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(rejectionData)
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error rechazando prestamo:', error);
    throw error;
  }
};

// Calcular prestamo
export const calculateLoan = async (loanParams) => {
  try {
    const response = await fetch(`${API_BASE_URL}/loans/calculate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(loanParams)
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error calculando prestamo:', error);
    throw error;
  }
};
