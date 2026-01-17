/**
 * Wadatrip brand palette and gradients.
 */

export const AppColors = {
  // Primary colors
  azulMarino700: '#0a0e27',
  azulMarino600: '#1a1f3a',
  azulMarino500: '#00d9ff',
  orangeColor: '#ffb703',
  orangeLight: '#ffc94a',
  orangeDark: '#ff9900',

  // Neutral colors
  oscureColor: '#ffffff',
  grisOscuro: '#e0e0e0',
  grisClaro: '#a0a0a0',
  white: '#ffffff',
  white60: 'rgba(255, 255, 255, 0.6)',
  white80: 'rgba(255, 255, 255, 0.8)',

  // Status colors
  success: '#10b981',
  warning: '#ffb703',
  error: '#ef4444',
  info: '#00d9ff',

  // Background colors
  backgroundPrimary: '#0a0e27',
  backgroundSecondary: '#1a1f3a',
  backgroundDark: '#0a0e27',

  // CSS gradients
  gradients: {
    azul: 'linear-gradient(135deg, #00d9ff 0%, #ffb703 60%, #ff006e 100%)',
    orange: 'linear-gradient(135deg, #ff006e 0%, #ffb703 60%, #00d9ff 100%)',
    blueDark: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
    sunset: 'linear-gradient(135deg, #ff006e 0%, #00d9ff 100%)',
    ocean: 'linear-gradient(135deg, #00d9ff 0%, #1a1f3a 100%)',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // Helper to add opacity to a hex color.
  withOpacity: (color, opacity) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  },

  // Helper to generate a custom gradient.
  customGradient: (color1, color2, direction = '135deg') => {
    return `linear-gradient(${direction}, ${color1} 0%, ${color2} 100%)`;
  },
};

// Export individual colors for quick access.
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
  backgroundDark,
} = AppColors;

// Theme for components
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
  },
};
