// Base data structure with static information
const baseItineraries = [
  {
    id: 1,
    price: 1200,
    originalPrice: 1500,
    rating: 4.8,
    reviews: 124,
    image: "https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=500&h=300&fit=crop",
    category: "adventure",
    // Default fallback data
    title: "Aventura en los Andes Peruanos",
    destination: "Cusco, Perú",
    duration: "7 días",
    highlights: ["Machu Picchu", "Valle Sagrado", "Cusco Colonial", "Trekking"],
    description: "Descubre la magia de los Andes peruanos con este increíble viaje que combina historia, cultura y aventura en uno de los destinos más fascinantes del mundo.",
    travelers: "2-4",
    difficulty: "Moderado",
    includes: ["Vuelos domésticos", "Hoteles 4*", "Guía especializado", "Entradas a sitios arqueológicos", "Transporte privado"]
  },
  {
    id: 2,
    price: 2800,
    rating: 4.9,
    reviews: 89,
    image: "https://images.unsplash.com/photo-1502602898536-47ad22581b52?w=500&h=300&fit=crop",
    category: "romantic",
    // Default fallback data
    title: "Escapada Romántica a París",
    destination: "París, Francia",
    duration: "5 días",
    highlights: ["Torre Eiffel", "Louvre", "Crucero por el Sena", "Montmartre"],
    description: "Vive una experiencia romántica inolvidable en la Ciudad de la Luz con tu pareja, explorando los lugares más emblemáticos y disfrutando de la gastronomía francesa.",
    travelers: "2",
    difficulty: "Fácil",
    includes: ["Vuelos internacionales", "Hotel boutique 5*", "Desayunos incluidos", "Crucero por el Sena", "Cena romántica"]
  },
  {
    id: 3,
    price: 3500,
    originalPrice: 4200,
    rating: 4.7,
    reviews: 67,
    image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=500&h=300&fit=crop",
    category: "wildlife",
    title: "Safari en Kenia",
    destination: "Masai Mara, Kenia",
    duration: "8 días",
    highlights: ["Gran Migración", "Big Five", "Cultura Masai", "Globo aerostático"],
    description: "Experimenta la vida salvaje africana en su máximo esplendor con este safari único en una de las reservas más famosas del mundo.",
    travelers: "2-6",
    difficulty: "Moderado",
    includes: ["Vuelos internacionales", "Lodge de lujo", "Todas las comidas", "Safaris diarios", "Guía especializado"]
  },
  {
    id: 4,
    price: 4200,
    originalPrice: 5000,
    rating: 4.9,
    reviews: 156,
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=300&fit=crop",
    category: "relaxation",
    title: "Retiro de Lujo en Maldivas",
    destination: "Maldivas",
    duration: "6 días",
    highlights: ["Villa sobre el agua", "Spa de lujo", "Snorkel", "Cenas privadas"],
    description: "Relájate en el paraíso tropical con aguas cristalinas, playas de arena blanca y el mejor servicio de lujo.",
    travelers: "2",
    difficulty: "Fácil",
    includes: ["Vuelos internacionales", "Villa sobre el agua", "Todas las comidas", "Spa incluido", "Actividades acuáticas"]
  },
  {
    id: 5,
    price: 1800,
    rating: 4.6,
    reviews: 93,
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500&h=300&fit=crop",
    category: "adventure",
    title: "Trekking en Nepal",
    destination: "Himalaya, Nepal",
    duration: "12 días",
    highlights: ["Campo Base Everest", "Sherpa Culture", "Monasterios", "Vistas del Himalaya"],
    description: "Una aventura épica hacia el campo base del monte más alto del mundo, combinando desafío físico con belleza natural.",
    travelers: "4-8",
    difficulty: "Difícil",
    includes: ["Vuelos domésticos", "Alojamiento en teahouses", "Guía sherpa", "Permisos", "Equipo básico"]
  },
  {
    id: 6,
    price: 3200,
    originalPrice: 3800,
    rating: 4.8,
    reviews: 201,
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=500&h=300&fit=crop",
    category: "cultural",
    title: "Descubre Japón",
    destination: "Tokio-Kioto, Japón",
    duration: "10 días",
    highlights: ["Templos antiguos", "Cultura samurai", "Gastronomía", "Tecnología moderna"],
    description: "Sumérgete en la fascinante cultura japonesa, desde templos milenarios hasta la tecnología más avanzada.",
    travelers: "2-4",
    difficulty: "Fácil",
    includes: ["JR Pass", "Hoteles tradicionales", "Experiencias culturales", "Guía local", "Algunas comidas"]
  },
  {
    id: 7,
    price: 2100,
    rating: 4.7,
    reviews: 118,
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=500&h=300&fit=crop",
    category: "family",
    title: "Aventura Familiar en Costa Rica",
    destination: "Costa Rica",
    duration: "8 días",
    highlights: ["Volcanes activos", "Vida silvestre", "Canopy", "Playas del Pacífico"],
    description: "Perfecto para familias aventureras que buscan naturaleza, adrenalina y diversión en uno de los países más biodiversos.",
    travelers: "4-6",
    difficulty: "Fácil",
    includes: ["Hoteles familiares", "Actividades para niños", "Transporte privado", "Guía bilingüe", "Seguro de viaje"]
  },
  {
    id: 8,
    price: 1400,
    originalPrice: 1700,
    rating: 4.5,
    reviews: 87,
    image: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=500&h=300&fit=crop",
    category: "culinary",
    title: "Tour Gastronómico por Italia",
    destination: "Toscana, Italia",
    duration: "6 días",
    highlights: ["Catas de vino", "Clases de cocina", "Mercados locales", "Restaurantes auténticos"],
    description: "Descubre los sabores auténticos de Italia en un viaje gastronómico por la hermosa región de la Toscana.",
    travelers: "2-6",
    difficulty: "Fácil",
    includes: ["Hoteles boutique", "Cenas incluidas", "Catas de vino", "Clases de cocina", "Guía gastronómico"]
  }
]

// Function to get translated itineraries
export const getTranslatedItineraries = (t) => {
  return baseItineraries.map(itinerary => {
    const translatedData = t(`itineraries.${itinerary.id}`, { returnObjects: true })
    
    // Fallback to original data if translation fails
    if (!translatedData || typeof translatedData === 'string') {
      return itinerary
    }
    
    return {
      ...itinerary,
      title: translatedData.title || itinerary.title,
      destination: translatedData.destination || itinerary.destination,
      duration: translatedData.duration || itinerary.duration,
      highlights: translatedData.highlights || itinerary.highlights,
      description: translatedData.description || itinerary.description,
      travelers: translatedData.travelers || itinerary.travelers,
      difficulty: translatedData.difficulty || itinerary.difficulty,
      includes: translatedData.includes || itinerary.includes
    }
  })
}

// Legacy export for backward compatibility (uses Spanish as default)
export const mockItineraries = baseItineraries.map(itinerary => {
  // Default Spanish data for backward compatibility
  const spanishData = {
    1: {
      title: "Aventura en los Andes Peruanos",
      destination: "Cusco, Perú",
      duration: "7 días",
      highlights: ["Machu Picchu", "Valle Sagrado", "Cusco Colonial", "Trekking"],
      description: "Descubre la magia de los Andes peruanos con este increíble viaje que combina historia, cultura y aventura en uno de los destinos más fascinantes del mundo.",
      travelers: "2-4",
      difficulty: "Moderado",
      includes: ["Vuelos domésticos", "Hoteles 4*", "Guía especializado", "Entradas a sitios arqueológicos", "Transporte privado"]
    },
    2: {
      title: "Escapada Romántica a París",
      destination: "París, Francia",
      duration: "5 días",
      highlights: ["Torre Eiffel", "Louvre", "Crucero por el Sena", "Montmartre"],
      description: "Vive el romance en la Ciudad de la Luz con experiencias únicas y momentos inolvidables en los lugares más emblemáticos de París.",
      travelers: "2",
      difficulty: "Fácil",
      includes: ["Vuelos internacionales", "Hotel boutique 5*", "Cenas románticas", "Tours privados", "Crucero por el Sena"]
    },
    3: {
      title: "Safari Africano en Kenia",
      destination: "Masai Mara, Kenia",
      duration: "10 días",
      highlights: ["Gran Migración", "Big Five", "Cultura Masai", "Globo Aerostático"],
      description: "Experimenta la vida salvaje africana en su máximo esplendor con este safari inolvidable en uno de los parques más famosos del mundo.",
      travelers: "2-6",
      difficulty: "Moderado",
      includes: ["Vuelos internacionales", "Lodge de lujo", "Safaris diarios", "Vuelo en globo", "Visita cultural Masai"]
    },
    4: {
      title: "Relax en las Maldivas",
      destination: "Maldivas",
      duration: "6 días",
      highlights: ["Overwater Villa", "Spa de lujo", "Snorkel", "Cenas privadas"],
      description: "Disfruta del paraíso tropical en las Maldivas con aguas cristalinas, playas de arena blanca y el máximo lujo en el océano Índico.",
      travelers: "2",
      difficulty: "Fácil",
      includes: ["Vuelos internacionales", "Overwater villa", "Pensión completa", "Actividades acuáticas", "Spa treatments"]
    },
    5: {
      title: "Aventura en Patagonia",
      destination: "Torres del Paine, Chile",
      duration: "8 días",
      highlights: ["Torres del Paine", "Glaciar Grey", "Trekking", "Fauna silvestre"],
      description: "Explora uno de los paisajes más espectaculares del mundo en la Patagonia chilena con trekkings increíbles y vistas impresionantes.",
      travelers: "2-8",
      difficulty: "Difícil",
      includes: ["Vuelos domésticos", "Refugios de montaña", "Guía experto", "Equipo de trekking", "Transporte 4x4"]
    },
    6: {
      title: "Cultura y Gastronomía en Japón",
      destination: "Tokio y Kioto, Japón",
      duration: "12 días",
      highlights: ["Templos antiguos", "Sushi auténtico", "Ceremonia del té", "Monte Fuji"],
      description: "Sumérgete en la fascinante cultura japonesa combinando la modernidad de Tokio con la tradición milenaria de Kioto.",
      travelers: "2-4",
      difficulty: "Fácil",
      includes: ["JR Pass", "Hoteles tradicionales", "Tours gastronómicos", "Experiencias culturales", "Guía local"]
    },
    7: {
      title: "Aventura Familiar en Costa Rica",
      destination: "Costa Rica",
      duration: "9 días",
      highlights: ["Volcanes activos", "Canopy tours", "Vida silvestre", "Playas del Pacífico"],
      description: "Perfecto para familias aventureras que buscan conectar con la naturaleza en uno de los países más biodiversos del mundo.",
      travelers: "2-6",
      difficulty: "Fácil",
      includes: ["Hoteles eco-friendly", "Actividades familiares", "Transporte privado", "Guías naturalistas", "Seguro de viaje"]
    },
    8: {
      title: "Ruta del Vino en Argentina",
      destination: "Mendoza, Argentina",
      duration: "5 días",
      highlights: ["Bodegas premium", "Cata de vinos", "Cordillera de los Andes", "Gastronomía local"],
      description: "Descubre los mejores vinos del mundo en la región vitivinícola más importante de Argentina con paisajes de montaña espectaculares.",
      travelers: "2-4",
      difficulty: "Fácil",
      includes: ["Hotel boutique", "Tours de bodegas", "Catas premium", "Cenas maridaje", "Transporte privado"]
    }
  }
  
  const data = spanishData[itinerary.id]
  return {
    ...itinerary,
    ...data
  }
})

export const getItinerariesByCategory = (category, t) => {
  const itineraries = t ? getTranslatedItineraries(t) : mockItineraries
  if (!category) return itineraries
  return itineraries.filter(itinerary => itinerary.category === category)
}

export const getItinerariesByPriceRange = (minPrice, maxPrice, t) => {
  const itineraries = t ? getTranslatedItineraries(t) : mockItineraries
  return itineraries.filter(itinerary => 
    itinerary.price >= minPrice && itinerary.price <= maxPrice
  )
}

export const searchItineraries = (searchTerm, t) => {
  const itineraries = t ? getTranslatedItineraries(t) : mockItineraries
  if (!searchTerm) return itineraries
  
  const term = searchTerm.toLowerCase()
  return itineraries.filter(itinerary =>
    itinerary.title.toLowerCase().includes(term) ||
    itinerary.destination.toLowerCase().includes(term) ||
    itinerary.description.toLowerCase().includes(term) ||
    itinerary.highlights.some(highlight => highlight.toLowerCase().includes(term))
  )
}

