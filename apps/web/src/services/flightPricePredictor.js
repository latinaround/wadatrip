/**
 * Flight Price Prediction Service
 * 
 * Este servicio simula la predicción de precios de vuelos utilizando machine learning.
 * En un entorno real, este servicio se conectaría con un modelo de ML entrenado
 * con datos históricos de precios de vuelos, patrones estacionales, demanda, etc.
 */

/**
 * Predice el precio de un vuelo basado en los parámetros proporcionados
 * @param {Object} flightData - Datos del vuelo para la predicción
 * @param {string} flightData.origin - Ciudad de origen
 * @param {string} flightData.destination - Ciudad de destino
 * @param {string} flightData.departureDate - Fecha de salida (YYYY-MM-DD)
 * @param {string} flightData.returnDate - Fecha de regreso (YYYY-MM-DD), opcional
 * @param {string} flightData.passengers - Número de pasajeros
 * @param {string} flightData.cabinClass - Clase de cabina (economy, premium_economy, business, first)
 * @returns {Promise<Object>} Predicción de precios y datos relacionados
 */
export const predictFlightPrice = async (flightData) => {
  // En un entorno real, aquí se enviarían los datos a un API de ML
  // y se procesarían utilizando un modelo entrenado
  
  // Simulamos un retraso para imitar una llamada a API
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Factores que afectarían el precio en un modelo real:
  // 1. Distancia entre origen y destino
  // 2. Temporada alta vs baja
  // 3. Días de antelación para la reserva
  // 4. Día de la semana para viajar
  // 5. Aerolíneas que operan la ruta
  // 6. Precio del combustible
  // 7. Demanda histórica
  
  // Simulamos algunos cálculos basados en los datos proporcionados
  const originDestinationFactor = getOriginDestinationFactor(flightData.origin, flightData.destination)
  const seasonalityFactor = getSeasonalityFactor(flightData.departureDate)
  const advanceBookingFactor = getAdvanceBookingFactor(flightData.departureDate)
  const cabinClassFactor = getCabinClassFactor(flightData.cabinClass)
  const passengersFactor = getPassengersFactor(flightData.passengers)
  
  // Calculamos un precio base simulado
  const basePrice = 300 * originDestinationFactor * seasonalityFactor * advanceBookingFactor * cabinClassFactor
  
  // Añadimos algo de aleatoriedad para simular la variabilidad del mercado
  const randomFactor = 0.85 + (Math.random() * 0.3) // Entre 0.85 y 1.15
  
  // Calculamos el rango de precios
  const minPrice = Math.round(basePrice * randomFactor * 0.85)
  const maxPrice = Math.round(basePrice * randomFactor * 1.25)
  
  // Determinamos el mejor momento para reservar (días antes del vuelo)
  const bestTimeToBook = Math.floor(Math.random() * 30) + 14 // Entre 14 y 44 días
  
  // Nivel de confianza de la predicción
  const priceConfidence = Math.floor(Math.random() * 15) + 75 // Entre 75% y 90%
  
  // Generamos un historial de precios simulado para los últimos 6 meses
  const priceHistory = generatePriceHistory(basePrice)
  
  return {
    minPrice,
    maxPrice,
    bestTimeToBook,
    priceConfidence,
    priceHistory,
    // Información adicional que podría ser útil
    factors: {
      seasonality: seasonalityFactor.toFixed(2),
      advanceBooking: advanceBookingFactor.toFixed(2),
      route: originDestinationFactor.toFixed(2),
      cabinClass: cabinClassFactor.toFixed(2)
    }
  }
}

/**
 * Genera un historial de precios simulado para los últimos 6 meses
 * @param {number} basePrice - Precio base para generar la variación
 * @returns {Array} Historial de precios por mes
 */
function generatePriceHistory(basePrice) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  return months.map(month => {
    // Añadimos variación para simular cambios de precios a lo largo del tiempo
    const variation = 0.7 + (Math.random() * 0.6) // Entre 0.7 y 1.3
    return {
      month,
      price: Math.round(basePrice * variation)
    }
  })
}

/**
 * Calcula un factor basado en el origen y destino
 * En un modelo real, esto se basaría en la distancia, popularidad de la ruta, etc.
 */
function getOriginDestinationFactor(origin, destination) {
  // Simulamos diferentes factores basados en combinaciones de origen-destino
  const originLower = origin.toLowerCase()
  const destinationLower = destination.toLowerCase()
  
  // Rutas populares o de larga distancia tendrían factores más altos
  if (
    (originLower.includes('new york') || destinationLower.includes('new york')) ||
    (originLower.includes('tokyo') || destinationLower.includes('tokyo')) ||
    (originLower.includes('london') || destinationLower.includes('london'))
  ) {
    return 1.5 + (Math.random() * 0.5) // Rutas populares/caras
  }
  
  if (
    (originLower.includes('paris') || destinationLower.includes('paris')) ||
    (originLower.includes('rome') || destinationLower.includes('rome')) ||
    (originLower.includes('barcelona') || destinationLower.includes('barcelona'))
  ) {
    return 1.3 + (Math.random() * 0.4) // Rutas europeas populares
  }
  
  // Ruta por defecto
  return 1.0 + (Math.random() * 0.3)
}

/**
 * Calcula un factor basado en la temporada del año
 * En un modelo real, esto se basaría en datos históricos de demanda por temporada
 */
function getSeasonalityFactor(departureDate) {
  if (!departureDate) return 1.0
  
  const date = new Date(departureDate)
  const month = date.getMonth() + 1 // 1-12
  
  // Temporada alta: verano y navidad
  if (month >= 6 && month <= 8) return 1.4 // Verano
  if (month === 12) return 1.5 // Navidad
  
  // Temporada media: primavera y otoño
  if (month >= 3 && month <= 5) return 1.2 // Primavera
  if (month >= 9 && month <= 11) return 1.1 // Otoño
  
  // Temporada baja: invierno (excepto navidad)
  return 0.9 // Enero, Febrero
}

/**
 * Calcula un factor basado en la antelación de la reserva
 * En un modelo real, esto se basaría en patrones históricos de precios vs. días de antelación
 */
function getAdvanceBookingFactor(departureDate) {
  if (!departureDate) return 1.0
  
  const today = new Date()
  const departure = new Date(departureDate)
  const daysUntilDeparture = Math.max(0, Math.floor((departure - today) / (1000 * 60 * 60 * 24)))
  
  // Reservas de último minuto (menos de 7 días): más caras
  if (daysUntilDeparture < 7) return 1.5
  
  // Reservas con poca antelación (7-14 días): algo más caras
  if (daysUntilDeparture < 14) return 1.3
  
  // Reservas con antelación media (14-30 días): precio estándar
  if (daysUntilDeparture < 30) return 1.0
  
  // Reservas con buena antelación (30-90 días): descuento
  if (daysUntilDeparture < 90) return 0.9
  
  // Reservas con mucha antelación (más de 90 días): mayor descuento
  return 0.85
}

/**
 * Calcula un factor basado en la clase de cabina
 */
function getCabinClassFactor(cabinClass) {
  switch (cabinClass) {
    case 'economy':
      return 1.0
    case 'premium_economy':
      return 1.6
    case 'business':
      return 3.0
    case 'first':
      return 5.0
    default:
      return 1.0
  }
}

/**
 * Calcula un factor basado en el número de pasajeros
 * En un modelo real, podría haber descuentos por grupo o tarifas especiales
 */
function getPassengersFactor(passengers) {
  const numPassengers = parseInt(passengers, 10) || 1
  
  // Simplemente devolvemos 1 ya que el precio total sería multiplicado por el número de pasajeros
  // En un modelo real, podría haber descuentos por grupo
  return 1.0
}