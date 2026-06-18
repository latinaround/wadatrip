import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './i18n'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const preloadReloadKey = 'wadatrip:vite-preload-reload';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const lastReloadAt = Number(window.sessionStorage.getItem(preloadReloadKey) || '0');
    const now = Date.now();

    if (now - lastReloadAt < 10000) {
      window.sessionStorage.removeItem(preloadReloadKey);
      return;
    }

    window.sessionStorage.setItem(preloadReloadKey, String(now));
    window.location.reload();
  });
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

