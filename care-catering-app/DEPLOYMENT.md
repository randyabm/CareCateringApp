# Guía de Deployment - CareCateringApp

Esta guía te ayudará a desplegar CareCateringApp en tu VPS usando Dokploy conectado a tu repositorio GIT.

## Prerrequisitos

- VPS con Dokploy instalado y configurado
- Repositorio GIT con el código de la aplicación
- Proyecto de Supabase configurado (producción)
- Acceso a la base de datos de Supabase para ejecutar migraciones

## Paso 1: Preparar Base de Datos (Supabase)

Antes de desplegar la aplicación, asegúrate de que todas las migraciones estén ejecutadas en tu base de datos de producción.

### Ejecutar Migraciones

1. Accede a tu proyecto de Supabase (producción)
2. Ve a **SQL Editor**
3. Ejecuta las migraciones en orden cronológico desde `supabase/migrations/`:

   ```
   20240101000000_initial_schema.sql
   20251213000000_add_unit_to_products.sql
   20251213000001_add_location_groups.sql
   20251213000002_add_product_categories.sql
   20251213000003_add_location_stock_and_templates.sql
   20251214000000_add_parent_group_id.sql
   20251215000000_add_storage_and_location_stock.sql
   20251215010000_add_report_views.sql
   20251216090000_add_announcements.sql
   20251217080000_add_notes.sql
   20251218000000_add_rounds.sql
   20251218010000_add_future_order_type.sql
   20251219000000_add_nurse_order_policies.sql
   20251219010000_allow_test_mode_orders.sql
   20251220000000_add_catering_form_fields.sql
   20251221000000_add_meal_services_table.sql
   20251221010000_add_order_time_window_to_meal_services.sql
   20251221020000_remove_service_time_from_meal_services.sql
   20251221030000_sync_meal_services_to_diet_codes.sql
   20251222000000_add_requested_by_to_orders.sql
   20251222010000_add_bed_number_to_orders_summary.sql
   20251222020000_fix_sync_meal_service_function.sql
   20251222030000_add_soft_delete_to_meal_services.sql
   20251222040000_add_soft_delete_to_diet_codes.sql
   20251222050000_fix_diet_codes_rls_policy.sql
   20251223000000_add_order_assignment.sql
   ```

4. Verifica que todas las migraciones se ejecutaron correctamente sin errores

## Paso 2: Configurar Aplicación en Dokploy

### 2.1 Crear Nueva Aplicación

1. Inicia sesión en tu panel de Dokploy
2. Haz clic en **"New Application"** o **"Nueva Aplicación"**
3. Selecciona **"Git Repository"** como fuente
4. Conecta tu repositorio GIT (si no está conectado, agrega las credenciales)
5. Selecciona el repositorio y la rama (generalmente `main` o `master`)

### 2.2 Configuración de Build

Dokploy detectará automáticamente que es una aplicación Next.js. La configuración por defecto debería ser:

- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Port**: `3000` (o el puerto que Dokploy asigne)
- **Node Version**: `20.18.0` (especificado en `.nvmrc`)

Si necesitas ajustar manualmente:
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`
- **Working Directory**: `care-catering-app` (si tu repo tiene la app en un subdirectorio)

### 2.3 Variables de Entorno

Configura las siguientes variables de entorno en Dokploy:

#### Variables Requeridas (Obligatorias)

```env
# Supabase Configuration - REQUERIDAS
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

#### Variables Opcionales (Solo para Testing)

```env
# Testing Mode - DEBE estar en 'false' en producción
NEXT_PUBLIC_TEST_MODE=false

# Las siguientes variables solo se usan si TEST_MODE=true
# NO las configures en producción
# NEXT_PUBLIC_TEST_USER_ROLE=nurse
# NEXT_PUBLIC_TEST_USER_LOCATION_ID=1
# NEXT_PUBLIC_TEST_USER_ID=00000000-0000-0000-0000-000000000001
# NEXT_PUBLIC_TEST_USER_NAME=Test Nurse
```

**Importante**: 
- `NEXT_PUBLIC_TEST_MODE` debe estar en `false` en producción
- No configures las variables de test en producción
- Obtén las credenciales de Supabase desde tu proyecto en [supabase.com](https://supabase.com)

### 2.4 Configuración de Dominio

1. En Dokploy, ve a la sección **"Domains"** o **"Dominios"**
2. Agrega tu dominio (ej: `app.tudominio.com`)
3. Dokploy configurará automáticamente el proxy reverso con nginx
4. Si usas HTTPS, Dokploy puede configurar Let's Encrypt automáticamente

### 2.5 Configuración de Puerto

- Dokploy asignará automáticamente un puerto interno
- No necesitas configurar el puerto manualmente
- El proxy reverso (nginx) manejará el tráfico externo

## Paso 3: Desplegar

1. Haz clic en **"Deploy"** o **"Desplegar"**
2. Dokploy:
   - Clonará el repositorio
   - Instalará dependencias (`npm ci`)
   - Ejecutará el build (`npm run build`)
   - Iniciará la aplicación (`npm start`)
3. Monitorea los logs para verificar que todo funcione correctamente

## Paso 4: Verificaciones Post-Deployment

### 4.1 Verificar Build Exitoso

- Revisa los logs de build en Dokploy
- Debe mostrar: `✓ Compiled successfully` o similar
- No debe haber errores de TypeScript o compilación

### 4.2 Verificar Aplicación Accesible

1. Abre tu dominio en el navegador
2. Debe cargar la página principal sin errores
3. Verifica que no aparezcan errores en la consola del navegador

### 4.3 Verificar Conexión a Supabase

1. Intenta iniciar sesión (si la autenticación está configurada)
2. Verifica que las consultas a la base de datos funcionen
3. Revisa los logs de la aplicación para errores de conexión

### 4.4 Verificar Modo de Prueba Deshabilitado

- El banner de "Test Mode" NO debe aparecer
- La autenticación real debe estar funcionando
- Verifica que `NEXT_PUBLIC_TEST_MODE=false` esté configurado

### 4.5 Probar Funcionalidades Principales

- Acceso a diferentes rutas (`/ward`, `/kitchen`, `/store`, `/admin`)
- Creación de órdenes
- Consultas a la base de datos
- Autenticación de usuarios

## Troubleshooting

### Error: "Cannot find module" o errores de dependencias

**Solución**:
- Verifica que el comando de build incluya `npm ci` (instalación limpia)
- Asegúrate de que `package-lock.json` esté en el repositorio
- Revisa que la versión de Node.js sea la correcta (20.18.0)

### Error: "NEXT_PUBLIC_SUPABASE_URL is not defined"

**Solución**:
- Verifica que todas las variables de entorno estén configuradas en Dokploy
- Asegúrate de que las variables comiencen con `NEXT_PUBLIC_` si se usan en el cliente
- Reinicia la aplicación después de agregar variables de entorno

### Error: "Failed to connect to Supabase"

**Solución**:
- Verifica que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` sean correctos
- Asegúrate de que la URL no tenga una barra final (`/`)
- Verifica que el proyecto de Supabase esté activo
- Revisa las políticas de RLS (Row Level Security) en Supabase

### Error: "Build failed" o errores de TypeScript

**Solución**:
- Ejecuta `npm run build` localmente para identificar errores
- Verifica que todos los tipos estén correctos
- Asegúrate de que `tsconfig.json` esté configurado correctamente

### La aplicación no responde o muestra errores 500

**Solución**:
- Revisa los logs de la aplicación en Dokploy
- Verifica que el puerto esté configurado correctamente
- Asegúrate de que nginx esté configurado para el proxy reverso
- Verifica que la aplicación esté corriendo (revisa los procesos)

### Problemas con el dominio o SSL

**Solución**:
- Verifica que el DNS apunte correctamente a tu VPS
- Asegúrate de que el puerto 80 y 443 estén abiertos en el firewall
- Si usas Let's Encrypt, verifica que el dominio sea accesible públicamente
- Revisa la configuración de nginx en Dokploy

### Modo de prueba activo en producción

**Solución**:
- Verifica que `NEXT_PUBLIC_TEST_MODE=false` esté configurado
- Reinicia la aplicación después de cambiar las variables
- Limpia la caché del navegador

## Actualizaciones Futuras

Para actualizar la aplicación:

1. Haz push de los cambios a tu repositorio GIT
2. En Dokploy, haz clic en **"Redeploy"** o **"Redesplegar"**
3. Dokploy automáticamente:
   - Obtendrá los últimos cambios
   - Reconstruirá la aplicación
   - Reiniciará el servicio

## Configuración Recomendada de Recursos

- **RAM**: Mínimo 512MB, recomendado 1GB+
- **CPU**: Mínimo 1 core, recomendado 2 cores
- **Disco**: Mínimo 2GB para la aplicación y dependencias

## Seguridad

- ✅ Nunca commitees archivos `.env` al repositorio
- ✅ Usa variables de entorno en Dokploy para credenciales
- ✅ Mantén `NEXT_PUBLIC_TEST_MODE=false` en producción
- ✅ Configura HTTPS/SSL para tráfico encriptado
- ✅ Revisa regularmente las políticas de RLS en Supabase
- ✅ Mantén las dependencias actualizadas (`npm audit`)

## Soporte

Si encuentras problemas que no están cubiertos en esta guía:

1. Revisa los logs de la aplicación en Dokploy
2. Verifica la documentación de [Dokploy](https://dokploy.com/docs)
3. Revisa la documentación de [Next.js Deployment](https://nextjs.org/docs/deployment)
4. Consulta los logs de Supabase para errores de base de datos

---

**Última actualización**: Diciembre 2024

