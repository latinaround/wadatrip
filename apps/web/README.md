# WADATRIP - Plataforma Integral de Viajes

##  Descripción

Wadatrip es una plataforma moderna de viajes desarrollada con React y Vite, que combina las mejores funcionalidades de búsqueda de itinerarios con características avanzadas integradas del proyecto Flutter, incluyendo notificaciones inteligentes, validación robusta y una experiencia de usuario mejorada.

##  Características Principales

###  Funcionalidades de Búsqueda
- **Búsqueda Básica**: Encuentra itinerarios por destino, presupuesto e intereses
- **Búsqueda Mejorada**: Formulario avanzado con validación en tiempo real
- **Filtros Inteligentes**: Ordenamiento por precio, duración y popularidad
- **Resultados Dinámicos**: Carga de resultados con animaciones suaves

###  Sistema de Notificaciones
- **Notificaciones Push**: Alertas en tiempo real para cambios de precios
- **Gestión de Alertas**: Crear, pausar y eliminar alertas de vuelos
- **Notificaciones Personalizadas**: Recordatorios de viajes e itinerarios guardados
- **Configuración Flexible**: Control total sobre tipos y frecuencia de notificaciones

###  Validación Avanzada
- **Validación de Email**: Verificación de formato y dominio
- **Validación de Teléfono**: Soporte para formatos internacionales
- **Validación de Fechas**: Verificación de fechas de inicio válidas
- **Validación de Presupuesto**: Rangos de presupuesto realistas
- **Validación de Edad**: Verificación de edad mínima para viajes

###  Sistema de Colores Integrado
- **Paleta Consistente**: Colores principales, neutrales y de estado
- **Gradientes Modernos**: Efectos visuales atractivos
- **Sombras Dinámicas**: Profundidad visual mejorada
- **Funciones de Utilidad**: Manejo de opacidad y colores personalizados

###  Internacionalización
- **Múltiples Idiomas**: Español, Inglés, Francés, Alemán
- **Cambio Dinámico**: Selector de idioma en tiempo real
- **Contenido Localizado**: Traducciones completas de la interfaz

##  Tecnologías Utilizadas

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Routing**: React Router DOM
- **Internacionalización**: react-i18next
- **Iconos**: Lucide React
- **Animaciones**: Framer Motion
- **Validación**: Zod + validadores personalizados
- **Notificaciones**: API de Notifications del navegador

##  Estructura del Proyecto

```
wadatrip/
 public/                 # Archivos estáticos
 src/
    components/         # Componentes React
       ui/            # Componentes de UI base
       Header.jsx     # Navegación principal
       Hero.jsx       # Sección hero
       EnhancedSearchForm.jsx  # Formulario mejorado
       FlightPriceNotifications.jsx  # Gestión de alertas
    pages/             # Páginas de la aplicación
    utils/             # Utilidades integradas
       validator.js   # Sistema de validación
       colors.js      # Sistema de colores
       notifications.js  # Servicio de notificaciones
    config/            # Configuración de la aplicación
       appConfig.js   # Configuración centralizada
    data/              # Datos mock y estáticos
    hooks/             # Hooks personalizados
    lib/               # Librerías y configuraciones
    App.jsx            # Componente principal
    main.jsx           # Punto de entrada
 package.json           # Dependencias y scripts
 README.md             # Documentación
```

##  Instalación y Configuración

### Prerrequisitos
- Node.js (versión 16 o superior)
- pnpm (recomendado) o npm

### Pasos de Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/wadatrip.git
   cd wadatrip
   ```

2. **Instalar dependencias**
   ```bash
   pnpm install
   # o
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   # Editar .env con tus configuraciones
   ```

4. **Ejecutar en modo desarrollo**
   ```bash
   pnpm dev
   # o
   npm run dev
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:5173
   ```

##  Nuevas Rutas Disponibles

- `/` - Página principal con búsqueda básica
- `/enhanced-search` - Formulario de búsqueda avanzado
- `/flight-notifications` - Gestión de alertas de vuelos
- `/products` - Página de productos
- `/solutions` - Página de soluciones
- `/price-alerts` - Alertas de precios (página original)
- `/contact` - Página de contacto
- `/about-us` - Acerca de nosotros
- `/privacy-policy` - Política de privacidad
- `/request-demo` - Solicitar demo

##  Configuración Avanzada

### Personalización de Colores
Edita `src/utils/colors.js` para personalizar la paleta de colores:

```javascript
export const AppColors = {
  primary: {
    main: '#0D9488',    // Teal principal
    light: '#5EEAD4',   // Teal claro
    dark: '#134E4A'     // Teal oscuro
  }
  // ... más colores
}
```

### Configuración de Notificaciones
Modifica `src/config/appConfig.js` para ajustar las notificaciones:

```javascript
notifications: {
  enabled: true,
  defaultDuration: 5000,
  position: 'top-right',
  maxNotifications: 5
}
```

### Validación Personalizada
Extiende `src/utils/validator.js` para agregar nuevas validaciones:

```javascript
static validateCustomField(value) {
  // Tu lógica de validación personalizada
  return { isValid: true, message: '' }
}
```

##  Características Responsivas

- **Mobile First**: Diseño optimizado para dispositivos móviles
- **Breakpoints**: Tablet (768px), Desktop (1024px), Large (1280px)
- **Navegación Adaptativa**: Menú hamburguesa en móviles
- **Componentes Flexibles**: Adaptación automática al tamaño de pantalla

##  Seguridad

- **Validación del Cliente**: Verificación en tiempo real de inputs
- **Sanitización**: Limpieza de datos de entrada
- **Rate Limiting**: Protección contra spam y ataques
- **CSRF Protection**: Protección contra ataques de falsificación

##  Scripts Disponibles

```bash
# Desarrollo
pnpm dev          # Servidor de desarrollo
pnpm build        # Construcción para producción
pnpm preview      # Vista previa de la construcción
pnpm lint         # Verificación de código
```

##  Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

##  Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

##  Soporte

Para soporte técnico o consultas:
- Email: soporte@wadatrip.com
- Website: https://wadatrip.com
- Documentación: https://docs.wadatrip.com

##  Agradecimientos

- Equipo de desarrollo de Wadatrip
- Comunidad de React y Vite
- Contribuidores del proyecto Flutter original
- Usuarios beta que proporcionaron feedback valioso

---

**Desarrollado con  por el equipo de Wadatrip**
Autenticación y flujo completo
------------------------------

1. Copia `.env.example` a `.env.local` y ajusta:
   ```bash
   VITE_API_BASE_URL=http://localhost:3000
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxx
   ```
2. Instala dependencias (`pnpm install`) y levanta con `pnpm dev`.
3. Desde la UI:
   - Usa el botón "Iniciar sesión" para autenticarse (`demo@wadatrip.local / wadatrip123` del seed).
   - Al generar un itinerario, el frontend llama a `POST /itineraries/generate` con Travelpayouts real.
   - Al pulsar "Reservar este plan" se crea un intent (`/payments/create-intent`) y se abre el modal de Stripe.
4. Si el backend está en modo mock de Stripe aparecerá un aviso y podrás completar la reserva de demostración sin pagar.

Recomendaciones de estabilidad
------------------------------

- Define `VITE_STRIPE_PUBLISHABLE_KEY` sólo cuando el backend tenga `STRIPE_SECRET_KEY`; caso contrario el checkout usa modo demo.
- Para ambientes compartidos deshabilita el recorder mock con `FF_REAL_ACTIVITIES=false` (las actividades siguen mock hasta integrar Viator).
- Si necesitas prueba multiusuario, los tokens se guardan en `localStorage` (`wadatrip_token`). Limpia storage o usa navegadores/secciones privadas.

## Avances recientes (2025-10-06)
- Dashboard de cuenta con tarjetas de resumen de viajes, pagos pendientes y total invertido.
- Listado de reservas conectado al backend con actualizacion manual y estados de pago.
- Historial de pagos normalizado mostrando intents exitosos o en modo demo.
- Panel de itinerarios guardados con esqueletos de carga y acceso directo al generador.
