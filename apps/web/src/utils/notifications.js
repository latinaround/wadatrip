import React from 'react';

/**
 * Sistema de notificaciones adaptado del proyecto Flutter wadatrip_web
 * Manejo de notificaciones push y locales para la aplicación web
 */

export class NotificationService {
  constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'denied';
    this.subscribers = new Set();
  }

  /**
   * Inicializa el servicio de notificaciones
   */
  async init() {
    if (!this.isSupported) {
      console.warn('Las notificaciones no están soportadas en este navegador');
      return false;
    }

    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }

    return this.permission === 'granted';
  }

  /**
   * Muestra una notificación general
   */
  async showNotification(title, options = {}) {
    if (!await this.init()) {
      console.warn('Permisos de notificación no concedidos');
      return null;
    }

    const defaultOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'wadatrip-notification',
      requireInteraction: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      // Auto-cerrar después de 5 segundos si no requiere interacción
      if (!defaultOptions.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('Error al mostrar notificación:', error);
      return null;
    }
  }

  /**
   * Notificación específica para alertas de precios de vuelos
   */
  async showFlightPriceAlert(flightInfo) {
    const { destination, currentPrice, previousPrice, savings } = flightInfo;
    
    const title = `Precio de vuelo actualizado!`;
    const body = `${destination}: $${currentPrice} (antes $${previousPrice}). Ahorra $${savings}!`;
    
    return await this.showNotification(title, {
      body,
      icon: '',
      tag: 'flight-price-alert',
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'Ver detalles' },
        { action: 'dismiss', title: 'Descartar' }
      ]
    });
  }

  /**
   * Notificación para itinerarios guardados
   */
  async showSavedItineraryNotification(itinerary) {
    const title = 'Itinerario guardado';
    const body = `Tu itinerario a ${itinerary.destination} ha sido guardado exitosamente.`;
    
    return await this.showNotification(title, {
      body,
      icon: '',
      tag: 'saved-itinerary'
    });
  }

  /**
   * Notificación de recordatorio de viaje
   */
  async showTripReminder(tripInfo) {
    const { destination, departureDate, daysLeft } = tripInfo;
    
    const title = 'Recordatorio de viaje';
    const body = `Tu viaje a ${destination} es en ${daysLeft} días (${departureDate}).`;
    
    return await this.showNotification(title, {
      body,
      icon: '',
      tag: 'trip-reminder',
      requireInteraction: true
    });
  }

  /**
   * Suscribirse a notificaciones
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notificar a todos los suscriptores
   */
  notifySubscribers(data) {
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error en callback de notificación:', error);
      }
    });
  }

  /**
   * Verificar si las notificaciones están habilitadas
   */
  isEnabled() {
    return this.isSupported && this.permission === 'granted';
  }

  /**
   * Obtener el estado de los permisos
   */
  getPermissionStatus() {
    return this.permission;
  }
}

// Instancia singleton del servicio
export const notificationService = new NotificationService();

// Hook de React para usar notificaciones
export const useNotifications = () => {
  const [permission, setPermission] = React.useState(notificationService.getPermissionStatus());
  const [isSupported] = React.useState(notificationService.isSupported);

  React.useEffect(() => {
    const checkPermission = () => {
      setPermission(notificationService.getPermissionStatus());
    };

    // Verificar permisos periódicamente
    const interval = setInterval(checkPermission, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const requestPermission = async () => {
    const granted = await notificationService.init();
    setPermission(notificationService.getPermissionStatus());
    return granted;
  };

  const showNotification = (title, options) => {
    return notificationService.showNotification(title, options);
  };

  const showFlightAlert = (flightInfo) => {
    return notificationService.showFlightPriceAlert(flightInfo);
  };

  return {
    isSupported,
    permission,
    isEnabled: permission === 'granted',
    requestPermission,
    showNotification,
    showFlightAlert,
    service: notificationService
  };
};

export default notificationService;
