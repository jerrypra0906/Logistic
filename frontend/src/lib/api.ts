import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',
});

// Add token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle token expiration and improve error logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error logging for debugging
    if (typeof window !== 'undefined') {
      const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        console.error('❌ Network Error: Cannot connect to backend API');
        console.error('   API URL:', baseURL);
        console.error('   Make sure backend is running on port 5001');
        console.error('   Test: http://localhost:5001/health');
      } else if (error.response) {
        // Server responded with error status
        const { status, data } = error.response;
        console.error(`❌ API Error [${status}]:`, {
          url: error.config?.url,
          method: error.config?.method,
          message: data?.error?.message || data?.message || 'Unknown error',
          data: data
        });
      } else {
        console.error('❌ Request Error:', error.message);
      }
    }

    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;

