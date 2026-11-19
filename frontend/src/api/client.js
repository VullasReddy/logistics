/**
 * client.js
 * ---------
 * ONE axios instance used by every page to call the backend.
 *
 *  - Adds "Authorization: Bearer <token>" to every request automatically.
 *  - If the backend answers 401 (token expired / logged out), it clears
 *    the token and sends the user to the login page.
 *  - errorMessage(err) gives a readable message for toasts.
 *
 * Usage:  const { data } = await api.get('/users', { params: { search } });
 */
import axios from 'axios';

const TOKEN_KEY = 'fleet360_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginCall = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginCall) {
      tokenStore.clear();
      if (window.location.pathname !== '/login') window.location.href = '/login?expired=1';
    }
    return Promise.reject(error);
  },
);

/** Readable error text from any failed request. */
export function errorMessage(err) {
  return err?.response?.data?.error?.message || err?.message || 'Something went wrong';
}

/** Field errors from a 400 validation response -> { email: 'Enter a valid email', ... } */
export function fieldErrors(err) {
  const details = err?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d) => [d.field, d.message]));
}

export default api;
