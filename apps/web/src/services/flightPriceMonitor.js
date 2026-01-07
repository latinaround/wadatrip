/**
 * Flight Price Monitor Service
 * 
 * Este servicio implementa un sistema de monitoreo continuo de precios de vuelos
 * con presupuesto y notificaciones automáticas usando el algoritmo de Alfred.
 */

import { predictFlightPriceML } from './mlFlightPredictor.js';
import { notificationService } from './notificationService.js';

/**
 * Clase para manejar el monitoreo de precios de vuelos
 */
class FlightPriceMonitor {
  constructor() {
    this.activeMonitors = new Map(); // Almacena los monitores activos
    this.monitorId = 0; // ID único para cada monitor
  }

  /**
   * Crea un nuevo monitor de precios
   * @param {Object} monitorData - Datos del monitor
   * @param {string} monitorData.origin - Ciudad de origen
   * @param {string} monitorData.destination - Ciudad de destino
   * @param {string} monitorData.departureDate - Fecha de salida
   * @param {number} monitorData.budget - Presupuesto máximo en USD
   * @param {number} monitorData.maxWaitTime - Tiempo máximo de espera en horas
   * @param {string} monitorData.userEmail - Email del usuario para notificaciones
   * @param {Function} monitorData.onPriceFound - Callback cuando se encuentra el precio
   * @param {Function} monitorData.onTimeout - Callback cuando se agota el tiempo
   * @returns {string} ID del monitor creado
   */
  createPriceMonitor(monitorData) {
    const monitorId = `monitor_${++this.monitorId}_${Date.now()}`;
    
    const monitor = {
      id: monitorId,
      ...monitorData,
      createdAt: new Date(),
      lastCheck: null,
      checkCount: 0,
      bestPriceFound: null,
      status: 'active', // active, completed, timeout, cancelled
      interval: null
    };

    this.activeMonitors.set(monitorId, monitor);
    this.startMonitoring(monitorId);
    
    // Enviar notificación de alerta creada
    this.sendAlertCreatedNotification(monitor);
    
    return monitorId;
  }

  /**
   * Inicia el monitoreo para un ID específico
   * @param {string} monitorId - ID del monitor
   */
  startMonitoring(monitorId) {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor) return;

    // Configurar timeout para el tiempo máximo de espera
    const timeoutMs = monitor.maxWaitTime * 60 * 60 * 1000; // Convertir horas a ms
    const timeoutId = setTimeout(() => {
      this.handleTimeout(monitorId);
    }, timeoutMs);

    monitor.timeoutId = timeoutId;

    // Iniciar verificaciones periódicas (cada 30 minutos)
    const checkInterval = 30 * 60 * 1000; // 30 minutos en ms
    const intervalId = setInterval(() => {
      this.checkPrice(monitorId);
    }, checkInterval);

    monitor.interval = intervalId;

    // Realizar primera verificación inmediatamente
    this.checkPrice(monitorId);
  }

  /**
   * Verifica el precio actual para un monitor
   * @param {string} monitorId - ID del monitor
   */
  async checkPrice(monitorId) {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor || monitor.status !== 'active') return;

    try {
      monitor.checkCount++;
      monitor.lastCheck = new Date();

      // Usar el algoritmo de Alfred (ML) para obtener el precio
      const priceData = await predictFlightPriceML({
        origin: monitor.origin,
        destination: monitor.destination,
        departureDate: monitor.departureDate,
        returnDate: monitor.returnDate,
        passengers: monitor.passengers,
        cabinClass: monitor.cabinClass
      });

      const currentPrice = priceData.predictedPrice;
      
      // Actualizar el mejor precio encontrado
      if (!monitor.bestPriceFound || currentPrice < monitor.bestPriceFound.price) {
        monitor.bestPriceFound = {
          price: currentPrice,
          foundAt: new Date(),
          priceData: priceData
        };
      }

      console.log(`Monitor ${monitorId}: Precio actual $${currentPrice}, Presupuesto $${monitor.budget}`);

      // Verificar si el precio está dentro del presupuesto
      if (currentPrice <= monitor.budget) {
        this.handlePriceFound(monitorId, priceData);
      }

    } catch (error) {
      console.error(`Error checking price for monitor ${monitorId}:`, error);
    }
  }

  /**
   * Maneja cuando se encuentra un precio dentro del presupuesto
   * @param {string} monitorId - ID del monitor
   * @param {Object} priceData - Datos del precio encontrado
   */
  handlePriceFound(monitorId, priceData) {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor) return;

    monitor.status = 'completed';
    this.stopMonitoring(monitorId);

    // Crear datos de la oferta encontrada
    const offer = {
      monitorId,
      price: priceData.predictedPrice,
      foundAt: new Date(),
      flightData: {
        origin: monitor.origin,
        destination: monitor.destination,
        departureDate: monitor.departureDate,
        returnDate: monitor.returnDate,
        passengers: monitor.passengers,
        cabinClass: monitor.cabinClass
      },
      priceData,
      purchaseUrl: this.generatePurchaseUrl(monitor, priceData)
    };

    // Enviar notificación
    this.sendNotification(monitor, offer);

    // Ejecutar callback si existe
    if (monitor.onPriceFound) {
      monitor.onPriceFound(offer);
    }
  }

  /**
   * Maneja cuando se agota el tiempo de espera
   * @param {string} monitorId - ID del monitor
   */
  handleTimeout(monitorId) {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor) return;

    monitor.status = 'timeout';
    this.stopMonitoring(monitorId);

    // Crear resumen del monitoreo
    const summary = {
      monitorId,
      status: 'timeout',
      duration: new Date() - monitor.createdAt,
      checksPerformed: monitor.checkCount,
      bestPriceFound: monitor.bestPriceFound,
      targetBudget: monitor.budget
    };

    // Enviar notificación de timeout
    this.sendTimeoutNotification(monitor, summary);

    // Ejecutar callback si existe
    if (monitor.onTimeout) {
      monitor.onTimeout(summary);
    }
  }

  /**
   * Detiene el monitoreo para un ID específico
   * @param {string} monitorId - ID del monitor
   */
  stopMonitoring(monitorId) {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor) return;

    if (monitor.interval) {
      clearInterval(monitor.interval);
    }
    if (monitor.timeoutId) {
      clearTimeout(monitor.timeoutId);
    }
  }

  /**
   * Cancela un monitor activo
   * @param {string} monitorId - ID del monitor
   */
  cancelMonitor(monitorId) {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor) return false;

    monitor.status = 'cancelled';
    this.stopMonitoring(monitorId);
    return true;
  }

  /**
   * Obtiene el estado de un monitor
   * @param {string} monitorId - ID del monitor
   * @returns {Object|null} Estado del monitor
   */
  getMonitorStatus(monitorId) {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor) return null;

    return {
      id: monitor.id,
      status: monitor.status,
      createdAt: monitor.createdAt,
      lastCheck: monitor.lastCheck,
      checkCount: monitor.checkCount,
      bestPriceFound: monitor.bestPriceFound,
      targetBudget: monitor.budget,
      timeRemaining: this.getTimeRemaining(monitor)
    };
  }

  /**
   * Obtiene el tiempo restante para un monitor
   * @param {Object} monitor - Objeto del monitor
   * @returns {number} Tiempo restante en ms
   */
  getTimeRemaining(monitor) {
    if (monitor.status !== 'active') return 0;
    
    const maxWaitMs = monitor.maxWaitTime * 60 * 60 * 1000;
    const elapsed = new Date() - monitor.createdAt;
    return Math.max(0, maxWaitMs - elapsed);
  }

  /**
   * Obtiene todos los monitores activos
   * @returns {Array} Lista de monitores activos
   */
  getActiveMonitors() {
    return Array.from(this.activeMonitors.values())
      .filter(monitor => monitor.status === 'active')
      .map(monitor => this.getMonitorStatus(monitor.id));
  }

  /**
   * Envía notificación cuando se encuentra un precio
   * @param {Object} monitor - Objeto del monitor
   * @param {Object} offer - Datos de la oferta
   */
  async sendNotification(monitor, offer) {
    console.log(`🎉 ¡Precio encontrado para ${monitor.userEmail}!`);
    console.log(`Vuelo: ${monitor.origin} → ${monitor.destination}`);
    console.log(`Precio: $${offer.price} (Presupuesto: $${monitor.budget})`);
    console.log(`Enlace de compra: ${offer.purchaseUrl}`);
    
    // Enviar notificación por email usando el servicio de notificaciones
    try {
      const emailSent = await notificationService.sendPriceFoundNotification(
        monitor.userEmail, 
        {
          ...offer,
          targetBudget: monitor.budget
        }
      );
      
      if (emailSent) {
        console.log('✅ Email de precio encontrado enviado exitosamente');
      } else {
        console.error('❌ Error enviando email de precio encontrado');
      }
    } catch (error) {
      console.error('Error sending price found notification:', error);
    }
  }

  /**
   * Envía notificación de timeout
   * @param {Object} monitor - Objeto del monitor
   * @param {Object} summary - Resumen del monitoreo
   */
  async sendTimeoutNotification(monitor, summary) {
    console.log(`⏰ Tiempo agotado para monitor ${monitor.id}`);
    console.log(`Mejor precio encontrado: $${summary.bestPriceFound?.price || 'N/A'}`);
    
    // Enviar notificación por email usando el servicio de notificaciones
    try {
      const emailSent = await notificationService.sendTimeoutNotification(
        monitor.userEmail, 
        summary
      );
      
      if (emailSent) {
        console.log('✅ Email de timeout enviado exitosamente');
      } else {
        console.error('❌ Error enviando email de timeout');
      }
    } catch (error) {
      console.error('Error sending timeout notification:', error);
    }
  }

  /**
   * Envía notificación de alerta creada
   * @param {Object} monitor - Objeto del monitor
   */
  async sendAlertCreatedNotification(monitor) {
    try {
      const emailSent = await notificationService.sendAlertCreatedNotification(
        monitor.userEmail,
        {
          monitorId: monitor.id,
          origin: monitor.origin,
          destination: monitor.destination,
          departureDate: monitor.departureDate,
          returnDate: monitor.returnDate,
          budget: monitor.budget,
          maxWaitTime: monitor.maxWaitTime
        }
      );
      
      if (emailSent) {
        console.log('✅ Email de alerta creada enviado exitosamente');
      } else {
        console.error('❌ Error enviando email de alerta creada');
      }
    } catch (error) {
      console.error('Error sending alert created notification:', error);
    }
  }

  /**
   * Genera URL de compra para la oferta encontrada
   * @param {Object} monitor - Objeto del monitor
   * @param {Object} priceData - Datos del precio
   * @returns {string} URL de compra
   */
  generatePurchaseUrl(monitor, priceData) {
    // En un entorno real, esto generaría una URL real de compra
    // con parámetros de afiliado, etc.
    const params = new URLSearchParams({
      origin: monitor.origin,
      destination: monitor.destination,
      departure: monitor.departureDate,
      return: monitor.returnDate || '',
      passengers: monitor.passengers,
      class: monitor.cabinClass,
      price: priceData.predictedPrice
    });
    
    return `https://wadatrip.com/book?${params.toString()}`;
  }
}

// Instancia global del monitor
export const flightPriceMonitor = new FlightPriceMonitor();

/**
 * Función de conveniencia para crear un monitor de precios
 * @param {Object} monitorData - Datos del monitor
 * @returns {string} ID del monitor creado
 */
export const createFlightPriceAlert = (monitorData) => {
  return flightPriceMonitor.createPriceMonitor(monitorData);
};

/**
 * Función de conveniencia para obtener el estado de un monitor
 * @param {string} monitorId - ID del monitor
 * @returns {Object|null} Estado del monitor
 */
export const getMonitorStatus = (monitorId) => {
  return flightPriceMonitor.getMonitorStatus(monitorId);
};

/**
 * Función de conveniencia para cancelar un monitor
 * @param {string} monitorId - ID del monitor
 * @returns {boolean} True si se canceló exitosamente
 */
export const cancelPriceAlert = (monitorId) => {
  return flightPriceMonitor.cancelMonitor(monitorId);
};

/**
 * Función de conveniencia para obtener todos los monitores activos
 * @returns {Array} Lista de monitores activos
 */
export const getActiveMonitors = () => {
  return flightPriceMonitor.getActiveMonitors();
};