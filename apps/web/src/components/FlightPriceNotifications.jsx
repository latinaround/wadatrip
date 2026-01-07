import React, { useState, useEffect } from 'react';
import { notificationService } from '../utils/notifications';
import { AppColors } from '../utils/colors';
import { Validator } from '../utils/validator';

export const FlightPriceNotifications = () => {
  const [permission, setPermission] = useState(notificationService.permission);
  const [isSupported] = useState(notificationService.isSupported);
  const [alerts, setAlerts] = useState([]);
  const [newAlert, setNewAlert] = useState({
    origin: '',
    destination: '',
    email: '',
    maxPrice: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Inicializar servicio de notificaciones
    notificationService.initialize().then((granted) => {
      setPermission(notificationService.permission);
    });

    // Cargar alertas guardadas del localStorage
    const savedAlerts = localStorage.getItem('wadatrip-price-alerts');
    if (savedAlerts) {
      setAlerts(JSON.parse(savedAlerts));
    }
  }, []);

  const requestPermission = async () => {
    const granted = await notificationService.initialize();
    setPermission(notificationService.permission);
    return granted;
  };

  const validateAlert = () => {
    const newErrors = {};

    if (!newAlert.origin.trim()) {
      newErrors.origin = 'El origen es requerido';
    }

    if (!newAlert.destination.trim()) {
      newErrors.destination = 'El destino es requerido';
    }

    const emailValidation = Validator.validateEmail(newAlert.email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.error;
    }

    const budgetValidation = Validator.validateBudget(newAlert.maxPrice);
    if (!budgetValidation.isValid) {
      newErrors.maxPrice = budgetValidation.error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addAlert = () => {
    if (!validateAlert()) return;

    const alert = {
      id: Date.now(),
      origin: newAlert.origin.trim(),
      destination: newAlert.destination.trim(),
      email: newAlert.email.trim(),
      maxPrice: parseFloat(newAlert.maxPrice),
      createdAt: new Date().toISOString(),
      isActive: true
    };

    const updatedAlerts = [...alerts, alert];
    setAlerts(updatedAlerts);
    localStorage.setItem('wadatrip-price-alerts', JSON.stringify(updatedAlerts));

    // Limpiar formulario
    setNewAlert({ origin: '', destination: '', email: '', maxPrice: '' });
    setErrors({});

    // Mostrar notificación de confirmación
    notificationService.showNotification({
      title: 'Alerta Creada',
      body: `Te notificaremos cuando el precio de ${alert.origin}  ${alert.destination} baje de $${alert.maxPrice}`,
      icon: '/alert-icon.png'
    });
  };

  const removeAlert = (alertId) => {
    const updatedAlerts = alerts.filter(alert => alert.id !== alertId);
    setAlerts(updatedAlerts);
    localStorage.setItem('wadatrip-price-alerts', JSON.stringify(updatedAlerts));
  };

  const toggleAlert = (alertId) => {
    const updatedAlerts = alerts.map(alert => 
      alert.id === alertId ? { ...alert, isActive: !alert.isActive } : alert
    );
    setAlerts(updatedAlerts);
    localStorage.setItem('wadatrip-price-alerts', JSON.stringify(updatedAlerts));
  };

  const simulateFlightPriceAlert = (alert) => {
    // Simular una alerta de precio
    const mockPrice = Math.floor(Math.random() * alert.maxPrice * 0.8) + 100;
    notificationService.showFlightPriceAlert({
      origin: alert.origin,
      destination: alert.destination,
      price: mockPrice,
      previousPrice: alert.maxPrice,
      date: new Date().toISOString().split('T')[0]
    });
  };

  if (!isSupported) {
    return (
      <div className="notification-container">
        <div className="alert alert-warning">
          <h3>Notificaciones No Soportadas</h3>
          <p>Tu navegador no soporta notificaciones push. Considera actualizar tu navegador para recibir alertas de precios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-container">
      <div className="notification-header">
        <h2>Alertas de Precios de Vuelos</h2>
        <p>Recibe notificaciones cuando los precios bajen</p>
      </div>

      {permission !== 'granted' && (
        <div className="permission-request">
          <div className="alert alert-info">
            <h3>Permisos Requeridos</h3>
            <p>Para recibir alertas de precios, necesitamos tu permiso para mostrar notificaciones.</p>
            <button onClick={requestPermission} className="btn btn-primary">
              Permitir Notificaciones
            </button>
          </div>
        </div>
      )}

      {permission === 'granted' && (
        <div className="alert-form">
          <h3>Crear Nueva Alerta</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Origen</label>
              <input
                type="text"
                value={newAlert.origin}
                onChange={(e) => setNewAlert({...newAlert, origin: e.target.value})}
                placeholder="Ciudad de origen"
                className={errors.origin ? 'error' : ''}
              />
              {errors.origin && <span className="error-message">{errors.origin}</span>}
            </div>

            <div className="form-field">
              <label>Destino</label>
              <input
                type="text"
                value={newAlert.destination}
                onChange={(e) => setNewAlert({...newAlert, destination: e.target.value})}
                placeholder="Ciudad de destino"
                className={errors.destination ? 'error' : ''}
              />
              {errors.destination && <span className="error-message">{errors.destination}</span>}
            </div>

            <div className="form-field">
              <label>Email</label>
              <input
                type="email"
                value={newAlert.email}
                onChange={(e) => setNewAlert({...newAlert, email: e.target.value})}
                placeholder="tu@email.com"
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            <div className="form-field">
              <label>Precio Máximo (USD)</label>
              <input
                type="number"
                value={newAlert.maxPrice}
                onChange={(e) => setNewAlert({...newAlert, maxPrice: e.target.value})}
                placeholder="500"
                className={errors.maxPrice ? 'error' : ''}
              />
              {errors.maxPrice && <span className="error-message">{errors.maxPrice}</span>}
            </div>
          </div>

          <button onClick={addAlert} className="btn btn-primary">
            Crear Alerta
          </button>
        </div>
      )}

      <div className="alerts-list">
        <h3>Mis Alertas ({alerts.length})</h3>
        {alerts.length === 0 ? (
          <p className="no-alerts">No tienes alertas activas. Crea una para comenzar.</p>
        ) : (
          <div className="alerts-grid">
            {alerts.map(alert => (
              <div key={alert.id} className={`alert-card ${!alert.isActive ? 'inactive' : ''}`}>
                <div className="alert-info">
                  <h4>{alert.origin}  {alert.destination}</h4>
                  <p>Precio máximo: <strong>${alert.maxPrice}</strong></p>
                  <p>Email: {alert.email}</p>
                  <small>Creada: {new Date(alert.createdAt).toLocaleDateString()}</small>
                </div>
                <div className="alert-actions">
                  <button 
                    onClick={() => toggleAlert(alert.id)}
                    className={`btn btn-sm ${alert.isActive ? 'btn-warning' : 'btn-success'}`}
                  >
                    {alert.isActive ? 'Pausar' : 'Activar'}
                  </button>
                  <button 
                    onClick={() => simulateFlightPriceAlert(alert)}
                    className="btn btn-sm btn-info"
                    title="Simular alerta"
                  >
                    Probar
                  </button>
                  <button 
                    onClick={() => removeAlert(alert.id)}
                    className="btn btn-sm btn-danger"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .notification-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem;
        }

        .notification-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .notification-header h2 {
          color: ${AppColors.azulMarino700};
          margin-bottom: 0.5rem;
        }

        .alert {
          padding: 1rem;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
        }

        .alert-info {
          background: ${AppColors.withOpacity(AppColors.info, 0.1)};
          border: 1px solid ${AppColors.info};
          color: ${AppColors.azulMarino700};
        }

        .alert-warning {
          background: ${AppColors.withOpacity(AppColors.warning, 0.1)};
          border: 1px solid ${AppColors.warning};
          color: ${AppColors.orangeDark};
        }

        .alert-form {
          background: ${AppColors.backgroundSecondary};
          padding: 2rem;
          border-radius: 1rem;
          margin-bottom: 2rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
        }

        label {
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: ${AppColors.oscureColor};
        }

        input {
          padding: 0.75rem;
          border: 2px solid ${AppColors.grisClaro};
          border-radius: 0.5rem;
          font-size: 1rem;
        }

        input:focus {
          outline: none;
          border-color: ${AppColors.azulMarino500};
        }

        input.error {
          border-color: ${AppColors.error};
        }

        .error-message {
          color: ${AppColors.error};
          font-size: 0.75rem;
          margin-top: 0.25rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: ${AppColors.azulMarino600};
          color: white;
        }

        .btn-primary:hover {
          background: ${AppColors.azulMarino700};
        }

        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }

        .btn-success {
          background: ${AppColors.success};
          color: white;
        }

        .btn-warning {
          background: ${AppColors.warning};
          color: white;
        }

        .btn-info {
          background: ${AppColors.info};
          color: white;
        }

        .btn-danger {
          background: ${AppColors.error};
          color: white;
        }

        .alerts-list h3 {
          color: ${AppColors.azulMarino700};
          margin-bottom: 1rem;
        }

        .no-alerts {
          text-align: center;
          color: ${AppColors.grisOscuro};
          font-style: italic;
        }

        .alerts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }

        .alert-card {
          background: white;
          border: 2px solid ${AppColors.grisClaro};
          border-radius: 0.75rem;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }

        .alert-card:hover {
          box-shadow: ${AppColors.shadows.md};
        }

        .alert-card.inactive {
          opacity: 0.6;
          border-color: ${AppColors.grisClaro};
        }

        .alert-info h4 {
          color: ${AppColors.azulMarino700};
          margin-bottom: 0.5rem;
        }

        .alert-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }

        @media (max-width: 768px) {
          .notification-container {
            padding: 1rem;
          }
          
          .form-grid {
            grid-template-columns: 1fr;
          }
          
          .alerts-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
