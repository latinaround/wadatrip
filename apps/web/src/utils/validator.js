/**
 * Sistema de validadores adaptado del proyecto Flutter wadatrip_web
 * Validadores para formularios y datos de entrada
 */

export class Validator {
  /**
   * Valida que el usuario sea mayor de 18 años
   * @param {string} birthDate - Fecha de nacimiento en formato YYYY-MM-DD
   * @returns {boolean} true si es mayor de 18, false en caso contrario
   */
  static validateAge(birthDate) {
    if (!birthDate) return false;
    
    const today = new Date();
    const birth = new Date(birthDate);
    
    if (birth > today) return false;
    
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return age - 1 >= 18;
    }
    
    return age >= 18;
  }

  /**
   * Valida formato de fecha y que no sea en el pasado
   * @param {string} dateString - Fecha en formato YYYY-MM-DD
   * @returns {object} { isValid: boolean, error?: string }
   */
  static validateStartDate(dateString) {
    if (!dateString) {
      return { isValid: false, error: 'La fecha es requerida' };
    }

    // Validar formato YYYY-MM-DD
    const dateRegex = /^\\d{4}-\\d{2}-\\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return { isValid: false, error: 'Formato de fecha inválido. Use YYYY-MM-DD' };
    }

    const inputDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Verificar que la fecha sea válida
    if (isNaN(inputDate.getTime())) {
      return { isValid: false, error: 'Fecha inválida' };
    }

    // Verificar que no sea en el pasado
    if (inputDate < today) {
      return { isValid: false, error: 'La fecha no puede ser en el pasado' };
    }

    // Verificar que no sea más de 2 años en el futuro
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    if (inputDate > maxDate) {
      return { isValid: false, error: 'La fecha no puede ser más de 2 años en el futuro' };
    }

    return { isValid: true };
  }

  /**
   * Valida email
   * @param {string} email - Email a validar
   * @returns {object} { isValid: boolean, error?: string }
   */
  static validateEmail(email) {
    if (!email) {
      return { isValid: false, error: 'El email es requerido' };
    }

    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Formato de email inválido' };
    }

    return { isValid: true };
  }

  /**
   * Valida presupuesto
   * @param {string|number} budget - Presupuesto
   * @returns {object} { isValid: boolean, error?: string, amount?: number }
   */
  static validateBudget(budget) {
    if (!budget && budget !== 0) {
      return { isValid: false, error: 'El presupuesto es requerido' };
    }

    const amount = typeof budget === 'string' ? parseFloat(budget) : budget;
    
    if (isNaN(amount)) {
      return { isValid: false, error: 'El presupuesto debe ser un número válido' };
    }

    if (amount < 0) {
      return { isValid: false, error: 'El presupuesto no puede ser negativo' };
    }

    if (amount > 1000000) {
      return { isValid: false, error: 'El presupuesto no puede exceder $1,000,000' };
    }

    return { isValid: true, amount };
  }
}
