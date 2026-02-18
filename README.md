# Cameyo Backend

[![Board Status](https://dev.azure.com/IETI-2026/274af8c4-da42-437c-bcc5-e1fd036735dc/903fa6df-818d-43f8-9588-7da2bb3fe00b/_apis/work/boardbadge/05102f46-79e6-44df-950a-0936b748d8a9)](https://dev.azure.com/IETI-2026/274af8c4-da42-437c-bcc5-e1fd036735dc/_boards/board/t/903fa6df-818d-43f8-9588-7da2bb3fe00b/Microsoft.RequirementCategory)

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

## 📋 Descripción del Proyecto

### ¿Qué es CameYo?

**CameYo** es una plataforma móvil innovadora que conecta personas que necesitan servicios técnicos (plomería, cerrajería, electricidad, etc.) con trabajadores independientes verificados en su misma región (pueblo/municipio). Nuestra misión es promover la economía local y facilitar el acceso rápido a soluciones confiables, especialmente en municipios pequeños de Colombia.

### 🎯 Problema y Oportunidad Identificada

#### Problema

- **Falta de acceso a servicios urgentes**: En Colombia, especialmente en municipios pequeños, las personas frecuentemente necesitan servicios técnicos urgentes y no saben a quién acudir.
- **Desconfianza en extraños**: Al contratar trabajadores desconocidos que deben ingresar al hogar, existe una preocupación legítima por la seguridad.
- **Dificultad para encontrar clientes**: Muchos trabajadores operan de manera informal y les resulta difícil conseguir clientes, especialmente si están comenzando o no son conocidos en el sector.

#### Oportunidad

- **Mercado poco explorado**: El sector de servicios técnicos en regiones aledañas a las ciudades principales de Colombia y Latinoamérica está subatendido digitalmente.
- **Digitalización creciente**: La adopción de plataformas digitales y la integración de billeteras digitales (Nequi, Daviplata) en Colombia permite facilitar pagos inmediatos.
- **Alta informalidad laboral**: Representa una oportunidad para integrar tecnología que amplíe las conexiones de trabajadores y les brinde mayores oportunidades.
- **Demanda de inmediatez**: Los usuarios digitalizados prefieren soluciones inmediatas sin necesidad de desplazarse, similar a Rappi o Uber, pero actualmente no existe una solución equivalente para oficios técnicos.
- **Diferenciación**: Las plataformas existentes están enfocadas en grandes ciudades, trabajo virtual o no incluyen verificación de seguridad.

### 💡 Solución y Propuesta de Valor

CameYo ofrece una aplicación móvil que beneficia tanto a clientes como a técnicos:

#### Para Clientes

- **Descripción asistida por IA**: Los clientes describen su problema y nuestra IA lo categoriza automáticamente en uno de los servicios disponibles y determina el nivel de urgencia.
- **Elección de técnico**: Visualización de técnicos disponibles en la región con sus calificaciones y perfiles, permitiendo al cliente elegir quién realizará el servicio.
- **Múltiples métodos de pago**: Integración con billeteras digitales (Nequi, Daviplata), tarjetas, transferencias bancarias y efectivo.
- **Sistema de calificación**: Evaluación del servicio recibido para construir confianza en la plataforma.

#### Para Técnicos

- **Registro y verificación**: Los técnicos se registran y su identidad es validada mediante documento de identidad, incluyendo verificación de antecedentes para garantizar seguridad.
- **Múltiples categorías**: Posibilidad de ofrecer servicios en varias categorías según sus habilidades.
- **Trabajo local garantizado**: Los servicios son siempre dentro de la misma zona geográfica del técnico.
- **Construcción de reputación**: Sistema de calificaciones que permite construir credibilidad y obtener más oportunidades.

### 🌟 Propuesta de Valor Única

1. **Enfoque en municipios locales**: No solo grandes ciudades, sino pueblos y zonas rurales de Colombia.
2. **Cliente elige al técnico**: Libertad de selección basada en perfil, calificaciones y disponibilidad.
3. **Verificación de antecedentes**: Revisión de identidad y antecedentes para garantizar seguridad de los clientes.
4. **Categorización inteligente con IA**: Procesamiento de lenguaje natural para entender y clasificar automáticamente las necesidades expresadas por los clientes.
5. **Integración con pagos digitales populares**: Nequi y Daviplata, ampliamente utilizados en Colombia.

### 🔧 Stack Tecnológico

Este backend está construido con tecnologías modernas para garantizar **escalabilidad, seguridad y eficiencia**:

#### Backend (Este Repositorio)

- **Framework**: NestJS con TypeScript para un desarrollo robusto y mantenible
- **Arquitectura**: Hexagonal (Clean Architecture) con separación clara de responsabilidades
- **Base de Datos**: PostgreSQL con modelo multi-tenant y filtrado por regiones con geolocalización
- **ORM**: Prisma para gestión de base de datos y migraciones
- **Autenticación**: JWT (JSON Web Tokens) con Passport
- **Validación**: class-validator para DTOs
- **Documentación**: Swagger/OpenAPI automático
- **Testing**: Jest para pruebas unitarias y e2e

#### Integraciones Planificadas

- **IA/NLP**: Procesamiento de lenguaje natural para categorización automática de solicitudes
- **Pasarelas de Pago**: Nequi, Daviplata y procesamiento de tarjetas
- **Geolocalización**: Sistema de matching por proximidad geográfica
- **Sistema de Calificaciones**: Algoritmos de recomendación basados en promedio de calificaciones

#### Frontend (Separado)

- **Móvil**: Flutter para aplicaciones nativas iOS y Android

#### Seguridad y Cumplimiento

- **Protección de Datos**: Cumplimiento con la Ley 1581 de 2012 (Protección de Datos Personales en Colombia)
- **Verificación de Identidad**: Integración con bases de datos de antecedentes
- **Encriptación**: JWT para tokens de sesión y bcrypt para contraseñas

### 🏗️ Características Técnicas del Backend

- 🏗️ **Arquitectura Hexagonal**: Separación clara entre capas de dominio, aplicación, infraestructura y presentación
- 🏢 **Multi-Tenancy Automático**: Aislamiento de datos por tenant usando schemas de PostgreSQL con provisionamiento on-demand
- 🔐 **Autenticación JWT**: Sistema de autenticación seguro con Passport y JWT
- 📊 **ORM Prisma**: Gestión de base de datos con migraciones automáticas
- 📝 **Documentación Swagger**: API documentada automáticamente
- ✅ **Testing**: Cobertura de pruebas unitarias y e2e
- 🔍 **Validación**: Validación de DTOs con class-validator
- 🚀 **CI/CD**: Pipeline automatizado con GitHub Actions

## 🛠️ Tecnologías y Versiones

### Runtime y Lenguaje

- **Node.js**: v20.x (LTS)
- **TypeScript**: v5.7.3
- **NestJS**: v11.0.1

### Dependencias Principales

| Dependencia         | Versión | Propósito                      |
| ------------------- | ------- | ------------------------------ |
| `@nestjs/core`      | ^11.0.1 | Framework principal            |
| `@nestjs/common`    | ^11.0.1 | Utilidades comunes de NestJS   |
| `@nestjs/config`    | ^4.0.3  | Gestión de configuración       |
| `@nestjs/jwt`       | ^11.0.2 | Autenticación JWT              |
| `@nestjs/passport`  | ^11.0.5 | Estrategias de autenticación   |
| `@nestjs/swagger`   | ^11.2.6 | Documentación API              |
| `@prisma/client`    | ^6.1.0  | ORM y cliente de base de datos |
| `prisma`            | ^6.1.0  | CLI de Prisma                  |
| `pg`                | ^8.18.0 | Driver de PostgreSQL           |
| `bcrypt`            | ^6.0.0  | Hash de contraseñas            |
| `class-validator`   | ^0.14.3 | Validación de DTOs             |
| `class-transformer` | ^0.5.1  | Transformación de objetos      |
| `passport-jwt`      | ^4.0.1  | Estrategia JWT para Passport   |

### Dependencias de Desarrollo

| Dependencia         | Versión | Propósito                       |
| ------------------- | ------- | ------------------------------- |
| `@biomejs/biome`    | 2.3.15  | Linter y formateador de código  |
| `jest`              | ^30.0.0 | Framework de testing            |
| `supertest`         | ^7.0.0  | Testing de endpoints HTTP       |
| `ts-jest`           | ^29.2.5 | Soporte de TypeScript para Jest |
| `typescript-eslint` | ^8.20.0 | Linting para TypeScript         |

## 📦 Instalación

### Prerequisitos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js v20.x o superior**: [Descargar Node.js](https://nodejs.org/)
- **npm v10.x o superior**: Incluido con Node.js
- **PostgreSQL v14 o superior**: [Descargar PostgreSQL](https://www.postgresql.org/download/)
- **Git**: [Descargar Git](https://git-scm.com/)

### Pasos de Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/IETI-2026/backend.git

cd backend
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Database
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/nombre_base_datos?schema=public"

# JWT
JWT_SECRET="tu-clave-secreta-super-segura"
JWT_EXPIRES_IN="24h"

# Application
PORT=3000
NODE_ENV="development"

# Azure Agent (clasificación de problema -> categoría/urgencia)
AZURE_AGENT_ENDPOINT="https://procesador-de-lenguaje-natural.cognitiveservices.azure.com/..."
AZURE_AGENT_API_KEY="tu-api-key"
AZURE_AGENT_API_VERSION="2024-12-01-preview"
```

4. **Generar el cliente de Prisma**

```bash
npm run prisma:generate
```

5. **Ejecutar migraciones de base de datos**

```bash
npm run prisma:migrate
```

6. **(Opcional) Pre-provisionar tenants**

Los tenants se crean automáticamente cuando se recibe una petición, pero si deseas crear algunos tenants de antemano, edita el archivo `prisma/migrate-tenants.js` y ejecuta:

```bash
node prisma/migrate-tenants.js
```

## 🚀 Ejecución del Proyecto

### Modo Desarrollo

```bash
npm run start:dev
```

La aplicación estará disponible en `http://localhost:3000`

### Modo Producción

```bash
# Compilar el proyecto
npm run build

# Ejecutar en producción
npm run start:prod
```

### Otros Comandos Útiles

```bash
# Iniciar en modo debug
npm run start:debug

# Ver la base de datos con Prisma Studio
npm run prisma:studio
```

## 📚 Documentación de la API

Una vez la aplicación esté corriendo, puedes acceder a la documentación Swagger en:

```
http://localhost:3000/api/docs
```

## 🧪 Testing

El proyecto incluye pruebas unitarias y e2e (end-to-end) con Jest.

### Ejecutar Pruebas

```bash
# Pruebas unitarias
npm run test

# Pruebas en modo watch
npm run test:watch

# Cobertura de código
npm run test:cov

# Pruebas e2e
npm run test:e2e

# Modo debug para pruebas
npm run test:debug
```

### Estructura de Pruebas

- **Pruebas unitarias**: Ubicadas junto a los archivos fuente con extensión `.spec.ts`
- **Pruebas e2e**: Ubicadas en el directorio `/test`

## 🤝 Cómo Contribuir

### Flujo de Trabajo con Git

1. **Clona el repositorio**

```bash
git clone https://github.com/IETI-2026/backend.git

cd backend
```

2. **Crea una rama para tu feature**

```bash
git checkout -develop
git pull origin develop
git checkout -b feature/nombre-descriptivo
```

3. **Realiza tus cambios siguiendo las convenciones**

### Estándares de Código

Este proyecto utiliza **Biome** para linting y formateo de código. Todos los commits deben pasar las validaciones de formato y lint.

#### Formatear Código

```bash
# Formatear todo el código
npm run format
```

#### Verificar Lint

```bash
# Verificar problemas de lint
npm run lint
```

### Configuración de Husky (Git Hooks)

**Nota**: El proyecto está configurado para usar Husky para ejecutar validaciones automáticas antes de cada commit.

Para configurar Husky en tu entorno local:

```bash
# Instalar Husky (si no está configurado)
npm install husky --save-dev
npx husky init

# Configurar pre-commit hook
echo "npm run format && npm run lint" > .husky/pre-commit

# Configurar pre-push hook (opcional)
echo "npm run test" > .husky/pre-push
```

Los hooks ejecutarán automáticamente:

- **Pre-commit**: Formateo y lint del código
- **Pre-push**: Pruebas unitarias (opcional)

### Commits Convencionales

Usa el formato de commits convencionales:

```
tipo(scope): mensaje descriptivo

feat(users): agregar endpoint para listar usuarios
fix(auth): corregir validación de tokens expirados
docs(readme): actualizar instrucciones de instalación
test(users): agregar pruebas para UserService
refactor(auth): simplificar lógica de autenticación
```

Tipos válidos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Requests

1. Asegúrate de que todas las pruebas pasen
2. Actualiza la documentación si es necesario
3. Crea un Pull Request hacia la rama `develop`
4. Espera la revisión de código

## 🔄 CI/CD Pipelines

El proyecto utiliza **GitHub Actions** para integración y entrega continua. El pipeline se ejecuta automáticamente en:

- Cada push a la rama `develop`
- Cada Pull Request hacia `develop`

### Jobs del Pipeline

#### 1. **Lint and Format Check**

Verifica el estilo y calidad del código usando Biome.

```yaml
- Checkout del código
- Configurar Node.js 20
- Instalar dependencias
- Generar cliente de Prisma
- Ejecutar Biome lint
```

#### 2. **Tests**

Ejecuta pruebas unitarias y e2e con una base de datos PostgreSQL en contenedor.

```yaml
- Levantar PostgreSQL 16 como servicio
- Checkout del código
- Configurar Node.js 20
- Instalar dependencias
- Generar cliente de Prisma
- Ejecutar migraciones
- Ejecutar pruebas unitarias
- Ejecutar pruebas e2e
```

#### 3. **Build**

Compila la aplicación y genera los artefactos de producción.

```yaml
- Checkout del código
- Configurar Node.js 20
- Instalar dependencias
- Generar cliente de Prisma
- Compilar aplicación
- Verificar artefactos (directorio dist)
- Subir artefactos para despliegue
```

#### 4. **Security Audit**

Ejecuta auditoría de seguridad en las dependencias.

```yaml
- Checkout del código
- Configurar Node.js 20
- Ejecutar npm audit
```

### Ver Estado del Pipeline

Puedes ver el estado de los pipelines en:

- Badge de Azure Boards en la parte superior del README
- Pestaña "Actions" en el repositorio de GitHub

## 🏢 Multi-Tenancy Setup

Esta aplicación utiliza **schemas de PostgreSQL** para el aislamiento de datos por tenant con **provisionamiento automático on-demand**.

### ✨ Provisionamiento Automático

Los tenants se crean automáticamente cuando se recibe una petición con un tenant que no existe. **No es necesario provisionar manualmente** los schemas antes de usarlos.

Cuando se detecta un nuevo tenant:

1. Se crea automáticamente el schema en PostgreSQL
2. Se aplican todas las migraciones de Prisma al nuevo schema
3. Se establece la conexión y se procesa la petición normalmente

Esto permite:

- ✅ Onboarding inmediato de nuevos clientes
- ✅ Simplificación del proceso de despliegue
- ✅ Escalabilidad dinámica sin intervención manual

### Identificación de Tenants

Los tenants se identifican mediante:

1. **Header HTTP `X-Tenant-ID`** (prioridad más alta)

   ```bash
   curl -H "X-Tenant-ID: mi-empresa" http://localhost:3000/api/users
   ```

   Si el tenant `mi-empresa` no existe, se creará automáticamente en la primera petición.

2. **Subdomain del header `Host`**

   ```
   acme.example.com → tenant: acme
   ```

3. **Schema `public`** (fallback por defecto)

### Crear Nuevos Tenants

Hay dos formas de crear un tenant:

#### Opción 1: Automático (Recomendado)

Simplemente envía una petición con el header `X-Tenant-ID` con el nombre del nuevo tenant:

```bash
curl -X GET http://localhost:3000/api/users \
  -H "X-Tenant-ID: nuevo-tenant" \
  -H "Authorization: Bearer <token>"
```

El sistema detectará que el tenant no existe y lo creará automáticamente.

#### Opción 2: Pre-provisionar (Opcional)

Si prefieres crear tenants de manera anticipada, puedes usar el script de provisión:

1. Editar el array `TENANTS` en `prisma/migrate-tenants.js`:

   ```javascript
   const TENANTS = ["public", "tenant1", "tenant2"];
   ```

2. Ejecutar el script:
   ```bash
   node prisma/migrate-tenants.js
   ```

### Restricciones de Seguridad

Para prevenir ataques, los tenant IDs deben cumplir:

- Solo letras minúsculas, números, guiones (`-`) y guiones bajos (`_`)
- Patrón regex: `/^[a-z0-9_-]+$/`
- Los IDs inválidos son rechazados con error `400 Bad Request`

## 📋 Planeación del Proyecto

### Roadmap de Sprints

El proyecto se desarrolla en 7 sprints iterativos, cada uno enfocado en funcionalidades específicas:

| Sprint       | Funcionalidades Principales                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| **Sprint 1** | Planeación y arquitectura, Crear repositorios, Conectar base de datos                                |
| **Sprint 2** | Autenticación y registro con JWT, Implementación de roles, Solicitar servicios                       |
| **Sprint 3** | Gestión de servicios y categorías, Listar técnicos disponibles, Sistema de calificación              |
| **Sprint 4** | Integración de NLP, Filtros por urgencia y ubicación, Flujo del pago                                 |
| **Sprint 5** | Sistemas de matching y reputación, Geolocalización, Billeteras digitales                             |
| **Sprint 6** | Integración de pasarela de pagos, Verificación de antecedentes, Encriptación de información sensible |
| **Sprint 7** | Seguridad y tratamiento de datos, Cumplimiento normativas                                            |

### Documentación Adicional

Para documentos de diseño, arquitectura y decisiones técnicas:

**🔗 [Documento de Planeación](https://pruebacorreoescuelaingeduco-my.sharepoint.com/:i:/g/personal/juan_velasquez-r_mail_escuelaing_edu_co/IQDmPPRHhVWhQoyut3db0xxqAZ2Zay4Q4XRMQPExq-zfL1s?e=LrSZ9d)**

Este documento incluye:

- Backlog detallado del producto
- Historias de usuario con criterios de aceptación
- Arquitectura del sistema
- Diagramas de base de datos
- Decisiones técnicas y ADRs (Architecture Decision Records)
- Roadmap del proyecto detallado

## 📚 Recursos Adicionales

### NestJS

- [Documentación oficial de NestJS](https://docs.nestjs.com)
- [Discord de NestJS](https://discord.gg/G7Qnnhy)
- [Cursos oficiales](https://courses.nestjs.com/)

### Prisma

- [Documentación de Prisma](https://www.prisma.io/docs)
- [Guía de Multi-tenancy](https://www.prisma.io/docs/guides/database/multi-tenant-applications)

### TypeScript

- [Documentación de TypeScript](https://www.typescriptlang.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

## 📄 Licencia

Este proyecto es privado y confidencial. Todos los derechos reservados.

---

**¿Tienes preguntas?** Abre un issue o contacta al equipo de desarrollo.
