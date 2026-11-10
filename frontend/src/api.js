const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export function getToken() { return localStorage.getItem('hesabu_token'); }
export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem('hesabu_token');
    localStorage.removeItem('hesabu_user');
  }
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data?.error?.message || 'Request failed');
  return data;
}
export function money(minor, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(minor || 0) / 100);
}
