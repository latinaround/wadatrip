import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Validator } from '../utils/validator';
import { AppColors } from '../utils/colors';
import { notificationService } from '../utils/notifications';

export const EnhancedSearchForm = ({ onSearch, className = '' }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    destination: '',
    startDate: '',
    budget: '',
    preferences: '',
    email: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validar destino (requerido)
    if (!formData.destination.trim()) {
      newErrors.destination = t('search_form.destination_required');
    }

    // Validar fecha de inicio
    const dateValidation = Validator.validateStartDate(formData.startDate);
    if (!dateValidation.isValid) {
      newErrors.startDate = dateValidation.error;
    }

    // Validar presupuesto
    const budgetValidation = Validator.validateBudget(formData.budget);
    if (!budgetValidation.isValid) {
      newErrors.budget = budgetValidation.error;
    }

    // Validar preferencias (opcional, pero si se proporciona debe ser vlido)
    if (formData.preferences.trim()) {
      const preferencesValidation = Validator.validatePreferences(formData.preferences);
      if (!preferencesValidation.isValid) {
        newErrors.preferences = preferencesValidation.error;
      }
    }

    // Validar email (opcional, pero si se proporciona debe ser vlido)
    if (formData.email.trim()) {
      const emailValidation = Validator.validateEmail(formData.email);
      if (!emailValidation.isValid) {
        newErrors.email = emailValidation.error;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Mostrar notificacin de error
      notificationService.showNotification({
        title: 'Formulario Invlido',
        body: 'Please fix the errors in the form.',
        icon: '/error-icon.png'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Procesar datos validados
      const processedData = {
        destination: formData.destination.trim(),
        startDate: formData.startDate,
        budget: parseFloat(formData.budget),
        preferences: formData.preferences ? 
          formData.preferences.split(',').map(p => p.trim()) : [],
        email: formData.email.trim() || null
      };

      await onSearch(processedData);
      
      // Mostrar notificacin de xito
      notificationService.showNotification({
        title: t('search_form.search_started'),
        body: `Searching options for ${formData.destination}...`,
        icon: '/search-icon.png'
      });
      
    } catch (error) {
      console.error('Error en bsqueda:', error);
      notificationService.showNotification({
        title: t('search_form.search_error'),
        body: t('search_form.search_error_message'),
        icon: '/error-icon.png'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`enhanced-search-form ${className}`}>
      <div className="form-grid">
        {/* Campo Destino */}
        <div className="form-field">
          <label htmlFor="destination">{t("hero.destination_label")} *</label>
          <input
            id="destination"
            type="text"
            value={formData.destination}
            onChange={(e) => handleInputChange('destination', e.target.value)}
            placeholder={t("hero.destination_placeholder")}
            className={errors.destination ? 'error' : ''}
          />
          {errors.destination && (
            <span className="error-message">{errors.destination}</span>
          )}
        </div>

        {/* Campo Fecha */}
        <div className="form-field">
          <label htmlFor="startDate">{t("search_form.start_date")} *</label>
          <input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => handleInputChange('startDate', e.target.value)}
            className={errors.startDate ? 'error' : ''}
          />
          {errors.startDate && (
            <span className="error-message">{errors.startDate}</span>
          )}
        </div>

        {/* Campo Presupuesto */}
        <div className="form-field">
          <label htmlFor="budget">{t("search_form.budget_usd")} *</label>
          <input
            id="budget"
            type="number"
            min="0"
            max="1000000"
            value={formData.budget}
            onChange={(e) => handleInputChange('budget', e.target.value)}
            placeholder="e.g. 1500"
            className={errors.budget ? 'error' : ''}
          />
          {errors.budget && (
            <span className="error-message">{errors.budget}</span>
          )}
        </div>

        {/* Campo Preferencias */}
        <div className="form-field full-width">
          <label htmlFor="preferences">{t('search_form.preferences_label')}</label>
          <input
            id="preferences"
            type="text"
            value={formData.preferences}
            onChange={(e) => handleInputChange('preferences', e.target.value)}
            placeholder={t('search_form.preferences_placeholder')}
            className={errors.preferences ? 'error' : ''}
          />
          {errors.preferences && (
            <span className="error-message">{errors.preferences}</span>
          )}
          <small className="field-hint">
            {t('search_form.preferences_hint')}
          </small>
        </div>

        {/* Campo Email */}
        <div className="form-field full-width">
          <label htmlFor="email">{t('search_form.email_label')}</label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder={t('search_form.email_placeholder')}
            className={errors.email ? 'error' : ''}
          />
          {errors.email && (
            <span className="error-message">{errors.email}</span>
          )}
          <small className="field-hint">
            {t('search_form.email_hint')}
          </small>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isLoading}
        className="submit-button"
      >
        {isLoading ? t("search_form.searching") : t("search_form.search_button")}
      </button>

      <style jsx>{`
        .enhanced-search-form {
          background: transparent;
          padding: 0;
          border-radius: 0;
          box-shadow: none;
          max-width: 100%;
          margin: 0;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
        }

        .form-field.full-width {
          grid-column: 1 / -1;
        }

        label {
          font-weight: 600;
          color: ${AppColors.oscureColor};
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        input {
          padding: 0.75rem;
          border: 2px solid ${AppColors.grisClaro};
          border-radius: 0.5rem;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        input:focus {
          outline: none;
          border-color: ${AppColors.azulMarino500};
          box-shadow: 0 0 0 3px ${AppColors.withOpacity(AppColors.azulMarino500, 0.1)};
        }

        input.error {
          border-color: ${AppColors.error};
        }

        .error-message {
          color: ${AppColors.error};
          font-size: 0.75rem;
          margin-top: 0.25rem;
        }

        .field-hint {
          color: ${AppColors.grisOscuro};
          font-size: 0.75rem;
          margin-top: 0.25rem;
        }

        .submit-button {
          width: 100%;
          padding: 1rem 2rem;
          background: ${AppColors.gradients.orange};
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: ${AppColors.shadows.lg};
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .enhanced-search-form {
            padding: 1.5rem;
          }
          
          .form-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }
      `}</style>
    </form>
  );
};







