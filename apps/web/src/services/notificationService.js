/**
 * Notification Service
 * 
 * Servicio para manejar notificaciones por email, push notifications,
 * y otras formas de comunicación con los usuarios.
 */

/**
 * Configuración del servicio de notificaciones
 */
const NOTIFICATION_CONFIG = {
  email: {
    enabled: true,
    provider: 'mock', // En producción sería 'sendgrid', 'ses', etc.
    fromEmail: 'alerts@wadatrip.com',
    fromName: 'WadaTrip Alerts'
  },
  push: {
    enabled: false, // Para futuras implementaciones
    provider: 'firebase'
  },
  sms: {
    enabled: false, // Para futuras implementaciones
    provider: 'twilio'
  }
};

/**
 * Plantillas de email para diferentes tipos de notificaciones
 */
const EMAIL_TEMPLATES = {
  price_found: {
    subject: '✈️ ¡Precio de vuelo encontrado dentro de tu presupuesto!',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Precio Encontrado - WadaTrip</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .flight-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0d9488; }
          .price-highlight { font-size: 2em; color: #059669; font-weight: bold; text-align: center; margin: 20px 0; }
          .cta-button { display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Precio Encontrado!</h1>
            <p>Hemos encontrado un vuelo dentro de tu presupuesto</p>
          </div>
          <div class="content">
            <div class="flight-info">
              <h2>Detalles del Vuelo</h2>
              <p><strong>Ruta:</strong> ${data.flightData.origin} ✈️ ${data.flightData.destination}</p>
              <p><strong>Fecha de salida:</strong> ${new Date(data.flightData.departureDate).toLocaleDateString()}</p>
              ${data.flightData.returnDate ? `<p><strong>Fecha de regreso:</strong> ${new Date(data.flightData.returnDate).toLocaleDateString()}</p>` : ''}
              <p><strong>Pasajeros:</strong> ${data.flightData.passengers}</p>
              <p><strong>Clase:</strong> ${data.flightData.cabinClass}</p>
            </div>
            
            <div class="price-highlight">
              $${data.price} USD
            </div>
            
            <p>¡Excelente noticia! Hemos encontrado un vuelo que se ajusta a tu presupuesto de $${data.targetBudget} USD.</p>
            
            <div style="text-align: center;">
              <a href="${data.purchaseUrl}" class="cta-button">Comprar Ahora</a>
            </div>
            
            <p><strong>Importante:</strong> Los precios de vuelos pueden cambiar rápidamente. Te recomendamos completar tu compra lo antes posible.</p>
            
            <div class="footer">
              <p>Este email fue enviado por el sistema de alertas de WadaTrip.</p>
              <p>Si no deseas recibir más alertas, puedes cancelarlas desde tu panel de control.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },
  
  timeout: {
    subject: '⏰ Monitoreo de precio de vuelo finalizado',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monitoreo Finalizado - WadaTrip</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .summary-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Monitoreo Finalizado</h1>
            <p>Tu alerta de precio ha llegado al tiempo límite</p>
          </div>
          <div class="content">
            <div class="summary-box">
              <h2>Resumen del Monitoreo</h2>
              <p><strong>Duración:</strong> ${Math.round(data.duration / (1000 * 60 * 60))} horas</p>
              <p><strong>Verificaciones realizadas:</strong> ${data.checksPerformed}</p>
              <p><strong>Presupuesto objetivo:</strong> $${data.targetBudget} USD</p>
              ${data.bestPriceFound ? `<p><strong>Mejor precio encontrado:</strong> $${data.bestPriceFound.price} USD</p>` : '<p><strong>Mejor precio encontrado:</strong> No disponible</p>'}
            </div>
            
            <p>Lamentamos que no hayamos podido encontrar un vuelo dentro de tu presupuesto durante el tiempo especificado.</p>
            
            ${data.bestPriceFound ? `
              <p>Sin embargo, encontramos vuelos desde $${data.bestPriceFound.price} USD. Puedes considerar:</p>
              <ul>
                <li>Ajustar tu presupuesto</li>
                <li>Ser más flexible con las fechas</li>
                <li>Crear una nueva alerta con diferentes parámetros</li>
              </ul>
            ` : `
              <p>Te sugerimos:</p>
              <ul>
                <li>Verificar la disponibilidad en fechas alternativas</li>
                <li>Considerar aeropuertos cercanos</li>
                <li>Crear una nueva alerta con un presupuesto más amplio</li>
              </ul>
            `}
            
            <div class="footer">
              <p>Gracias por usar las alertas de precio de WadaTrip.</p>
              <p>Puedes crear nuevas alertas en cualquier momento desde nuestro sitio web.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },
  
  alert_created: {
    subject: '🔔 Alerta de precio creada exitosamente',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alerta Creada - WadaTrip</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Alerta Creada</h1>
            <p>Tu alerta de precio está activa</p>
          </div>
          <div class="content">
            <div class="alert-info">
              <h2>Detalles de tu Alerta</h2>
              <p><strong>Ruta:</strong> ${data.origin} ✈️ ${data.destination}</p>
              <p><strong>Fecha de salida:</strong> ${new Date(data.departureDate).toLocaleDateString()}</p>
              ${data.returnDate ? `<p><strong>Fecha de regreso:</strong> ${new Date(data.returnDate).toLocaleDateString()}</p>` : ''}
              <p><strong>Presupuesto máximo:</strong> $${data.budget} USD</p>
              <p><strong>Tiempo máximo:</strong> ${data.maxWaitTime} horas</p>
              <p><strong>ID de alerta:</strong> ${data.monitorId}</p>
            </div>
            
            <p>¡Perfecto! Hemos configurado tu alerta de precio. Nuestro sistema verificará automáticamente los precios cada 30 minutos.</p>
            
            <p><strong>¿Qué sucede ahora?</strong></p>
            <ul>
              <li>Monitoreamos precios continuamente usando nuestro algoritmo de IA</li>
              <li>Te notificaremos inmediatamente cuando encontremos un precio dentro de tu presupuesto</li>
              <li>Recibirás un enlace directo para completar tu compra</li>
            </ul>
            
            <div class="footer">
              <p>Puedes ver el estado de tus alertas en cualquier momento desde tu panel de control.</p>
              <p>¡Gracias por confiar en WadaTrip!</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }
};

/**
 * Clase principal del servicio de notificaciones
 */
class NotificationService {
  constructor() {
    this.config = NOTIFICATION_CONFIG;
    this.templates = EMAIL_TEMPLATES;
  }

  /**
   * Envía una notificación por email
   * @param {string} to - Email del destinatario
   * @param {string} templateType - Tipo de plantilla (price_found, timeout, alert_created)
   * @param {Object} data - Datos para la plantilla
   * @returns {Promise<boolean>} True si se envió exitosamente
   */
  async sendEmail(to, templateType, data) {
    if (!this.config.email.enabled) {
      console.log('Email notifications are disabled');
      return false;
    }

    const template = this.templates[templateType];
    if (!template) {
      console.error(`Template ${templateType} not found`);
      return false;
    }

    try {
      const emailData = {
        to,
        from: {
          email: this.config.email.fromEmail,
          name: this.config.email.fromName
        },
        subject: template.subject,
        html: template.html(data)
      };

      // En un entorno real, aquí se integraría con el proveedor de email
      const success = await this.sendEmailViaProvider(emailData);
      
      if (success) {
        console.log(`✅ Email sent successfully to ${to} (${templateType})`);
        return true;
      } else {
        console.error(`❌ Failed to send email to ${to}`);
        return false;
      }
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Simula el envío de email a través del proveedor
   * En producción, esto se reemplazaría con la integración real
   * @param {Object} emailData - Datos del email
   * @returns {Promise<boolean>} True si se envió exitosamente
   */
  async sendEmailViaProvider(emailData) {
    // Simular latencia de red
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simular éxito/fallo (95% de éxito)
    const success = Math.random() > 0.05;
    
    if (success) {
      console.log('📧 Mock email sent:', {
        to: emailData.to,
        subject: emailData.subject,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('📧 Mock email failed:', emailData.to);
    }
    
    return success;
  }

  /**
   * Envía notificación de precio encontrado
   * @param {string} email - Email del usuario
   * @param {Object} offer - Datos de la oferta encontrada
   * @returns {Promise<boolean>} True si se envió exitosamente
   */
  async sendPriceFoundNotification(email, offer) {
    return await this.sendEmail(email, 'price_found', {
      ...offer,
      targetBudget: offer.targetBudget || offer.budget
    });
  }

  /**
   * Envía notificación de timeout
   * @param {string} email - Email del usuario
   * @param {Object} summary - Resumen del monitoreo
   * @returns {Promise<boolean>} True si se envió exitosamente
   */
  async sendTimeoutNotification(email, summary) {
    return await this.sendEmail(email, 'timeout', summary);
  }

  /**
   * Envía notificación de alerta creada
   * @param {string} email - Email del usuario
   * @param {Object} alertData - Datos de la alerta creada
   * @returns {Promise<boolean>} True si se envió exitosamente
   */
  async sendAlertCreatedNotification(email, alertData) {
    return await this.sendEmail(email, 'alert_created', alertData);
  }

  /**
   * Envía notificación push (para futuras implementaciones)
   * @param {string} userId - ID del usuario
   * @param {Object} notification - Datos de la notificación
   * @returns {Promise<boolean>} True si se envió exitosamente
   */
  async sendPushNotification(userId, notification) {
    if (!this.config.push.enabled) {
      console.log('Push notifications are disabled');
      return false;
    }

    // Implementación futura con Firebase Cloud Messaging
    console.log('🔔 Push notification (not implemented):', { userId, notification });
    return false;
  }

  /**
   * Envía notificación SMS (para futuras implementaciones)
   * @param {string} phoneNumber - Número de teléfono
   * @param {string} message - Mensaje a enviar
   * @returns {Promise<boolean>} True si se envió exitosamente
   */
  async sendSMSNotification(phoneNumber, message) {
    if (!this.config.sms.enabled) {
      console.log('SMS notifications are disabled');
      return false;
    }

    // Implementación futura con Twilio
    console.log('📱 SMS notification (not implemented):', { phoneNumber, message });
    return false;
  }

  /**
   * Obtiene estadísticas de notificaciones
   * @returns {Object} Estadísticas del servicio
   */
  getStats() {
    return {
      email: {
        enabled: this.config.email.enabled,
        provider: this.config.email.provider
      },
      push: {
        enabled: this.config.push.enabled,
        provider: this.config.push.provider
      },
      sms: {
        enabled: this.config.sms.enabled,
        provider: this.config.sms.provider
      },
      templates: Object.keys(this.templates)
    };
  }
}

// Instancia global del servicio
export const notificationService = new NotificationService();

// Funciones de conveniencia
export const sendPriceFoundEmail = (email, offer) => {
  return notificationService.sendPriceFoundNotification(email, offer);
};

export const sendTimeoutEmail = (email, summary) => {
  return notificationService.sendTimeoutNotification(email, summary);
};

export const sendAlertCreatedEmail = (email, alertData) => {
  return notificationService.sendAlertCreatedNotification(email, alertData);
};

export default notificationService;