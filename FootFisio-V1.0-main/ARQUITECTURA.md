# Arquitectura actual de FootFisio

## Vista general

- **Web pública:** React + TypeScript. Presenta la clínica, servicios, especialistas y acceso a solicitud de cita.
- **Panel interno:** conserva los módulos de agenda, pacientes, historial clínico, pagos, reportes, usuarios y secuencias.
- **Persistencia:** NocoDB Cloud mediante su API REST v3.
- **Proxy seguro:** Cloudflare Pages Function (`functions/api/nocodb/[[path]].ts`) recibe las llamadas del navegador, añade el token secreto y las reenvía a NocoDB.
- **Despliegue:** Cloudflare Pages compila y publica la aplicación estática y sus Functions.

## Flujo de datos

1. React realiza solicitudes a `/api/nocodb/...` en el mismo dominio.
2. La Pages Function lee `NOCODB_API_TOKEN` desde las variables secretas de Cloudflare.
3. La Function reenvía la solicitud a `https://app.nocodb.com` con el encabezado `xc-token`.
4. NocoDB devuelve los registros y React actualiza la interfaz.

El token no debe utilizar el prefijo `VITE_`, ya que esas variables se exponen al navegador.

## Módulos persistidos

`Usuarios`, `Pacientes`, `Citas`, `Pagos`, `Historial clínico` y `Secuencias`. Los mapeos de campos y relaciones se encuentran en `src/services/nocodb.ts`.

## Alcance y límites de seguridad

La Pages Function protege el token de NocoDB frente a la exposición directa en el bundle del navegador. Sin embargo, la aplicación conserva credenciales de demostración y validación de roles en el frontend. Por ello, no debe almacenar ni procesar historias clínicas reales hasta implementar autenticación de servidor, autorización por rol en cada operación, auditoría, gestión de sesiones, controles de acceso a los registros y medidas legales/técnicas de protección de datos.

La comprobación de disponibilidad de citas en el formulario público es una validación básica del estado cargado por la aplicación. Para una clínica real, la reserva debe validarse de forma atómica en el servidor para impedir reservas simultáneas en el mismo horario.
