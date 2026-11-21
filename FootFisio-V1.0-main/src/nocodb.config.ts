// El navegador solo conoce el Base ID. El token se guarda como secreto en Cloudflare Pages
// y se inyecta mediante functions/api/nocodb/[[path]].ts.
export const NOCODB_URL = '/api/nocodb'
export const NOCODB_BASE_ID = import.meta.env.VITE_NOCODB_BASE_ID || ''
export const NOCODB_API_TOKEN = ''

// IDs de tabla (empiezan con "m"; no son secretos). Se leen de la URL al abrir cada tabla en NocoDB.
export const NOCODB_TABLAS = {
  users: import.meta.env.VITE_TABLA_USUARIOS || '',
  patients: import.meta.env.VITE_TABLA_PACIENTES || '',
  appointments: import.meta.env.VITE_TABLA_CITAS || '',
  payments: import.meta.env.VITE_TABLA_PAGOS || '',
  history: import.meta.env.VITE_TABLA_HISTORIAL || '',
  sequences: import.meta.env.VITE_TABLA_SECUENCIAS || '',
}
