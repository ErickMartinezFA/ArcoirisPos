import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://arcoirispos.onrender.com/api',
});

api.interceptors.request.use((config) => {
  const storedUser = localStorage.getItem("user");
  if (storedUser) {
    try {
      const { token } = JSON.parse(storedUser);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // localStorage corrupto, se ignora
    }
  }
  return config;
});

// Token vencido (24 h) o inválido: se limpia la sesión y se regresa al login,
// en vez de dejar todas las pantallas fallando con errores genéricos.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem("user");
      try { sessionStorage.setItem("sesionExpirada", "1"); } catch { /* sin storage */ }
      if (window.location.hash !== "#/" && window.location.hash !== "") {
        window.location.href = "/#/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
