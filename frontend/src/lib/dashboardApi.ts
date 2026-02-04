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

// Manejo de errores
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error de conexion' }));
    throw new Error(error.message || 'Error en la solicitud');
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
