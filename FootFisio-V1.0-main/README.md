# FootFisio — Clínica de fisioterapia + gestión clínica

FootFisio reúne una web pública para pacientes y un panel interno para administrar la clínica. La interfaz está desarrollada con React, TypeScript y Vite; los datos se almacenan en NocoDB Cloud.

## Incluye

### Web pública
- Inicio con presentación de la clínica.
- Secciones de servicios, nosotros, especialistas y contacto.
- Acceso directo a solicitud de cita.
- Diseño adaptable a computadoras, tabletas y móviles.

### Solicitud de citas
- Solicitud sin crear una cuenta.
- Registro de nombre, correo, teléfono, fecha, hora, tratamiento y profesional.
- Validación básica de horarios ocupados para el mismo profesional.
- La cita queda en estado **En espera** hasta que recepción la revise.
- El contacto se incorpora al listado de pacientes si aún no existe.

### Panel interno
- Roles de administrador, terapeuta y recepcionista.
- Inicio, agenda, pacientes, historial, pagos, reportes, usuarios y secuencias.
- Persistencia de los módulos existentes mediante NocoDB.

## Arquitectura

- Frontend: React + TypeScript + Vite.
- Base de datos: NocoDB Cloud.
- Proxy seguro: Cloudflare Pages Functions en `functions/api/nocodb/[[path]].ts`.
- No utiliza MySQL ni un servidor Express propio.
- El token NocoDB se configura como secreto del servidor en Cloudflare Pages; no se publica como variable `VITE_`.

> Importante: el proyecto sigue siendo una base académica/prototipo. Antes de usarlo con pacientes reales, implementa autenticación real del personal, autorización en servidor, consentimiento informado, auditoría, políticas de privacidad, copias de seguridad y revisión legal/de seguridad aplicable. Las credenciales de demostración del panel siguen estando en el frontend y no son adecuadas para producción.

## Configurar NocoDB Cloud

1. Crea una base en https://app.nocodb.com.
2. Crea las seis tablas descritas en `CONFIGURACION_NOCODB.md`: `Usuarios`, `Pacientes`, `Citas`, `Pagos`, `Historial clínico` y `Secuencias`.
3. Crea un API token de NocoDB con permisos mínimos de lectura y escritura sobre esa base.
4. En Cloudflare Pages → Settings → Environment variables agrega:
   - `VITE_NOCODB_BASE_ID`: ID de la base (identificador `p...`). Es un identificador, no un secreto.
   - `NOCODB_API_TOKEN`: token de NocoDB. Marcar como secreto. No añadir prefijo `VITE_`.
   - Opcional: `NOCODB_UPSTREAM_URL=https://app.nocodb.com`.
5. Vuelve a desplegar para que se apliquen las variables.

Para desarrollo local con Wrangler, copia `.dev.vars.example` a `.dev.vars` y coloca el token real. No compartas ese archivo. Para compilar localmente se requiere Node.js; para publicar en Cloudflare Pages, la compilación se ejecuta en la infraestructura de Cloudflare.

## Publicar en Cloudflare Pages

1. Sube el proyecto a un repositorio privado de GitHub. No subas `.env.local`, `.dev.vars` ni tokens.
2. Crea un proyecto en Cloudflare Pages conectado al repositorio.
3. Configura:
   - Framework: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Añade las variables anteriores y despliega.
5. Comprueba que la web pública carga y que el estado de NocoDB indica conexión.

Las Pages Functions se despliegan junto con el proyecto cuando existe la carpeta `functions/` en la raíz.

## Ejecutar localmente

```bash
npm install
cp .env.example .env.local
# Completa VITE_NOCODB_BASE_ID
cp .dev.vars.example .dev.vars
# Completa NOCODB_API_TOKEN
npx wrangler pages dev dist
```

Para desarrollar con Vite y probar el proxy de Pages Functions, usa Wrangler Pages Dev. `npm run dev` por sí solo no ejecuta las Pages Functions.

## Cuentas de demostración

- Administrador: `admin@footfisio.com` / `admin123`
- Terapeuta: `e.ruiz@footfisio.com` / `elena123`
- Recepción: `c.lopez@footfisio.com` / `carmen123`

Estas cuentas son únicamente para demostración. Cambia o elimina las credenciales antes de cualquier despliegue público.
