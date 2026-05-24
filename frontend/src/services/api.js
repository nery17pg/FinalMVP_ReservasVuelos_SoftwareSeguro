import axios from 'axios';

// Función para leer cookie por nombre (CSRF token)
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // enviar cookies HttpOnly automáticamente
});

// Interceptor: añadir CSRF token en cada request mutante
api.interceptors.request.use((config) => {
  if (!['get', 'head', 'options'].includes(config.method)) {
    const csrf = getCookie('csrf-token');
    if (csrf) config.headers['x-csrf-token'] = csrf;
  }
  return config;
});

// Interceptor: redirigir a login si 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    return Promise.reject(err);
  }
);
/*api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);*/

export default api;
