import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createFlightPriceAlert, getActiveMonitors, cancelPriceAlert, getMonitorStatus } from '../services/flightPriceMonitor';
import './FlightPriceAlert.css';

const FlightPriceAlert = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    departureDate: '',
    budget: '',
    maxWaitTime: '168', // 1 week default
    userEmail: ''
  });
  
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notification, setNotification] = useState(null);

  // Cargar alertas activas al montar el componente
  useEffect(() => {
    loadActiveAlerts();
    // Actualizar cada 30 segundos
    const interval = setInterval(loadActiveAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadActiveAlerts = () => {
    const alerts = getActiveMonitors();
    setActiveAlerts(alerts);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // Validaciones
      if (!formData.origin || !formData.destination || !formData.departureDate || 
          !formData.budget || !formData.userEmail) {
        throw new Error(t('price_alerts.validation_required_fields'));
      }

      if (parseFloat(formData.budget) <= 0) {
        throw new Error(t('price_alerts.validation_budget_positive'));
      }

      if (parseInt(formData.maxWaitTime) <= 0) {
        throw new Error(t('price_alerts.validation_wait_time_positive'));
      }

      // Crear la alerta de precio
      const monitorId = createFlightPriceAlert({
        ...formData,
        budget: parseFloat(formData.budget),
        maxWaitTime: parseInt(formData.maxWaitTime),
        onPriceFound: (offer) => {
          setNotification({
            type: 'success',
            message: t('price_alerts.price_found_notification', {
              price: offer.price,
              origin: offer.flightData.origin,
              destination: offer.flightData.destination
            }),
            offer
          });
          loadActiveAlerts();
        },
        onTimeout: (summary) => {
          setNotification({
            type: 'warning',
            message: t('price_alerts.timeout_notification', {
              price: summary.bestPriceFound?.price || 'N/A'
            })
          });
          loadActiveAlerts();
        }
      });

      setNotification({
        type: 'success',
        message: t('price_alerts.alert_created_success_with_id', { id: monitorId })
      });

      // Limpiar formulario
      setFormData({
        origin: '',
        destination: '',
        departureDate: '',
        budget: '',
        maxWaitTime: '168',
        userEmail: ''
      });

      setShowForm(false);
      loadActiveAlerts();

    } catch (error) {
      setNotification({
        type: 'error',
        message: error.message
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelAlert = async (monitorId) => {
    try {
      const success = cancelPriceAlert(monitorId);
      if (success) {
        setNotification({
        type: 'success',
        message: t('price_alerts.alert_cancelled_success')
      });
        loadActiveAlerts();
      } else {
        throw new Error(t('price_alerts.alert_cancel_error'));
      }
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.message
      });
    }
  };

  const formatTimeRemaining = (ms) => {
    if (ms <= 0) return t('price_alerts.expired_status');
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="flight-price-alert">
      <div className="alert-header">
        <h2> {t('price_alerts.title')}</h2>
        <p>{t('price_alerts.subtitle')}</p>
      </div>

      {/* Notificaciones */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <div className="notification-content">
            <span>{notification.message}</span>
            {notification.offer && (
              <a 
                href={notification.offer.purchaseUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="purchase-btn"
              >
                {t('price_alerts.buy_now_btn')}
              </a>
            )}
          </div>
          <button 
            className="notification-close"
            onClick={() => setNotification(null)}
          >
            
          </button>
        </div>
      )}

      {/* Botn para mostrar formulario */}
      <div className="create-alert-section">
        <button 
          className="create-alert-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? ` ${t('price_alerts.cancel_btn')}` : ` ${t('price_alerts.create_alert_btn')}`}
        </button>
      </div>

      {/* Formulario de creacin */}
      {showForm && (
        <div className="alert-form-container">
          <form onSubmit={handleSubmit} className="alert-form">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="origin">{t('price_alerts.origin_label')} *</label>
                <input
                  type="text"
                  id="origin"
                  name="origin"
                  value={formData.origin}
                  onChange={handleInputChange}
                  placeholder={t('price_alerts.origin_placeholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="destination">{t('price_alerts.destination_label')} *</label>
                <input
                  type="text"
                  id="destination"
                  name="destination"
                  value={formData.destination}
                  onChange={handleInputChange}
                  placeholder={t('price_alerts.destination_placeholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="departureDate">{t('price_alerts.departure_date_label')} *</label>
                <input
                  type="date"
                  id="departureDate"
                  name="departureDate"
                  value={formData.departureDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="form-group budget-group">
                <label htmlFor="budget">{t('price_alerts.budget_label')} *</label>
                <input
                  type="number"
                  id="budget"
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  placeholder="500"
                  min="1"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="maxWaitTime">{t('price_alerts.max_wait_time_label')} *</label>
                <select
                  id="maxWaitTime"
                  name="maxWaitTime"
                  value={formData.maxWaitTime}
                  onChange={handleInputChange}
                >
                  <option value="1">{t('price_alerts.time_1_hour')}</option>
                  <option value="6">{t('price_alerts.time_6_hours')}</option>
                  <option value="12">{t('price_alerts.time_12_hours')}</option>
                  <option value="24">{t('price_alerts.time_24_hours')}</option>
                  <option value="48">{t('price_alerts.time_48_hours')}</option>
                  <option value="72">{t('price_alerts.time_72_hours')}</option>
                  <option value="168">{t('price_alerts.time_1_week')}</option>
                </select>
              </div>

              <div className="form-group email-group">
                <label htmlFor="userEmail">{t('price_alerts.email_label')} *</label>
                <input
                  type="email"
                  id="userEmail"
                  name="userEmail"
                  value={formData.userEmail}
                  onChange={handleInputChange}
                  placeholder={t('price_alerts.email_placeholder')}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              disabled={isCreating}
            >
              {isCreating ? ` ${t('price_alerts.creating_btn')}` : ` ${t('price_alerts.create_btn')}`}
            </button>
          </form>
        </div>
      )}

      {/* Lista de alertas activas */}
      <div className="active-alerts-section">
        <h3>{t('price_alerts.active_alerts_title')} ({activeAlerts.length})</h3>
        
        {activeAlerts.length === 0 ? (
          <div className="no-alerts">
            <p>{t('price_alerts.no_alerts_message')}</p>
          </div>
        ) : (
          <div className="alerts-grid">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="alert-card">
                <div className="alert-header">
                  <div className="route">
                    <span className="origin">{alert.id.split('_')[2] || 'Origin'}</span>
                    <span className="arrow"></span>
                    <span className="destination">{alert.id.split('_')[3] || 'Destination'}</span>
                  </div>
                  <span className={`status status-${alert.status}`}>
                    {alert.status === 'active' ? ` ${t('price_alerts.status_active')}` : ` ${t('price_alerts.status_inactive')}`}
                  </span>
                </div>
                
                <div className="alert-details">
                  <div className="detail-row">
                    <span className="label">{t('price_alerts.budget_label_card')}</span>
                    <span className="value">{formatCurrency(alert.targetBudget)}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">{t('price_alerts.checks_label')}</span>
                    <span className="value">{alert.checkCount}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="label">{t('price_alerts.time_remaining_label')}</span>
                    <span className="value">{formatTimeRemaining(alert.timeRemaining)}</span>
                  </div>
                  
                  {alert.bestPriceFound && (
                    <div className="detail-row">
                      <span className="label">{t('price_alerts.best_price_label')}</span>
                      <span className="value best-price">
                        {formatCurrency(alert.bestPriceFound.price)}
                      </span>
                    </div>
                  )}
                  
                  {alert.lastCheck && (
                    <div className="detail-row">
                      <span className="label">{t('price_alerts.last_check_label')}</span>
                      <span className="value">
                        {new Date(alert.lastCheck).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="alert-actions">
                  <button 
                    className="cancel-btn"
                    onClick={() => handleCancelAlert(alert.id)}
                  >
                     {t('price_alerts.cancel_alert_btn')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightPriceAlert;
