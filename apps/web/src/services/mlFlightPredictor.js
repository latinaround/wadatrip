/**
 * ML Flight Price Prediction Service
 * 
 * Este servicio implementa un algoritmo de RandomForest para la predicción de precios de vuelos.
 * Basado en el algoritmo de Alfred mencionado por el usuario.
 */

/**
 * Genera datos de entrenamiento simulados para el modelo de RandomForest
 * @returns {Object} Datos de entrenamiento X e y
 */
function generateTrainingData() {
  // En un entorno real, estos datos vendrían de una base de datos o API
  // Simulamos datos de entrenamiento para el modelo
  const X_train = [];
  const y_train = [];
  
  // Generamos 500 ejemplos de entrenamiento simulados
  for (let i = 0; i < 500; i++) {
    // Características (features)
    const features = [
      Math.random(), // Distancia normalizada (0-1)
      Math.random(), // Temporada (0-1 donde 1 es temporada alta)
      Math.random(), // Días de antelación normalizado (0-1)
      Math.random(), // Día de la semana (0-1)
      Math.random(), // Factor de demanda (0-1)
      Math.random(), // Clase de cabina normalizada (0-1)
      Math.random(), // Número de pasajeros normalizado (0-1)
    ];
    
    // Precio (target) - simulamos una relación con las características
    // con algo de ruido aleatorio
    const price = (
      300 + 
      features[0] * 700 + // Distancia
      features[1] * 400 + // Temporada
      (1 - features[2]) * 300 + // Antelación (menos días = más caro)
      features[3] * 100 + // Día de la semana
      features[4] * 200 + // Demanda
      features[5] * 1000 + // Clase de cabina
      features[6] * 100 + // Pasajeros
      (Math.random() - 0.5) * 200 // Ruido aleatorio
    );
    
    X_train.push(features);
    y_train.push(price);
  }
  
  return { X_train, y_train };
}

/**
 * Convierte los datos del formulario en características para el modelo
 * @param {Object} flightData - Datos del vuelo para la predicción
 * @returns {Array} Vector de características para el modelo
 */
function prepareFeatures(flightData) {
  // Extraemos y normalizamos las características de los datos del formulario
  
  // Distancia (simulada basada en origen y destino)
  const distanceFactor = getDistanceFactor(flightData.origin, flightData.destination);
  
  // Temporada
  const seasonality = getSeasonalityFactor(flightData.departureDate);
  
  // Días de antelación
  const advanceBooking = getAdvanceBookingNormalized(flightData.departureDate);
  
  // Día de la semana (0-6, normalizado a 0-1)
  const dayOfWeek = getDayOfWeekNormalized(flightData.departureDate);
  
  // Factor de demanda (simulado)
  const demandFactor = getDemandFactor(flightData.origin, flightData.destination, flightData.departureDate);
  
  // Clase de cabina normalizada
  const cabinClassFactor = getCabinClassNormalized(flightData.cabinClass);
  
  // Número de pasajeros normalizado (asumiendo máximo 6)
  const passengersFactor = (parseInt(flightData.passengers, 10) - 1) / 5;
  
  return [
    distanceFactor,
    seasonality,
    advanceBooking,
    dayOfWeek,
    demandFactor,
    cabinClassFactor,
    passengersFactor
  ];
}

// Funciones auxiliares para normalizar características

function getDistanceFactor(origin, destination) {
  // Simulamos un factor de distancia normalizado (0-1)
  // En un entorno real, se calcularía la distancia real entre ciudades
  const originLower = origin.toLowerCase();
  const destinationLower = destination.toLowerCase();
  
  // Rutas de larga distancia
  if (
    (originLower.includes('new york') && destinationLower.includes('tokyo')) ||
    (originLower.includes('tokyo') && destinationLower.includes('new york')) ||
    (originLower.includes('london') && destinationLower.includes('sydney')) ||
    (originLower.includes('sydney') && destinationLower.includes('london'))
  ) {
    return 0.8 + (Math.random() * 0.2); // 0.8-1.0 (muy lejos)
  }
  
  // Rutas de media distancia
  if (
    (originLower.includes('new york') && destinationLower.includes('london')) ||
    (originLower.includes('london') && destinationLower.includes('new york')) ||
    (originLower.includes('paris') && destinationLower.includes('dubai')) ||
    (originLower.includes('dubai') && destinationLower.includes('paris'))
  ) {
    return 0.5 + (Math.random() * 0.3); // 0.5-0.8 (distancia media)
  }
  
  // Rutas cortas (por defecto)
  return 0.1 + (Math.random() * 0.4); // 0.1-0.5 (corta distancia)
}

function getSeasonalityFactor(departureDate) {
  if (!departureDate) return 0.5;
  
  const date = new Date(departureDate);
  const month = date.getMonth(); // 0-11
  
  // Temporada alta: verano y navidad
  if (month >= 5 && month <= 7) return 0.8 + (Math.random() * 0.2); // Verano (Jun-Ago)
  if (month === 11) return 0.8 + (Math.random() * 0.2); // Navidad (Dic)
  
  // Temporada media: primavera y otoño
  if (month >= 2 && month <= 4) return 0.5 + (Math.random() * 0.2); // Primavera (Mar-May)
  if (month >= 8 && month <= 10) return 0.4 + (Math.random() * 0.2); // Otoño (Sep-Nov)
  
  // Temporada baja: invierno (excepto navidad)
  return 0.1 + (Math.random() * 0.3); // Invierno (Ene-Feb)
}

function getAdvanceBookingNormalized(departureDate) {
  if (!departureDate) return 0.5;
  
  const today = new Date();
  const departure = new Date(departureDate);
  const daysUntilDeparture = Math.max(0, Math.floor((departure - today) / (1000 * 60 * 60 * 24)));
  
  // Normalizar a un rango 0-1 (0 = reserva de último minuto, 1 = reserva con mucha antelación)
  // Asumimos que 180 días (6 meses) es la antelación máxima típica
  return Math.min(1, daysUntilDeparture / 180);
}

function getDayOfWeekNormalized(departureDate) {
  if (!departureDate) return 0.5;
  
  const date = new Date(departureDate);
  const dayOfWeek = date.getDay(); // 0-6 (Domingo-Sábado)
  
  // Normalizar a un rango 0-1
  return dayOfWeek / 6;
}

function getDemandFactor(origin, destination, departureDate) {
  // Simulamos un factor de demanda basado en la ruta y la fecha
  // En un entorno real, esto vendría de datos históricos de reservas
  
  // Base: demanda aleatoria
  let demand = 0.3 + (Math.random() * 0.4); // 0.3-0.7 base
  
  // Ajuste por ruta popular
  const originLower = origin.toLowerCase();
  const destinationLower = destination.toLowerCase();
  
  if (
    (originLower.includes('new york') || destinationLower.includes('new york')) ||
    (originLower.includes('london') || destinationLower.includes('london')) ||
    (originLower.includes('paris') || destinationLower.includes('paris'))
  ) {
    demand += 0.2; // Rutas populares tienen más demanda
  }
  
  // Ajuste por temporada
  if (departureDate) {
    const date = new Date(departureDate);
    const month = date.getMonth(); // 0-11
    
    // Más demanda en verano y navidad
    if ((month >= 5 && month <= 7) || month === 11) {
      demand += 0.1;
    }
  }
  
  return Math.min(1, demand); // Asegurar que no exceda 1
}

function getCabinClassNormalized(cabinClass) {
  switch (cabinClass) {
    case 'economy':
      return 0.0;
    case 'premium_economy':
      return 0.33;
    case 'business':
      return 0.67;
    case 'first':
      return 1.0;
    default:
      return 0.0;
  }
}

/**
 * Implementación simplificada de RandomForestRegressor
 * En un entorno real, se usaría una biblioteca como sklearn.js o tensorflow.js
 */
class RandomForestRegressor {
  constructor(n_estimators = 10, max_depth = 5) {
    this.n_estimators = n_estimators;
    this.max_depth = max_depth;
    this.trees = [];
  }
  
  fit(X, y) {
    // Simulamos el entrenamiento de múltiples árboles de decisión
    for (let i = 0; i < this.n_estimators; i++) {
      // En un modelo real, cada árbol se entrenaría con un subconjunto aleatorio
      // de datos y características (bootstrap aggregating o bagging)
      this.trees.push(this.createDecisionTree(X, y, this.max_depth));
    }
    return this;
  }
  
  predict(X) {
    // Para una sola muestra
    if (!Array.isArray(X[0])) {
      return this.predictSingle(X);
    }
    
    // Para múltiples muestras
    return X.map(sample => this.predictSingle(sample));
  }
  
  predictSingle(sample) {
    // Promediamos las predicciones de todos los árboles
    const predictions = this.trees.map(tree => this.traverseTree(tree, sample));
    return predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
  }
  
  createDecisionTree(X, y, max_depth, depth = 0) {
    // Simulamos la creación de un árbol de decisión
    // En un modelo real, se usaría un algoritmo como CART
    
    // Si alcanzamos la profundidad máxima, devolvemos un nodo hoja
    if (depth >= max_depth) {
      // Valor promedio de y como predicción
      const leafValue = y.reduce((sum, val) => sum + val, 0) / y.length;
      return { type: 'leaf', value: leafValue };
    }
    
    // Simulamos la selección de una característica y un punto de división
    const featureIndex = Math.floor(Math.random() * X[0].length);
    const splitValue = 0.5; // Punto de división simplificado
    
    // Dividimos los datos
    const leftIndices = [];
    const rightIndices = [];
    
    for (let i = 0; i < X.length; i++) {
      if (X[i][featureIndex] < splitValue) {
        leftIndices.push(i);
      } else {
        rightIndices.push(i);
      }
    }
    
    // Si no podemos dividir más, devolvemos un nodo hoja
    if (leftIndices.length === 0 || rightIndices.length === 0) {
      const leafValue = y.reduce((sum, val) => sum + val, 0) / y.length;
      return { type: 'leaf', value: leafValue };
    }
    
    // Preparamos los subconjuntos para los nodos hijos
    const X_left = leftIndices.map(i => X[i]);
    const y_left = leftIndices.map(i => y[i]);
    const X_right = rightIndices.map(i => X[i]);
    const y_right = rightIndices.map(i => y[i]);
    
    // Creamos recursivamente los nodos hijos
    const leftChild = this.createDecisionTree(X_left, y_left, max_depth, depth + 1);
    const rightChild = this.createDecisionTree(X_right, y_right, max_depth, depth + 1);
    
    // Devolvemos el nodo de decisión
    return {
      type: 'decision',
      featureIndex,
      splitValue,
      left: leftChild,
      right: rightChild
    };
  }
  
  traverseTree(node, sample) {
    // Si es un nodo hoja, devolvemos su valor
    if (node.type === 'leaf') {
      return node.value;
    }
    
    // Si es un nodo de decisión, navegamos al hijo correspondiente
    if (sample[node.featureIndex] < node.splitValue) {
      return this.traverseTree(node.left, sample);
    } else {
      return this.traverseTree(node.right, sample);
    }
  }
}

/**
 * Predice el precio de un vuelo utilizando el algoritmo de RandomForest
 * @param {Object} flightData - Datos del vuelo para la predicción
 * @returns {Promise<Object>} Predicción de precios y datos relacionados
 */
export const predictFlightPriceML = async (flightData) => {
  // Simulamos un retraso para imitar el procesamiento del modelo
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Generamos datos de entrenamiento simulados
    const { X_train, y_train } = generateTrainingData();
    
    // Creamos y entrenamos el modelo RandomForest
    const model = new RandomForestRegressor(20, 8); // 20 árboles, profundidad máxima 8
    model.fit(X_train, y_train);
    
    // Preparamos las características para la predicción
    const X_test = prepareFeatures(flightData);
    
    // Realizamos la predicción
    const predictedPrice = model.predict(X_test);
    const basePrice = Math.round(predictedPrice);
    
    // Calculamos factores que afectan el precio
    const seasonalityFactor = getSeasonalityFactor(flightData.departureDate);
    const advanceBookingFactor = 1 - getAdvanceBookingNormalized(flightData.departureDate); // Invertimos para que sea más intuitivo
    const routeFactor = getDistanceFactor(flightData.origin, flightData.destination);
    const cabinClassFactor = getCabinClassNormalized(flightData.cabinClass);
    
    // Calculamos el rango de precios
    const minPrice = Math.round(basePrice * 0.85);
    const maxPrice = Math.round(basePrice * 1.25);
    
    // Determinamos el mejor momento para reservar (días antes del vuelo)
    const bestTimeToBook = Math.floor(Math.random() * 30) + 14; // Entre 14 y 44 días
    
    // Nivel de confianza de la predicción
    const priceConfidence = Math.floor(Math.random() * 15) + 80; // Entre 80% y 95%
    
    // Generamos un historial de precios simulado para los últimos 6 meses
    const priceHistory = generatePriceHistory(basePrice);
    
    return {
      minPrice,
      maxPrice,
      bestTimeToBook,
      priceConfidence,
      priceHistory,
      // Información adicional sobre los factores que afectan el precio
      factors: {
        seasonality: (1 + seasonalityFactor).toFixed(2),
        advanceBooking: (1 + advanceBookingFactor).toFixed(2),
        route: (1 + routeFactor).toFixed(2),
        cabinClass: (1 + cabinClassFactor * 3).toFixed(2) // Multiplicamos por 3 para hacer más visible el efecto
      }
    };
  } catch (error) {
    console.error('Error en la predicción de precios con ML:', error);
    throw new Error('Error en la predicción de precios con ML');
  }
}

/**
 * Genera un historial de precios simulado para los últimos 6 meses
 * @param {number} basePrice - Precio base para generar la variación
 * @returns {Array} Historial de precios por mes
 */
function generatePriceHistory(basePrice) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map(month => {
    // Añadimos variación para simular cambios de precios a lo largo del tiempo
    const variation = 0.7 + (Math.random() * 0.6); // Entre 0.7 y 1.3
    return {
      month,
      price: Math.round(basePrice * variation)
    };
  });
}