# CareCateringApp

Aplicación de gestión de catering y logística para hospitales, construida con Next.js 16, TypeScript, Tailwind CSS y Supabase.

## 🚀 Inicio Rápido

### Desarrollo Local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   ```bash
   cp env.example .env.local
   ```
   Edita `.env.local` y agrega tus credenciales de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   NEXT_PUBLIC_TEST_MODE=false
   ```

3. **Ejecutar servidor de desarrollo:**
   ```bash
   npm run dev
   ```

4. **Abrir en el navegador:**
   Abre [http://localhost:3000](http://localhost:3000) para ver la aplicación.

### Base de Datos

Antes de usar la aplicación, asegúrate de ejecutar las migraciones de Supabase:

1. Accede a tu proyecto de Supabase
2. Ve a **SQL Editor**
3. Ejecuta las migraciones en orden desde `supabase/migrations/`

Ver más detalles en la [documentación principal del proyecto](../README.md).

## 📦 Deployment en Producción

Esta aplicación está configurada para deployment en VPS usando **Dokploy**.

### Guía Completa de Deployment

Para instrucciones detalladas sobre cómo desplegar la aplicación en producción, consulta:

**[DEPLOYMENT.md](./DEPLOYMENT.md)** - Guía completa paso a paso

### Resumen Rápido

1. **Preparar Base de Datos:**
   - Ejecutar todas las migraciones en Supabase (producción)

2. **Configurar en Dokploy:**
   - Conectar repositorio GIT
   - Configurar variables de entorno (ver `env.example`)
   - Asegurar que `NEXT_PUBLIC_TEST_MODE=false` en producción

3. **Desplegar:**
   - Dokploy detectará automáticamente Next.js
   - Build: `npm run build`
   - Start: `npm start`

### Variables de Entorno Requeridas en Producción

```env
# REQUERIDAS
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui

# IMPORTANTE: Debe estar en false en producción
NEXT_PUBLIC_TEST_MODE=false
```

## 🛠️ Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm start` - Inicia el servidor de producción
- `npm run lint` - Ejecuta el linter

## 📚 Recursos

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Dokploy Documentation](https://dokploy.com/docs)

## 🔒 Seguridad

- Nunca commitees archivos `.env` al repositorio
- Usa variables de entorno para credenciales
- Mantén `NEXT_PUBLIC_TEST_MODE=false` en producción
- Configura HTTPS/SSL en producción

---

**Desarrollado para Box Hill Hospital - Catering Department**
