const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080';
const SESSION_KEY = 'aurora.session';

export function saveSession(authResponse) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(authResponse));
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getToken() {
  return getSession()?.accessToken || null;
}

async function parseErrorMessage(response, fallback) {
  const body = await response.json().catch(() => null);
  if (body?.details?.length) return body.details.join(' ');
  return body?.message || fallback;
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'E-mail ou senha inválidos. Tente novamente.'));
  }

  return response.json();
}

export async function registerTenant({ companyName, document, planId, adminName, adminEmail, adminPassword }) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/register-tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName, document, planId, adminName, adminEmail, adminPassword })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Não foi possível criar a conta. Tente novamente.'));
  }

  return response.json();
}

export async function fetchCurrentUser(token) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) return null;
  return response.json();
}
