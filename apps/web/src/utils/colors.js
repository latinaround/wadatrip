/**
 * Sistema de colores adaptado del proyecto Flutter wadatrip_web
 * Paleta de colores y gradientes para la aplicación
 */

export const AppColors = {
  // Colores principales
  azulMarino700: '#1e3a8a',
  azulMarino600: '#1e40af',
  azulMarino500: '#3b82f6',
  orangeColor: '#f97316',
  orangeLight: '#fb923c',
  orangeDark: '#ea580c',
  
  // Colores neutros
  oscureColor: '#1f2937',
  grisOscuro: '#374151',
  grisClaro: '#9ca3af',
  white: '#ffffff',
  white60: 'rgba(255, 255, 255, 0.6)',
  white80: 'rgba(255, 255, 255, 0.8)',
  
  // Colores de estado
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Colores de fondo
  backgroundPrimary: '#ffffff',
  backgroundSecondary: '#f8fafc',
  backgroundDark: '#0f172a',
  
  // Gradientes CSS
  gradients: {
    azul: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    orange: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    blueDark: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
    sunset: 'linear-gradient(135deg, #f97316 0%, #1e3a8a 100%)',
    ocean: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
  },
  
  // Sombras
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  
  // Función para obtener color con opacidad
  withOpacity: (color, opacity) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  },
  
  // Función para obtener gradiente personalizado
  customGradient: (color1, color2, direction = '135deg') => {
    return `linear-gradient(${direction}, ${color1} 0%, ${color2} 100%)`;
  }
};

// Exportar colores individuales para fácil acceso
export const {
  azulMarino700,
  azulMarino600,
  azulMarino500,
  orangeColor,
  orangeLight,
  orangeDark,
  oscureColor,
  grisOscuro,
  grisClaro,
  white,
  white60,
  white80,
  success,
  warning,
  error,
  info,
  backgroundPrimary,
  backgroundSecondary,
  backgroundDark
} = AppColors;

// Tema para componentes
export const theme = {
  colors: AppColors,
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  }
};
