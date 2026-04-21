import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof document != 'undefined') {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length == 2) return parts.pop()?.split(';').shift();
    };

    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }
  return config;
});

// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     const errorData = error.response?.data;
//     let message = 'Ошибка соединения. Попробуйте позже.';
    
//     if (errorData?.message) {
//       message = String(errorData.message);
//     } else if (errorData?.detail) {
//       message = String(errorData.detail);
//     } else if (typeof errorData === 'object') {
//       message = Object.values(errorData).flat().join(', ');
//     }
    
//     // toast.error(message);
//     return Promise.reject(error);
//   }
// );

export default api;