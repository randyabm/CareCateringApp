# Modo de Prueba (Test Mode)

Este documento explica cómo usar el modo de prueba para simular diferentes roles de usuario sin necesidad de autenticación real.

## Configuración

### 1. Crear archivo `.env.local`

Copia el archivo `env.example` y renómbralo a `.env.local`:

```bash
cp env.example .env.local
```

### 2. Configurar variables de entorno

Edita el archivo `.env.local` y configura las siguientes variables:

```env
# Habilitar modo de prueba
NEXT_PUBLIC_TEST_MODE=true

# Rol del usuario de prueba
# Opciones: 'nurse', 'store_man', 'kitchen_staff', 'admin'
NEXT_PUBLIC_TEST_USER_ROLE=nurse

# ID de la ubicación asignada (debe ser un ID válido de tu base de datos)
NEXT_PUBLIC_TEST_USER_LOCATION_ID=1

# ID del usuario (opcional, se generará uno por defecto si no se proporciona)
NEXT_PUBLIC_TEST_USER_ID=00000000-0000-0000-0000-000000000001

# Nombre del usuario (opcional)
NEXT_PUBLIC_TEST_USER_NAME=Test Nurse
```

## Uso

### Simular rol de Nurse

Para simular un usuario enfermera:

```env
NEXT_PUBLIC_TEST_MODE=true
NEXT_PUBLIC_TEST_USER_ROLE=nurse
NEXT_PUBLIC_TEST_USER_LOCATION_ID=1
```

### Simular otros roles

**Store Man:**
```env
NEXT_PUBLIC_TEST_MODE=true
NEXT_PUBLIC_TEST_USER_ROLE=store_man
NEXT_PUBLIC_TEST_USER_LOCATION_ID=1
```

**Kitchen Staff:**
```env
NEXT_PUBLIC_TEST_MODE=true
NEXT_PUBLIC_TEST_USER_ROLE=kitchen_staff
NEXT_PUBLIC_TEST_USER_LOCATION_ID=1
```

**Admin:**
```env
NEXT_PUBLIC_TEST_MODE=true
NEXT_PUBLIC_TEST_USER_ROLE=admin
NEXT_PUBLIC_TEST_USER_LOCATION_ID=1
```

## Características

- ✅ **Sin autenticación requerida**: No necesitas iniciar sesión
- ✅ **Simulación de roles**: Prueba diferentes roles fácilmente
- ✅ **Indicador visual**: Se muestra un banner cuando el modo de prueba está activo
- ✅ **Funcionalidad completa**: Todas las características funcionan normalmente

## Notas Importantes

1. **Solo para desarrollo**: El modo de prueba solo funciona en desarrollo. No se activará en producción.

2. **Location ID válido**: Asegúrate de que `NEXT_PUBLIC_TEST_USER_LOCATION_ID` sea un ID válido de una ubicación existente en tu base de datos.

3. **Reiniciar servidor**: Después de cambiar las variables de entorno, reinicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. **Desactivar modo de prueba**: Para desactivar el modo de prueba, simplemente cambia:
   ```env
   NEXT_PUBLIC_TEST_MODE=false
   ```
   O elimina la variable del archivo `.env.local`.

## Ejemplo de Uso

1. Configura `.env.local` con:
   ```env
   NEXT_PUBLIC_TEST_MODE=true
   NEXT_PUBLIC_TEST_USER_ROLE=nurse
   NEXT_PUBLIC_TEST_USER_LOCATION_ID=1
   ```

2. Reinicia el servidor:
   ```bash
   npm run dev
   ```

3. Navega a `/ward` en tu navegador

4. Verás un banner amarillo indicando que el modo de prueba está activo

5. Podrás usar todas las funcionalidades como si fueras una enfermera autenticada

## Troubleshooting

**El modo de prueba no funciona:**
- Verifica que `NEXT_PUBLIC_TEST_MODE=true` (como string, no booleano)
- Reinicia el servidor después de cambiar las variables
- Verifica que el archivo se llame `.env.local` (no `.env.local.example`)

**No puedo crear órdenes:**
- Verifica que `NEXT_PUBLIC_TEST_USER_LOCATION_ID` sea un ID válido
- Asegúrate de que existan productos y ubicaciones en tu base de datos

**El banner no aparece:**
- Verifica que `NEXT_PUBLIC_TEST_MODE=true` esté configurado correctamente
- Limpia la caché del navegador y recarga la página

