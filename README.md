# Mi Puesto · Prototipo de app de ventas para pymes

**Mi Puesto** es una app que se usa desde el celular, pensada para artesanos, feriantes, pymes y vendedores online de Chile.
Con ella el negocio tiene su tienda online, se entera al instante de cada pedido (con ticket para imprimir) y lleva el control de su stock con la cámara.
Además tiene el balance del día y de la semana, y exporta a Excel en un toque. Todo sin instalar nada raro: es una web que se "instala" como app.

> ⚠️ Este repositorio es una **maqueta navegable de demostración**. No hay backend: los datos viven en el navegador (localStorage), los pagos son simulados y los teléfonos de ejemplo son ficticios.

---

## Estructura

```
mi-puesto-demo/
├── index.html          Portada: "Ver como cliente" / "Ver como negocio"
├── cliente.html        Tienda pública de "Artesanías Mapuche Rayen"
├── negocio.html        Panel del negocio (Inicio, Pedidos, Productos, Balance)
├── styles.css          Estilos mobile-first + impresión de ticket 80 mm
├── app.js              Lógica de toda la demo
├── data.js             Datos de ejemplo (productos, pedidos, repartidores)
├── manifest.json       Configuración PWA
├── sw.js               Service worker (funciona sin conexión + clic en notificaciones)
└── icons/
    ├── icon.svg
    └── icon-maskable.svg
```

## Publicar en GitHub Pages

1. Entra a <https://github.com> con tu cuenta y pulsa **New** (nuevo repositorio).
2. Nombre del repositorio: `mi-puesto-demo`. Déjalo **Public** y pulsa **Create repository**.
3. En la página del repositorio vacío pulsa **uploading an existing file** (o **Add file → Upload files**).
4. Arrastra **todo el contenido** de la carpeta `mi-puesto-demo` (incluida la carpeta `icons`) y pulsa **Commit changes**.
   - Por terminal también sirve:
     ```bash
     cd mi-puesto-demo
     git init
     git add .
     git commit -m "Prototipo Mi Puesto"
     git branch -M main
     git remote add origin https://github.com/TU_USUARIO/mi-puesto-demo.git
     git push -u origin main
     ```
5. Ve a **Settings → Pages**.
6. En **Build and deployment → Source** elige **Deploy from a branch**.
7. En **Branch** elige **main** y la carpeta **/ (root)**. Pulsa **Save**.
8. Espera uno o dos minutos y recarga la página: aparecerá el enlace. La URL queda así:

   **`https://TU_USUARIO.github.io/mi-puesto-demo/`**

GitHub Pages sirve por HTTPS, que es justo lo que se necesita para la cámara, las notificaciones y la instalación como app.

## Probar el flujo completo (guion para la presentación)

### Con un solo dispositivo
1. Abre la URL y entra a **Ver como negocio**. Ingresa con el usuario `rayen` y la contraseña `demo123` (o pulsa **Usar datos de prueba**). Es un login de demostración: la clave se valida en el navegador, no es seguro para uso real.
2. Pulsa **🔔 Activar notificaciones** y acepta el permiso.
3. Pulsa **🛍️ Abrir mi tienda**: se abre la tienda en otra pestaña.
4. En la tienda:
   - agrega productos al carrito;
   - completa nombre, teléfono, dirección y fecha de entrega;
   - elige **Transferencia**, **Mercado Pago** o **Webpay** y confirma;
   - verás la pantalla con el **número de pedido**.
5. Vuelve a la pestaña del negocio. Ahí aparecen:
   - la **alerta con el ticket** (Ticket #N · Producto(s) · Nombre · Dirección · Fecha · Entrega);
   - un sonido y una vibración;
   - una **notificación del sistema**. Si te quedaste en la pestaña de la tienda, la notificación llega igual.
6. Toca **Ver pedido** y muestra el resto:
   - cambia el estado (Nuevo → Preparando → Despachado → Entregado);
   - **Asigna un repartidor** y pulsa **Enviar por WhatsApp**: se abre WhatsApp con el mensaje armado;
   - pulsa **Ver ticket → Imprimir**: sale la boleta angosta de 80 mm. También se puede "Guardar como PDF".
7. En **Productos**:
   - suma o resta stock;
   - edita un producto o crea uno nuevo;
   - pulsa **📷 Escanear código**. Se abre la cámara trasera y la lectura se simula a los pocos segundos. En Chrome para Android, si apuntas a un código de barras real, lo lee de verdad.
8. En **Balance**:
   - revisa las ventas del día y de la semana, el gráfico y los productos más vendidos;
   - descarga los **Excel de ventas y de stock**.

> Atajo: en **Inicio**, **⚡ Simular pedido** crea un pedido de prueba a los 5 segundos. Úsalo para mostrar la notificación con el celular bloqueado o con otra app abierta.

### Con dos dispositivos
Los datos se guardan **en cada navegador**, así que el pedido del cliente solo le llega al negocio si las dos vistas están **en el mismo navegador del mismo dispositivo** (por ejemplo, dos pestañas). Para que la audiencia haga pedidos desde sus propios celulares hace falta un backend, que es la siguiente etapa del proyecto.

### Instalar como app
- **Android (Chrome):** en la portada aparece **⬇️ Instalar en este celular**. También está en el menu ⋮ → **Instalar app**.
- **iPhone (Safari):** botón Compartir → **Agregar a inicio**. En iOS 16.4 o superior las notificaciones solo funcionan con la app instalada así.

### Reiniciar la demo
**Balance → Restablecer datos de la demo** vuelve a cargar los datos de ejemplo. Conviene hacerlo antes de cada presentación.

## Personalizar
- **Negocio, productos, repartidores:** edita `data.js`.
- **Mensaje de WhatsApp al repartidor:** pon tu propio número en `repartidores[].telefono` de `data.js`, con formato `569XXXXXXXX`. Así el mensaje te llega a ti durante la demo; los números de ejemplo son ficticios.
- **Colores:** variables `--acento`, `--bg`, etc. al inicio de `styles.css`.
- **Si cambias archivos ya publicados:** sube la versión de `CACHE` en `sw.js` (por ejemplo `mi-puesto-v2`) para que los celulares tomen los cambios.

## Limitaciones conocidas (por ser maqueta)
- **Notificaciones:** el aviso llega mientras el panel del negocio esté abierto en alguna pestaña o en segundo plano. Para que llegue con el navegador totalmente cerrado se necesita Web Push con un servidor.
- **Pagos simulados:** Transferencia, Mercado Pago y Webpay son botones de demostración y no se conectan a ningún medio de pago.
- **Íconos:** son SVG. Si algún navegador no ofrece "Instalar", agrega versiones PNG de 192×192 y 512×512 en `icons/` y en `manifest.json`.
- **El ticket no es una boleta electrónica del SII:** es solo un comprobante interno.
