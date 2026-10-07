/**
 * Central axios client for the Lifebookz API.
 *
 * Mirrors web/client/src/config/api.js, with the token kept in
 * expo-secure-store (Keychain / Keystore) instead of localStorage.
 */
import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const TOKEN_KEY = "lifebookz.token";

// Point EXPO_PUBLIC_BACKEND_URL at the API. Local dev defaults:
// Android emulator http://10.0.2.2:5000 — iOS simulator http://localhost:5000
// Production base (same as the web client's VITE_BACKEND_URL):
// https://api.lifebookz.com/api/v1
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.lifebookz.com/api/v1";

export const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15000,
});

// Inject the JWT on every request.
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Clear a stale token on 401 (expired/invalid session). The AuthContext's
// `/users/me` probe will then land the user on the sign-in screens.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    return Promise.reject(error);
  },
);

export default api;
