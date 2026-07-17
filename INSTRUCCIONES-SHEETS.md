# Conectar "Peticiones" con Google Sheets

Cada petición enviada desde `peticiones.html` puede guardarse automáticamente como una fila en una hoja de cálculo. Se hace con Google Apps Script (gratis, sin servidores). Toma ~5 minutos.

## Paso 1 · Crea la hoja
1. Entra a [sheets.google.com](https://sheets.google.com) y crea una hoja nueva. Nómbrala **Peticiones Ciudadanas**.
2. En la fila 1 escribe estos encabezados (en este orden):

   | Folio | Fecha | Categoría | Descripción | Nombre | Teléfono | Colonia | Lat | Lng | Mapa | Estado |

## Paso 2 · Crea el script
1. En la hoja, menú **Extensiones → Apps Script**.
2. Borra el código que aparece y pega esto:

```javascript
// ====== VERSIÓN REFORZADA (aguanta picos de tráfico) ======

// Guarda cada petición nueva como una fila.
// LockService: si dos personas envían en el mismo instante,
// los escribe en orden y ninguno se pierde ni se encima.
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // espera hasta 10 s su turno
  try {
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const p = e.parameter;
    hoja.appendRow([
      p.folio, p.fecha, p.categoria, p.descripcion,
      p.nombre, p.telefono, p.colonia,
      Number(p.lat), Number(p.lng), p.mapa,
      "Nueva"
    ]);
    // cada registro nuevo invalida el caché del mapa
    CacheService.getScriptCache().remove("reportes");
    return ContentService
      .createTextOutput(JSON.stringify({ok: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Publica los reportes para el mapa público.
// CacheService: la lista se calcula 1 vez cada 5 minutos aunque
// entren miles de visitas; el resto se sirve desde memoria.
// PRIVACIDAD: solo expone folio, fecha, categoría, colonia,
// coordenadas y estado. Nombre y teléfono NUNCA se publican.
function doGet() {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get("reportes");
  if (enCache) {
    return ContentService.createTextOutput(enCache)
      .setMimeType(ContentService.MimeType.JSON);
  }
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const filas = hoja.getDataRange().getValues();
  const reportes = [];
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    if (!f[7] || !f[8]) continue; // sin coordenadas, no va al mapa
    reportes.push({
      folio: f[0], fecha: f[1], categoria: f[2],
      colonia: f[6], lat: Number(f[7]), lng: Number(f[8]),
      estado: f[10] || "Nueva"
    });
  }
  const json = JSON.stringify({ ok: true, reportes: reportes });
  // El caché admite hasta ~100 KB por entrada (~800 reportes).
  // Si algún día se supera, simplemente se sirve sin caché.
  try { cache.put("reportes", json, 300); } catch (_) {}
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Guarda (icono de disquete) y ponle nombre al proyecto, ej. "Registro Peticiones".

## Paso 3 · Publícalo como Web App
1. Botón azul **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - *Ejecutar como:* **Yo** (tu cuenta)
   - *Quién tiene acceso:* **Cualquier persona**  ← importante
4. Clic en **Implementar**, autoriza los permisos y **copia la URL** que termina en `/exec`.

## Paso 4 · Pega la URL en la página
Abre `peticiones.html` y en el bloque `CONFIG` (casi al final del archivo) pega la URL:

```javascript
const CONFIG = {
  sheetsURL: "https://script.google.com/macros/s/TU_URL_AQUI/exec",
  whatsapp:  "528100000000",   // respaldo por WhatsApp
  ...
};
```

Listo. Cada petición llegará como una fila nueva con su folio, ubicación (lat/lng + enlace a Google Maps) y una columna **Estado** para dar seguimiento (Nueva → En proceso → Resuelta).

## Notas
- Mientras `sheetsURL` esté vacío, el formulario funciona igual pero envía la petición por **WhatsApp** al número configurado (respaldo).
- Si más adelante cambias el script, usa **Implementar → Administrar implementaciones → editar → Nueva versión** para que la misma URL siga funcionando.
- Puedes crear un mapa de calor de las peticiones importando la hoja en Google My Maps (Lat/Lng).

## Otros ajustes editables
- **Infórmate** (`informate.html`): los teléfonos, servicios y becas están en los arreglos `EMERGENCIAS`, `SERVICIOS` y `BECAS` al final del archivo. Agrega o edita objetos y la página se redibuja sola. Los marcados con "EDITAR" son placeholders.
- **Inicio / navegación**: todas las páginas comparten la misma barra; si agregas una página nueva, añade el enlace en el bloque `.nav-inner` de cada archivo.


## Mapa público de reportes
Con la misma URL `/exec` en `CONFIG.sheetsURL`, la página **Peticiones** ya hace dos cosas:
1. **Guarda** cada petición nueva (doPost).
2. **Muestra** los reportes registrados en el mapa "Reportes registrados", agrupados por puntos y con un color por categoría (doGet).

> Si ya habías publicado el Web App antes de agregar `doGet`, entra a **Implementar → Administrar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar**. La URL no cambia, pero el código publicado sí debe actualizarse.

## Detección automática de colonia
El archivo `colonias.js` (incluido junto al sitio) contiene los polígonos de las **930 colonias del municipio**. Al colocar el pin en el mapa:
- Se detecta en qué colonia cae el punto y se llena solo el campo *Colonia*.
- Se dibuja el contorno de la colonia en azul para confirmar visualmente.
- Si escribes la colonia a mano, tu texto se respeta y ya no se sobreescribe.

**Importante:** `colonias.js` debe estar en la misma carpeta que `peticiones.html`. Si falta, todo sigue funcionando, solo que la colonia se captura manualmente.

## (Opcional) Conectar el formulario "Súmate" a otra hoja
El formulario **Súmate** de `informate.html` funciona desde el primer día por WhatsApp
(los registros llegan como mensaje). Si prefieres que se guarden en una hoja:

1. Crea una hoja nueva llamada **"Sumate"** con encabezados:
   `Fecha | Interés | Nombre | Teléfono | Correo | Colonia | Mensaje | Estado`
2. En esa hoja: **Extensiones → Apps Script**, pega esto y publícalo como Web App
   (igual que la de peticiones):

```javascript
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const p = e.parameter;
    hoja.appendRow([
      p.fecha, p.interes, p.nombre, p.telefono,
      p.correo, p.colonia, p.mensaje, "Pendiente de contacto"
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ok: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```

3. Copia la URL `/exec` y pégala en `informate.html`, dentro de `SUMATE.sheetsURL`.


## Capacidad y tráfico (para tu tranquilidad)
- **Almacenamiento:** una hoja de Google admite 10 millones de celdas: ~900,000 peticiones o ~1,250,000 registros de Súmate. No es tu límite real.
- **Tráfico:** Apps Script permite hasta **30 ejecuciones simultáneas**. Con el `LockService` y el caché de arriba, el montaje aguanta miles de envíos al día y picos de visitas al mapa sin despeinarse.
- **Cuándo pensar en migrar:** si el mapa acumula más de ~5,000 reportes activos o esperas campañas virales sostenidas, conviene pasar a un backend dedicado. Mientras tanto, esto sobra.
- **Si ya tenías publicado el Web App:** pega el código reforzado y crea **Nueva versión** en Administrar implementaciones (la URL no cambia).
