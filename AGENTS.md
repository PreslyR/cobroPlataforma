# AGENTS.md

## Propósito del producto
Construir y mantener una herramienta seria para gestión de préstamos.
El usuario principal es el prestamista. El sistema debe ayudarle a operar su negocio desde el teléfono con claridad, rapidez y trazabilidad financiera.

Este proyecto NO es una plataforma educativa.
Este proyecto NO está priorizando portal de clientes por ahora.

## Fuente de verdad documental
Para trabajar con criterio en este repo, usar esta separacion:
- `AGENTS.md`: producto, prioridades, UX y criterio de decision
- `ARCHITECTURE.md`: estructura tecnica, ownership de modulos y fronteras del sistema
- `spec/README.md`: indice de la especificacion
- `spec/contracts.md`: contratos de datos y expectativas de API
- `spec/domain.md`: reglas de negocio
- `spec/validation.md`: matriz de validacion y cobertura esperada

Regla practica:
- no mezclar arquitectura con dominio
- no mezclar dominio con validacion
- no cerrar cambios de negocio sin revisar la spec y los tests

Si hay tension entre estos documentos, no improvisar: ajustar el codigo o actualizar la documentacion para que queden alineados.

## Usuario principal
- Prestamista / cobrador / administrador del negocio
- Usa principalmente el celular
- Necesita saber:
  - a quién cobrar hoy
  - quién está atrasado
  - cuánto produce el negocio
  - cuánto debe cada préstamo
  - cuánto debe pagar un cliente para saldar

## Alcance actual del producto
Prioridad actual:
- experiencia del prestamista
- vistas operativas
- reportes básicos
- registro de préstamos y pagos

No priorizar todavía:
- portal de clientes
- automatizaciones complejas en background
- refinamiento de `DAILY_INTEREST`

## Estado actual del backend
El repo hoy es un backend NestJS + Prisma + PostgreSQL.
La lógica financiera vive en el servidor.
El frontend todavía no existe en este repo.

### Tipos de préstamo activos
- `FIXED_INSTALLMENTS`
- `MONTHLY_INTEREST`

### Tipo no prioritario por ahora
- `DAILY_INTEREST`

## Reglas de negocio que el frontend debe respetar
1. El frontend no calcula capital, interés ni mora.
2. El frontend consume resultados del backend y los presenta.
3. Toda decisión financiera debe salir de endpoints explícitos.
4. Para liquidaciones anticipadas usar `payoff-preview`, no cálculos locales.
5. No mezclar en la UI conceptos distintos:
   - capital pendiente
   - interés pendiente
   - mora pendiente
   - total cobrable hoy

## Principios de producto
1. Mobile-first siempre.
2. El flujo principal debe ser rápido para cobrar.
3. La información más útil debe aparecer primero.
4. Menos pantallas, más claridad.
5. Evitar visuales genéricas tipo dashboard SaaS sin contexto.
6. Priorizar legibilidad y operación por encima de adornos.

## Orden de construcción recomendado
1. `Dashboard`
2. `Cartera`
3. `Detalle de Préstamo`
4. `Registrar Pago`
5. `Crear Préstamo`
6. `Reportes`
7. `Clientes`
8. `Detalle de Cliente`

## Dashboard actual
Primera vista prioritaria del prestamista.

### Objetivo
Permitir abrir la app y entender de inmediato:
- cuánto se puede cobrar hoy
- cuántos préstamos vencen hoy
- cuántos están atrasados
- cuánto se ha generado/cobrado en el período

### Layout aprobado
1. Encabezado
2. Cards de métricas
3. Acciones rápidas
4. Sección `Cobros de Hoy`
5. Sección `Atrasados`

### Endpoint principal
- `GET /api/dashboard/today?date=YYYY-MM-DD&lenderId=...`

## Endpoints operativos ya disponibles
- `GET /api/dashboard/today`
- `GET /api/loans`
- `GET /api/loans/due-today`
- `GET /api/loans/overdue`
- `GET /api/loans/:id`
- `GET /api/loans/:id/summary`
- `GET /api/loans/:id/debt-breakdown`
- `GET /api/loans/:id/payoff-preview`
- `POST /api/loans`
- `GET /api/payments`
- `GET /api/payments/simulate/:loanId`
- `POST /api/payments`
- `GET /api/reports/interest-income`
- `GET /api/reports/portfolio-summary`
- `GET /api/clients`
- `GET /api/clients/:id`

## Criterios para cualquier frontend futuro
Si se construye frontend dentro o fuera de este repo:
- preferir web mobile-first
- pensar en PWA antes que app nativa
- mantener navegación simple
- evitar depender de desktop para tareas clave

### Recomendación de stack
Si no se ha definido otra cosa:
- Next.js
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form + Zod

No tratar esta sección como verdad absoluta si luego se define otra stack de forma explícita.

## Reglas de UX
- Toda vista debe resolver `loading`, `error`, `empty` y `success`.
- Las acciones principales deben quedar visibles.
- El prestamista debe poder llegar a registrar un pago con muy pocos toques.
- No sobrecargar con métricas secundarias.
- Toda cifra importante debe verse como moneda bien formateada.

## Reglas visuales
- Interfaz sobria, clara y profesional.
- Nada de look “demo” o “plantilla genérica”.
- Jerarquía tipográfica clara.
- Espaciado consistente.
- Estados de atraso, cobro y saldo deben ser visualmente obvios.
- No usar decoración sin propósito.

## Definición de terminado para una vista
Una vista no está lista si le falta cualquiera de estos:
- responsive real en móvil
- consumo correcto de endpoint real
- estados `loading/error/empty`
- navegación clara
- copy coherente con el negocio
- separación razonable de componentes
- uso correcto de la terminología financiera del sistema

## Antipatrones prohibidos
- Calcular deuda en frontend
- Hardcodear cifras de negocio
- Duplicar lógica del backend en componentes
- Mezclar capital, mora e intereses en una sola cifra sin etiqueta
- Diseñar para desktop primero
- Introducir features para clientes antes de cerrar bien la operación del prestamista
- Crear pantallas “bonitas” pero inútiles para cobrar

## Cómo trabajar en este repo
Cuando implementes algo:
1. Define la pantalla o flujo.
2. Mapea el endpoint real que la alimenta.
3. Verifica si el backend ya devuelve lo necesario.
4. Si falta algo, primero ajusta el contrato de API.
5. Luego construye la vista.

## Criterio de decisión
Ante dos opciones, preferir:
- claridad sobre complejidad
- operación real sobre adornos
- mobile-first sobre desktop-first
- backend como fuente de verdad sobre cálculos locales
- flujo del prestamista sobre features futuras para clientes

