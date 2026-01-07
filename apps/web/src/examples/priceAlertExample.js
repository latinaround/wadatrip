/**
 * Ejemplo de uso del sistema de alertas de precios de WadaTrip
 * 
 * Este archivo muestra cómo usar el sistema de monitoreo de precios
 * con presupuesto y tiempo límite usando el algoritmo de Alfred (ML).
 */

import { createFlightPriceAlert, getMonitorStatus, cancelPriceAlert } from '../services/flightPriceMonitor.js';

/**
 * Ejemplo 1: Crear una alerta básica de precio
 */
export const createBasicPriceAlert = () => {
  const alertData = {
    origin: 'Madrid',
    destination: 'Tokio',
    departureDate: '2024-06-15',
    returnDate: '2024-06-25',
    passengers: '2',
    cabinClass: 'economy',
    budget: 800, // Presupuesto máximo en USD
    maxWaitTime: 48, // Máximo 48 horas de espera
    userEmail: 'usuario@ejemplo.com'
  };

  const monitorId = createFlightPriceAlert(alertData);
  console.log(`Alerta creada con ID: ${monitorId}`);
  
  return monitorId;
};

/**
 * Ejemplo 2: Crear una alerta con callbacks personalizados
 */
export const createAdvancedPriceAlert = () => {
  const alertData = {
    origin: 'Barcelona',
    destination: 'Nueva York',
    departureDate: '2024-07-10',
    returnDate: null, // Solo ida
    passengers: '1',
    cabinClass: 'business',
    budget: 1200,
    maxWaitTime: 72, // 3 días
    userEmail: 'viajero@ejemplo.com',
    
    // Callback cuando se encuentra el precio
    onPriceFound: (offer) => {
      console.log('🎉 ¡Precio encontrado!', offer);
      
      // Aquí podrías integrar con otros sistemas:
      // - Enviar notificación push
      // - Actualizar base de datos
      // - Integrar con sistema de reservas
      
      // Ejemplo: Auto-reserva si el precio es muy bueno
      if (offer.price <= 1000) {
        console.log('💰 Precio excelente, considerando auto-reserva...');
        // autoBookFlight(offer);
      }
    },
    
    // Callback cuando se agota el tiempo
    onTimeout: (summary) => {
      console.log('⏰ Tiempo agotado', summary);
      
      // Sugerir alternativas
      if (summary.bestPriceFound) {
        console.log(`Mejor precio encontrado: $${summary.bestPriceFound.price}`);
        console.log('💡 Sugerencia: Considera aumentar tu presupuesto');
      }
    }
  };

  const monitorId = createFlightPriceAlert(alertData);
  console.log(`Alerta avanzada creada con ID: ${monitorId}`);
  
  return monitorId;
};

/**
 * Ejemplo 3: Monitorear múltiples rutas simultáneamente
 */
export const createMultipleAlerts = () => {
  const routes = [
    {
      origin: 'Madrid',
      destination: 'París',
      budget: 200,
      maxWaitTime: 24
    },
    {
      origin: 'Madrid',
      destination: 'Londres',
      budget: 250,
      maxWaitTime: 24
    },
    {
      origin: 'Madrid',
      destination: 'Roma',
      budget: 180,
      maxWaitTime: 24
    }
  ];

  const monitorIds = routes.map((route, index) => {
    const alertData = {
      ...route,
      departureDate: '2024-08-15',
      returnDate: '2024-08-20',
      passengers: '2',
      cabinClass: 'economy',
      userEmail: `viajero${index + 1}@ejemplo.com`,
      
      onPriceFound: (offer) => {
        console.log(`✈️ Oferta encontrada para ${route.origin} → ${route.destination}: $${offer.price}`);
        
        // Cancelar otras alertas si encontramos una buena oferta
        if (offer.price <= route.budget * 0.8) { // 20% por debajo del presupuesto
          console.log('🎯 Oferta excepcional, cancelando otras búsquedas...');
          // cancelOtherAlerts(monitorIds, offer.monitorId);
        }
      }
    };

    return createFlightPriceAlert(alertData);
  });

  console.log(`Creadas ${monitorIds.length} alertas para múltiples destinos`);
  return monitorIds;
};

/**
 * Ejemplo 4: Alerta con configuración de urgencia
 */
export const createUrgentAlert = () => {
  const alertData = {
    origin: 'Madrid',
    destination: 'Miami',
    departureDate: '2024-05-01', // Viaje próximo
    returnDate: '2024-05-10',
    passengers: '4',
    cabinClass: 'economy',
    budget: 2000, // Presupuesto más alto por urgencia
    maxWaitTime: 6, // Solo 6 horas
    userEmail: 'urgente@ejemplo.com',
    
    onPriceFound: (offer) => {
      console.log('🚨 URGENTE: Precio encontrado para viaje próximo');
      console.log(`Precio: $${offer.price} - ¡Reserva inmediatamente!`);
      
      // Notificaciones múltiples para viajes urgentes
      // sendSMSNotification('+34600123456', `Precio encontrado: $${offer.price}`);
      // sendPushNotification('user123', offer);
    },
    
    onTimeout: (summary) => {
      console.log('🚨 ALERTA: No se encontró precio para viaje urgente');
      console.log('Recomendación: Contactar agente de viajes inmediatamente');
    }
  };

  const monitorId = createFlightPriceAlert(alertData);
  console.log(`Alerta urgente creada con ID: ${monitorId}`);
  
  return monitorId;
};

/**
 * Ejemplo 5: Función para gestionar alertas existentes
 */
export const manageExistingAlerts = (monitorIds) => {
  console.log('📊 Gestionando alertas existentes...');
  
  monitorIds.forEach(async (monitorId) => {
    const status = getMonitorStatus(monitorId);
    
    if (status) {
      console.log(`Monitor ${monitorId}:`);
      console.log(`  Estado: ${status.status}`);
      console.log(`  Verificaciones: ${status.checkCount}`);
      console.log(`  Tiempo restante: ${Math.round(status.timeRemaining / (1000 * 60))} minutos`);
      
      if (status.bestPriceFound) {
        console.log(`  Mejor precio: $${status.bestPriceFound.price}`);
      }
      
      // Cancelar alertas que han encontrado precios cercanos al presupuesto
      if (status.bestPriceFound && 
          status.bestPriceFound.price <= status.targetBudget * 1.1) {
        console.log(`💡 Precio cercano al presupuesto, considerando cancelar...`);
        // const cancelled = cancelPriceAlert(monitorId);
        // if (cancelled) console.log(`✅ Alerta ${monitorId} cancelada`);
      }
    }
  });
};

/**
 * Ejemplo 6: Demostración completa del flujo
 */
export const demonstrateFullWorkflow = async () => {
  console.log('🚀 Iniciando demostración completa del sistema de alertas...');
  
  // Paso 1: Crear alertas
  console.log('\n1️⃣ Creando alertas de precio...');
  const basicAlert = createBasicPriceAlert();
  const advancedAlert = createAdvancedPriceAlert();
  const multipleAlerts = createMultipleAlerts();
  const urgentAlert = createUrgentAlert();
  
  const allAlerts = [basicAlert, advancedAlert, ...multipleAlerts, urgentAlert];
  
  // Paso 2: Esperar un poco y verificar estado
  console.log('\n2️⃣ Esperando 30 segundos para verificar estado...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Paso 3: Gestionar alertas
  console.log('\n3️⃣ Verificando estado de alertas...');
  manageExistingAlerts(allAlerts);
  
  // Paso 4: Simular cancelación de algunas alertas
  console.log('\n4️⃣ Cancelando algunas alertas como ejemplo...');
  const cancelled = cancelPriceAlert(basicAlert);
  if (cancelled) {
    console.log(`✅ Alerta básica ${basicAlert} cancelada exitosamente`);
  }
  
  console.log('\n✨ Demostración completada. El sistema seguirá monitoreando las alertas activas.');
};

/**
 * Configuraciones de ejemplo para diferentes tipos de viajeros
 */
export const TRAVELER_PROFILES = {
  budget: {
    name: 'Viajero Económico',
    maxBudget: 300,
    maxWaitTime: 168, // 1 semana
    cabinClass: 'economy',
    flexibility: 'high'
  },
  
  business: {
    name: 'Viajero de Negocios',
    maxBudget: 1500,
    maxWaitTime: 24, // 1 día
    cabinClass: 'business',
    flexibility: 'low'
  },
  
  luxury: {
    name: 'Viajero de Lujo',
    maxBudget: 5000,
    maxWaitTime: 72, // 3 días
    cabinClass: 'first',
    flexibility: 'medium'
  },
  
  family: {
    name: 'Familia',
    maxBudget: 2000,
    maxWaitTime: 120, // 5 días
    cabinClass: 'economy',
    flexibility: 'high'
  }
};

/**
 * Crear alerta basada en perfil de viajero
 */
export const createAlertByProfile = (profileType, travelData) => {
  const profile = TRAVELER_PROFILES[profileType];
  
  if (!profile) {
    throw new Error(`Perfil de viajero '${profileType}' no encontrado`);
  }
  
  const alertData = {
    ...travelData,
    budget: profile.maxBudget,
    maxWaitTime: profile.maxWaitTime,
    cabinClass: profile.cabinClass,
    
    onPriceFound: (offer) => {
      console.log(`🎯 ${profile.name}: Precio encontrado $${offer.price}`);
    },
    
    onTimeout: (summary) => {
      console.log(`⏰ ${profile.name}: Tiempo agotado`);
      
      if (profile.flexibility === 'high') {
        console.log('💡 Sugerencia: Considera fechas alternativas');
      } else if (profile.flexibility === 'low') {
        console.log('💡 Sugerencia: Aumenta el presupuesto');
      }
    }
  };
  
  return createFlightPriceAlert(alertData);
};

// Exportar todo para uso en la aplicación
export default {
  createBasicPriceAlert,
  createAdvancedPriceAlert,
  createMultipleAlerts,
  createUrgentAlert,
  manageExistingAlerts,
  demonstrateFullWorkflow,
  createAlertByProfile,
  TRAVELER_PROFILES
};