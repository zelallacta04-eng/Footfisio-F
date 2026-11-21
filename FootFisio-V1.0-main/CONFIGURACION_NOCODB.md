# Configuración de FootFisio con NocoDB Cloud

La aplicación sincroniza seis módulos con estas tablas:

- `Usuarios`
- `Pacientes`
- `Citas`
- `Pagos`
- `Historial clínico`
- `Secuencias`

Las relaciones esperadas son `Paciente`, `Especialista` y `Profesional` en las tablas correspondientes. Los nombres de las columnas deben coincidir con el modelo existente de la aplicación.

## Variables de entorno

En Cloudflare Pages → Settings → Environment variables:

| Variable | Tipo | Valor |
|---|---|---|
| `VITE_NOCODB_BASE_ID` | Texto | ID `p...` de la base |
| `NOCODB_API_TOKEN` | Secreto | API token de NocoDB con permisos Records: Read & write |
| `NOCODB_UPSTREAM_URL` | Texto, opcional | `https://app.nocodb.com` |

**No configures el token como `VITE_NOCODB_API_TOKEN`.** Las variables `VITE_` se envían al navegador. FootFisio usa una Cloudflare Pages Function que añade el token en el servidor y reenvía las llamadas a NocoDB.

## Columnas y opciones

Respeta los nombres de campos definidos en el esquema que usa tu base actual. Valores de listas desplegables:

- Estado (Pacientes, Usuarios, Secuencias): `Activo`, `Inactivo`.
- Estado (Citas): `Atendida`, `Confirmada`, `En espera`, `Cancelada`.
- Estado (Pagos): `Pagado`, `Pendiente`, `Vencido`.
- Método de pago: `Tarjeta`, `Transferencia`, `Efectivo`.
- Rol (Usuarios): `Fisioterapeuta`, `Recepcionista`, `Administrador`.
- Tipo (Secuencias): `Rehabilitación`, `Deportiva`, `Columna`, `Electroterapia`.

## Notas de datos

- Edad se calcula desde la fecha de nacimiento.
- La sesión del historial se calcula por paciente y fecha.
- Última visita y especialista se derivan del historial y las citas.
- Las sesiones, duración y ejercicios de una secuencia se empaquetan en el campo `Descripción`.
- La primera carga en una base vacía puede insertar datos de demostración. Revisa y elimina esos registros antes de usar datos reales.

## Desarrollo local

Crea `.env.local` con `VITE_NOCODB_BASE_ID` y `.dev.vars` con `NOCODB_API_TOKEN`. Ambos archivos están excluidos de Git. Para probar Pages Functions localmente, ejecuta el proyecto con Wrangler Pages Dev.

## IDs de tabla y desarrollo local (actualización)
La API v3 de NocoDB necesita el ID de cada tabla (el código que empieza con "m" en la URL de la tabla).
Variables públicas: VITE_TABLA_USUARIOS, VITE_TABLA_PACIENTES, VITE_TABLA_CITAS, VITE_TABLA_PAGOS,
VITE_TABLA_HISTORIAL, VITE_TABLA_SECUENCIAS. Ponlas en .env.local (local) y en Cloudflare Pages (producción).

Con `npm run dev`, Vite hace de intermediario en /api/nocodb usando NOCODB_API_TOKEN de .env.local
(sin prefijo VITE_), igual que la función de Cloudflare. La función solo permite rutas de datos
(/api/v3/data/...) y la lectura de tablas; opcionalmente fija NOCODB_BASE_ID para aceptar una sola base.
