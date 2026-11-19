import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_URL;
const isLocalApi = !configuredBaseUrl ||
  ['localhost', '127.0.0.1'].includes(new URL(configuredBaseUrl, window.location.origin).hostname);
const localBaseUrls = ['http://localhost:5000/api', 'http://localhost:5001/api', 'http://localhost:5002/api', 'http://localhost:5003/api'];
const defaultBaseUrls = [...new Set([
  configuredBaseUrl,
  ...(isLocalApi ? localBaseUrls : [])
].filter(Boolean))];

let activeBaseUrlIndex = 0;
const api = axios.create({ baseURL: defaultBaseUrls[activeBaseUrlIndex] });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('r2c_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.baseURL = defaultBaseUrls[activeBaseUrlIndex];
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const method = String(error.config?.method || '').toLowerCase();
    const canRetry = ['get', 'head', 'options'].includes(method);
    const isConnectionFailure = !error.response && (
      error.code === 'ERR_NETWORK' ||
      error.message === 'Network Error' ||
      error.message.includes('Failed to fetch')
    );

    if (canRetry && isConnectionFailure && activeBaseUrlIndex < defaultBaseUrls.length - 1) {
      activeBaseUrlIndex += 1;
      api.defaults.baseURL = defaultBaseUrls[activeBaseUrlIndex];
      if (error.config) {
        error.config.baseURL = defaultBaseUrls[activeBaseUrlIndex];
        return api.request(error.config);
      }
    }

    return Promise.reject(error.response?.data || { message: error.message });
  }
);

export default api;
