// Configuración integrada del proyecto Wadatrip
// Combina funcionalidades del proyecto React original y las mejoras del proyecto Flutter

const envApiBaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL);

export const AppConfig = {
  // Información básica de la aplicación
  app: {
    name: 'WADATRIP',
    version: '2.0.0',
    description: 'Plataforma integral de viajes con funcionalidades avanzadas',
    author: 'Wadatrip Team'
  },

  // URLs y endpoints
  api: {
    baseUrl: envApiBaseUrl || 'https://api.wadatrip.com',
    timeout: 10000,
    retryAttempts: 3
  },

  // Configuración de notificaciones
  notifications: {
    enabled: true,
    defaultDuration: 5000,
    position: 'top-right',
    maxNotifications: 5,
    sound: {
      enabled: true,
      volume: 0.5
    }
  },

  // Configuración de validación
  validation: {
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      maxLength: 254
    },
    phone: {
      pattern: /^[+]?[1-9]\d{1,14}$/,
      minLength: 10,
      maxLength: 15
    },
    password: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    },
    budget: {
      min: 100,
      max: 50000,
      currency: 'USD'
    },
    age: {
      min: 18,
      max: 120
    }
  },

  // Configuración de búsqueda
  search: {
    debounceDelay: 300,
    maxResults: 50,
    defaultFilters: {
      sortBy: 'price',
      sortOrder: 'asc'
    }
  },

  // Configuración de localización
  localization: {
    defaultLanguage: 'es',
    supportedLanguages: ['es', 'en', 'fr', 'de'],
    dateFormat: 'DD/MM/YYYY',
    currencyFormat: 'USD',
    timezone: 'America/New_York'
  },

  // Configuración de almacenamiento
  storage: {
    prefix: 'wadatrip_',
    encryption: false,
    expiration: {
      userPreferences: 30 * 24 * 60 * 60 * 1000, // 30 días
      searchHistory: 7 * 24 * 60 * 60 * 1000,    // 7 días
      flightAlerts: 90 * 24 * 60 * 60 * 1000     // 90 días
    }
  },

  // Configuración de características
  features: {
    flightAlerts: {
      enabled: true,
      maxAlerts: 10,
      checkInterval: 60000, // 1 minuto
      priceThreshold: 0.1   // 10% cambio de precio
    },
    enhancedSearch: {
      enabled: true,
      aiSuggestions: true,
      voiceSearch: false
    },
    socialSharing: {
      enabled: true,
      platforms: ['whatsapp', 'facebook', 'twitter', 'email']
    },
    analytics: {
      enabled: true,
      trackUserInteractions: true,
      trackPerformance: true
    }
  },

  // Configuración de UI/UX
  ui: {
    theme: {
      default: 'light',
      allowToggle: true
    },
    animations: {
      enabled: true,
      duration: 300,
      easing: 'ease-in-out'
    },
    responsive: {
      breakpoints: {
        mobile: 768,
        tablet: 1024,
        desktop: 1280
      }
    }
  },

  // Configuración de seguridad
  security: {
    csrfProtection: true,
    sanitizeInputs: true,
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 15 * 60 * 1000 // 15 minutos
    }
  }
}

export default AppConfig






