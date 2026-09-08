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

export default api;
