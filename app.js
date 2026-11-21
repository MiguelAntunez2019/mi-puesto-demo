(() => {
  'use strict';

  const KEY = 'miPuesto.db.v1';
  const KEY_CARRITO = 'miPuesto.carrito.v1';
  const KEY_VISTOS = 'miPuesto.vistos.v1';
  const KEY_SESION = 'miPuesto.sesion.v1';
  const ESTADOS = ['Nuevo', 'Preparando', 'Despachado', 'Entregado'];
  const PAGOS = ['Transferencia', 'Mercado Pago', 'Webpay'];
  const TONOS = ['#F3D9C8', '#EADBF0', '#DDEEF0', '#F4E6C9', '#E3EED9', '#FBE7B5', '#F2D4CF'];
  const memoria = Object.create(null);
  const USA_API = location.protocol !== 'file:' && !/github\.io$/.test(location.hostname) && location.port !== '8765';
  const SLUG = new URLSearchParams(location.search).get('tienda') || 'artesanias-rayen';
  let remoto = null;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  function leer(k) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) return v;
    } catch (e) {}
    return k in memoria ? memoria[k] : null;
  }

  function escribir(k, v) {
    memoria[k] = v;
    try { localStorage.setItem(k, v); } catch (e) {}
  }

  function borrar(k) {
    delete memoria[k];
    try { localStorage.removeItem(k); } catch (e) {}
  }

  const clonar = o => JSON.parse(JSON.stringify(o));
  const maxId = pedidos => pedidos.reduce((m, p) => Math.max(m, p.id), 1000);

  function semilla() {
    const d = clonar(window.DEMO_DATA);
    return { productos: d.productos, pedidos: d.pedidos, siguienteId: maxId(d.pedidos) + 1 };
  }

  function guardar(db) { if (!USA_API) escribir(KEY, JSON.stringify(db)); }

  function cargar() {
    if (USA_API) return remoto || { productos: [], pedidos: [], siguienteId: 0 };
    const raw = leer(KEY);
    if (raw) {
      try {
        const db = JSON.parse(raw);
        if (db && Array.isArray(db.productos) && Array.isArray(db.pedidos)) return db;
      } catch (e) {}
    }
    const db = semilla();
    guardar(db);
    return db;
  }

  function actualizar(fn) {
    const db = cargar();
    const r = fn(db);
    guardar(db);
    return r;
  }

  const clp = n => '$' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const total = p => p.items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const resumenItems = p => p.items.map(i => `${i.cantidad} × ${i.nombre}`).join(', ');
  const claseEstado = e => 'estado-' + e.toLowerCase();
  const ordenar = pedidos => [...pedidos].sort((a, b) => b.creado.localeCompare(a.creado));
  const azar = arr => arr[Math.floor(Math.random() * arr.length)];
  const capitalizar = s => s.charAt(0).toUpperCase() + s.slice(1);

  function fechaLocal(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtDia = s => capitalizar(fechaLocal(s).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }));
  const fmtFecha = iso => new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtHora = iso => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const fmtFechaHora = iso => `${fmtFecha(iso)} ${fmtHora(iso)}`;
  const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  function telWa(t) {
    const d = String(t || '').replace(/\D/g, '');
    if (d.startsWith('56')) return d;
    if (d.length === 9 && d[0] === '9') return '56' + d;
    if (d.length === 8) return '569' + d;
    return d;
  }

  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('visible'), 2800);
  }

  function sesionGuardada() {
    try { return JSON.parse(leer(KEY_SESION)) || null; } catch (e) { return null; }
  }

  async function api(ruta, opciones = {}) {
    const s = sesionGuardada();
    const headers = { Accept: 'application/json' };
    if (opciones.body !== undefined) headers['Content-Type'] = 'application/json';
    if (s && s.token) headers.Authorization = 'Bearer ' + s.token;
    let r;
    try {
      r = await fetch('api/' + ruta, {
        method: opciones.method || 'GET',
        headers,
        body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
        cache: 'no-store'
      });
    } catch (e) {
      throw new Error('No hay conexión con el servidor. Revisa tu internet.');
    }
    const datos = await r.json().catch(() => null);
    if (r.status === 401 && s && s.token && ruta !== 'auth/login') {
      borrar(KEY_SESION);
      location.replace('negocio.html');
      throw new Error('Tu sesión expiró. Ingresa de nuevo.');
    }
    if (!r.ok) {
      const msg = r.status === 429 ? 'Demasiados intentos. Espera un minuto.' : (datos && datos.error) || 'Ocurrió un error. Intenta de nuevo.';
      const e = new Error(msg);
      e.status = r.status;
      throw e;
    }
    return datos;
  }

  function aplicarNegocio(n) {
    Object.assign(window.DEMO_DATA.negocio, {
      nombre: n.nombre,
      slogan: n.slogan || '',
      duena: n.duena || n.nombre,
      ciudad: n.ciudad || '',
      telefonoVisible: n.telefonoVisible || '',
      slug: n.slug
    });
  }

  async function cargarTienda() {
    const t = await api('tienda/' + encodeURIComponent(SLUG));
    aplicarNegocio(t.negocio);
    remoto = { productos: t.productos, pedidos: [], siguienteId: 0 };
  }

  async function cargarPanel() {
    const p = await api('panel');
    aplicarNegocio(p.negocio);
    window.DEMO_DATA.repartidores.splice(0, Infinity, ...p.repartidores);
    window.DEMO_DATA.clientesEjemplo.splice(0, Infinity, ...p.clientes);
    remoto = { productos: p.productos, pedidos: p.pedidos, siguienteId: 0 };
    return JSON.stringify([p.productos, p.pedidos, p.repartidores]);
  }

  function reemplazar(lista, item) {
    const i = lista.findIndex(x => x.id === item.id);
    if (i >= 0) lista[i] = item;
    else lista.unshift(item);
  }

  function crearPedido(datos, items) {
    return actualizar(db => {
      const lineas = [];
      items.forEach(({ id, cantidad }) => {
        const p = db.productos.find(x => x.id === id);
        if (!p) return;
        const c = Math.min(cantidad, p.stock);
        if (c <= 0) return;
        p.stock -= c;
        lineas.push({ id: p.id, nombre: p.nombre, emoji: p.emoji, precio: p.precio, cantidad: c });
      });
      if (!lineas.length) return null;
      const pedido = Object.assign({ id: db.siguienteId++, creado: new Date().toISOString(), estado: 'Nuevo', repartidor: null, comentario: '' }, datos, { items: lineas });
      db.pedidos.unshift(pedido);
      return pedido;
    });
  }

  function registrarSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  let eventoInstalar = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    eventoInstalar = e;
    const b = $('#btn-instalar');
    if (b) b.hidden = false;
  });

  function initPortada() {
    const b = $('#btn-instalar');
    if (!b) return;
    b.addEventListener('click', async () => {
      if (!eventoInstalar) return;
      eventoInstalar.prompt();
      try { await eventoInstalar.userChoice; } catch (e) {}
      eventoInstalar = null;
      b.hidden = true;
    });
  }

  function initCliente() {
    const neg = window.DEMO_DATA.negocio;
    $('#tienda-nombre').textContent = neg.nombre;
    $('#tienda-slogan').textContent = neg.slogan;
    document.title = `${neg.nombre} · Tienda`;
    const VISTAS = ['catalogo', 'carrito', 'pago', 'confirmacion'];
    const DETALLE_PAGO = {
      'Transferencia': '<p><strong>Datos para transferir</strong></p><p class="datos-banco">Banco Ejemplo · Cuenta Vista<br>N° 0000-1234-5678<br>RUT 11.111.111-1<br>Artesanías Rayen<br>pagos@ejemplo.cl</p><p class="nota">Envía el comprobante por WhatsApp. (Simulado)</p>',
      'Mercado Pago': '<p>Te llevaremos a Mercado Pago para pagar con tarjeta, saldo o cuotas.</p><p class="nota">Pantalla simulada: no se abre Mercado Pago.</p>',
      'Webpay': '<p>Paga con tarjeta de débito, crédito o prepago a través de Webpay.</p><p class="nota">Pantalla simulada: no se abre Webpay.</p>'
    };

    let carrito = {};
    try { carrito = JSON.parse(leer(KEY_CARRITO)) || {}; } catch (e) { carrito = {}; }
    let categoria = 'Todos';
    let datos = null;
    let metodo = null;
    let ultimo = null;

    const guardarCarrito = () => escribir(KEY_CARRITO, JSON.stringify(carrito));
    const productos = () => cargar().productos.filter(p => p.activo !== false);

    function lineas() {
      const ps = cargar().productos;
      return Object.entries(carrito)
        .map(([id, cantidad]) => {
          const p = ps.find(x => x.id === id);
          return p ? { p, cantidad: Math.min(cantidad, p.stock) } : null;
        })
        .filter(l => l && l.cantidad > 0);
    }
    const totalCarrito = () => lineas().reduce((s, l) => s + l.p.precio * l.cantidad, 0);
    const cantCarrito = () => lineas().reduce((s, l) => s + l.cantidad, 0);

    function cambiar(id, delta) {
      const p = cargar().productos.find(x => x.id === id);
      if (!p) return;
      const actual = carrito[id] || 0;
      const nueva = Math.max(0, Math.min(p.stock, actual + delta));
      if (delta > 0 && nueva === actual) toast('No queda más stock de este producto');
      else if (delta > 0 && actual === 0) toast('Agregado al carrito');
      if (nueva === 0) delete carrito[id];
      else carrito[id] = nueva;
      guardarCarrito();
      refrescar();
    }

    function refrescar() {
      if (!$('#v-catalogo').hidden) renderCatalogo();
      if (!$('#v-carrito').hidden) renderCarrito();
      actualizarBarra();
    }

    function actualizarBarra() {
      const n = cantCarrito();
      const badge = $('#carrito-badge');
      badge.textContent = n;
      badge.hidden = n === 0;
      $('#barra-cant').textContent = n;
      $('#barra-total').textContent = clp(totalCarrito());
      $('#barra-carrito').hidden = n === 0 || $('#v-catalogo').hidden;
    }

    function renderFiltros() {
      const cats = ['Todos', ...new Set(productos().map(p => p.categoria))];
      $('#filtros-cat').innerHTML = cats.map(c => `<button type="button" class="chip${c === categoria ? ' activo' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    }

    function renderCatalogo() {
      const lista = productos().filter(p => categoria === 'Todos' || p.categoria === categoria);
      $('#grid-productos').innerHTML = lista.map(p => {
        const enCarrito = carrito[p.id] || 0;
        const agotado = p.stock <= 0;
        let control;
        if (agotado) control = '<button type="button" class="btn btn-agregar" disabled>Agotado</button>';
        else if (enCarrito) control = `<div class="stepper"><button type="button" data-menos="${esc(p.id)}" aria-label="Quitar uno">−</button><span>${enCarrito}</span><button type="button" data-mas="${esc(p.id)}" aria-label="Agregar uno">+</button></div>`;
        else control = `<button type="button" class="btn btn-agregar" data-mas="${esc(p.id)}">Agregar</button>`;
        const aviso = !agotado && p.stock <= p.stockMin ? `<span class="etiqueta etiqueta-alerta">¡Últimas ${p.stock}!</span>` : '';
        return `<article class="producto">
          <div class="producto-foto" style="--tono:${esc(p.tono || TONOS[0])}">${esc(p.emoji)}${aviso}</div>
          <div class="producto-info">
            <h3>${esc(p.nombre)}</h3>
            <p class="producto-desc">${esc(p.descripcion || '')}</p>
            <p class="precio">${clp(p.precio)}</p>
            ${control}
          </div>
        </article>`;
      }).join('') || '<p class="vacio">No hay productos en esta categoría.</p>';
    }

    function renderCarrito() {
      const ls = lineas();
      $('#carrito-lista').innerHTML = ls.length
        ? ls.map(({ p, cantidad }) => `<div class="linea-carrito">
            <div class="mini-foto" style="--tono:${esc(p.tono || TONOS[0])}">${esc(p.emoji)}</div>
            <div class="linea-info"><strong>${esc(p.nombre)}</strong><span>${clp(p.precio)} c/u</span></div>
            <strong class="linea-sub">${clp(p.precio * cantidad)}</strong>
            <div class="stepper stepper-chico"><button type="button" data-menos="${esc(p.id)}" aria-label="Quitar uno">−</button><span>${cantidad}</span><button type="button" data-mas="${esc(p.id)}" aria-label="Agregar uno">+</button></div>
          </div>`).join('')
        : '<div class="vacio"><p>Tu carrito está vacío.</p><a href="#catalogo" class="btn btn-primario">Ver productos</a></div>';
      $('#carrito-total').textContent = clp(totalCarrito());
      $('#carrito-total-linea').hidden = !ls.length;
      $('#form-entrega').hidden = !ls.length;
    }

    function validar(d) {
      if (!lineas().length) return 'Tu carrito está vacío.';
      if (d.nombre.length < 2) return 'Ingresa tu nombre.';
      if (d.telefono.replace(/\D/g, '').length < 8) return 'Ingresa un teléfono válido.';
      if (d.direccion.length < 5) return 'Ingresa la dirección de entrega.';
      if (!d.fechaEntrega) return 'Elige la fecha de entrega.';
      if (d.fechaEntrega < isoLocal(new Date())) return 'La fecha de entrega no puede ser anterior a hoy.';
      return '';
    }

    function renderPago() {
      const ls = lineas();
      const t = totalCarrito();
      $('#pago-resumen').innerHTML =
        ls.map(({ p, cantidad }) => `<div class="resumen-linea"><span>${cantidad} × ${esc(p.nombre)}</span><span>${clp(p.precio * cantidad)}</span></div>`).join('') +
        `<div class="resumen-linea resumen-total"><span>Total</span><span>${clp(t)}</span></div>` +
        `<p class="nota">Entrega ${esc(fmtDia(datos.fechaEntrega))} · ${esc(datos.direccion)} · ${esc(datos.nombre)}</p>`;
      $$('.metodo').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.metodo === metodo)));
      const det = $('#metodo-detalle');
      det.hidden = !metodo;
      det.innerHTML = metodo ? DETALLE_PAGO[metodo] : '';
      const btn = $('#btn-pagar');
      btn.disabled = !metodo;
      if (!metodo) btn.textContent = 'Elige un medio de pago';
      else if (metodo === 'Transferencia') btn.textContent = `Ya transferí ${clp(t)}`;
      else btn.textContent = `Pagar ${clp(t)} con ${metodo}`;
    }

    function renderConfirmacion() {
      $('#conf-numero').textContent = '#' + ultimo.id;
      $('#conf-resumen').innerHTML =
        ultimo.items.map(i => `<div class="resumen-linea"><span>${i.cantidad} × ${esc(i.nombre)}</span><span>${clp(i.precio * i.cantidad)}</span></div>`).join('') +
        `<div class="resumen-linea resumen-total"><span>Total</span><span>${clp(total(ultimo))}</span></div>` +
        `<p class="nota">Pago: ${esc(ultimo.pago)} · Entrega ${esc(fmtDia(ultimo.fechaEntrega))}<br>${esc(ultimo.cliente.direccion)}</p>`;
    }

    function ruta() {
      let v = location.hash.slice(1) || 'catalogo';
      if (!VISTAS.includes(v)) v = 'catalogo';
      if (v === 'pago' && (!datos || !lineas().length)) v = 'carrito';
      if (v === 'confirmacion' && !ultimo) v = 'catalogo';
      if ('#' + v !== location.hash) history.replaceState(null, '', '#' + v);
      VISTAS.forEach(x => { $('#v-' + x).hidden = x !== v; });
      if (v === 'catalogo') { renderFiltros(); renderCatalogo(); }
      if (v === 'carrito') renderCarrito();
      if (v === 'pago') renderPago();
      if (v === 'confirmacion') renderConfirmacion();
      actualizarBarra();
      window.scrollTo(0, 0);
    }

    const inputFecha = $('[name="fechaEntrega"]');
    const hoy = new Date();
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    inputFecha.min = isoLocal(hoy);
    inputFecha.value = isoLocal(manana);

    document.addEventListener('click', e => {
      const mas = e.target.closest('[data-mas]');
      if (mas) { cambiar(mas.dataset.mas, 1); return; }
      const menos = e.target.closest('[data-menos]');
      if (menos) { cambiar(menos.dataset.menos, -1); return; }
      const cat = e.target.closest('[data-cat]');
      if (cat) { categoria = cat.dataset.cat; renderFiltros(); renderCatalogo(); return; }
      const m = e.target.closest('[data-metodo]');
      if (m) { metodo = m.dataset.metodo; renderPago(); }
    });

    $('#form-entrega').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const d = {};
      fd.forEach((v, k) => { d[k] = String(v).trim(); });
      const err = validar(d);
      const el = $('#form-error');
      if (err) { el.textContent = err; el.hidden = false; return; }
      el.hidden = true;
      datos = d;
      location.hash = 'pago';
    });

    $('#btn-pagar').addEventListener('click', async () => {
      if (!metodo || !datos) return;
      const ov = $('#procesando');
      $('#procesando-texto').textContent = metodo === 'Transferencia' ? 'Registrando tu pedido…' : `Conectando con ${metodo}…`;
      ov.hidden = false;
      if (USA_API) {
        const espera = new Promise(r => setTimeout(r, 1200));
        let pedido = null;
        let fallo = null;
        try {
          pedido = await api('tienda/' + encodeURIComponent(SLUG) + '/pedidos', {
            method: 'POST',
            body: {
              cliente: { nombre: datos.nombre, telefono: datos.telefono, direccion: datos.direccion },
              fechaEntrega: datos.fechaEntrega,
              comentario: datos.comentario || '',
              pago: metodo,
              items: lineas().map(l => ({ id: l.p.id, cantidad: l.cantidad }))
            }
          });
        } catch (e) {
          fallo = e;
        }
        await espera;
        try { await cargarTienda(); } catch (e) {}
        ov.hidden = true;
        if (!pedido) {
          toast(fallo.message);
          if (fallo.status === 409) location.hash = 'carrito';
          else refrescar();
          return;
        }
        carrito = {};
        guardarCarrito();
        ultimo = pedido;
        metodo = null;
        location.hash = 'confirmacion';
        return;
      }
      setTimeout(() => {
        const pedido = crearPedido({
          cliente: { nombre: datos.nombre, telefono: datos.telefono, direccion: datos.direccion },
          fechaEntrega: datos.fechaEntrega,
          comentario: datos.comentario || '',
          pago: metodo
        }, lineas().map(l => ({ id: l.p.id, cantidad: l.cantidad })));
        ov.hidden = true;
        if (!pedido) { toast('Los productos ya no tienen stock'); location.hash = 'carrito'; return; }
        carrito = {};
        guardarCarrito();
        ultimo = pedido;
        metodo = null;
        location.hash = 'confirmacion';
      }, 1600);
    });

    window.addEventListener('hashchange', ruta);
    if (USA_API) {
      setInterval(async () => {
        if (document.hidden || !$('#procesando').hidden) return;
        try { await cargarTienda(); refrescar(); } catch (e) {}
      }, 30000);
    } else {
      window.addEventListener('storage', e => { if (e.key === KEY) refrescar(); });
    }
    ruta();
  }

  async function initClienteApi() {
    try {
      await cargarTienda();
    } catch (e) {
      remoto = { productos: [], pedidos: [], siguienteId: 0 };
      setTimeout(() => toast(e.message), 300);
    }
    initCliente();
  }

  function sesionActual() {
    const s = sesionGuardada();
    if (!s) return null;
    if (USA_API) return s.token ? s : null;
    const u = (window.DEMO_DATA.usuarios || []).find(x => x.usuario === s.usuario);
    return u ? s : null;
  }

  function initNegocio() {
    const form = $('#form-login');
    const error = $('#login-error');
    let ultimoInicial = null;

    const entrar = async () => {
      if (USA_API) {
        try {
          ultimoInicial = await cargarPanel();
        } catch (e) {
          error.textContent = e.message;
          error.hidden = false;
          return;
        }
      }
      document.body.classList.remove('sin-sesion');
      iniciarPanel(ultimoInicial);
    };
    if (sesionActual()) { entrar(); return; }

    $('#login-negocio').textContent = window.DEMO_DATA.negocio.nombre;

    $('#btn-datos-prueba').addEventListener('click', () => {
      const u = window.DEMO_DATA.usuarios[0];
      form.usuario.value = u.usuario;
      form.clave.value = u.clave;
      error.hidden = true;
      form.querySelector('[type=submit]').focus();
    });

    form.addEventListener('input', () => { error.hidden = true; });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const usuario = form.usuario.value.trim().toLowerCase();
      const clave = form.clave.value;
      if (!usuario || !clave) {
        error.textContent = 'Ingresa tu usuario y contraseña.';
        error.hidden = false;
        return;
      }
      if (USA_API) {
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Ingresando…';
        try {
          const r = await api('auth/login', { method: 'POST', body: { usuario, clave } });
          escribir(KEY_SESION, JSON.stringify({ usuario, nombre: r.nombre, negocio: r.negocio, token: r.token, desde: new Date().toISOString() }));
          await entrar();
        } catch (e2) {
          error.textContent = e2.message;
          error.hidden = false;
          form.clave.value = '';
          form.clave.focus();
        } finally {
          btn.disabled = false;
          btn.textContent = 'Ingresar';
        }
        return;
      }
      const u = (window.DEMO_DATA.usuarios || []).find(x => x.usuario === usuario && x.clave === clave);
      if (!u) {
        error.textContent = 'Usuario o contraseña incorrectos.';
        error.hidden = false;
        form.clave.value = '';
        form.clave.focus();
        return;
      }
      escribir(KEY_SESION, JSON.stringify({ usuario: u.usuario, nombre: u.nombre, desde: new Date().toISOString() }));
      entrar();
    });

    form.usuario.focus();
  }

  function iniciarPanel(rawInicial) {
    const neg = window.DEMO_DATA.negocio;
    const reps = window.DEMO_DATA.repartidores;
    const SECCIONES = ['inicio', 'pedidos', 'productos', 'balance'];
    const maxSemilla = maxId(USA_API ? cargar().pedidos : window.DEMO_DATA.pedidos);
    $('#neg-nombre').textContent = neg.nombre;
    if (USA_API && neg.slug) $$('a[href="cliente.html"]').forEach(a => { a.href = 'cliente.html?tienda=' + encodeURIComponent(neg.slug); });

    let seccion = 'inicio';
    let filtro = 'Todos';
    let busqueda = '';
    let ultimoRaw = rawInicial || null;
    let sincronizando = false;
    let audio = null;
    let stream = null;
    let timerScan = null;

    cargar();
    if (leer(KEY_VISTOS) === null) escribir(KEY_VISTOS, String(maxSemilla));

    const repartidor = id => reps.find(r => r.id === id) || null;
    const kpi = (titulo, valor, clase = '') => `<div class="kpi ${clase}"><span>${titulo}</span><strong>${valor}</strong></div>`;

    function abrirModal(html, alCerrar) {
      const m = $('#modal');
      const prev = m._alCerrar;
      m._alCerrar = null;
      if (prev) prev();
      const cont = $('#modal-contenido');
      cont.innerHTML = html;
      m.hidden = false;
      m._alCerrar = alCerrar || null;
      document.body.classList.add('sin-scroll');
      $('.modal-caja').scrollTop = 0;
      return cont;
    }

    function cerrarModal() {
      const m = $('#modal');
      if (m.hidden) return;
      m.hidden = true;
      document.body.classList.remove('sin-scroll');
      const f = m._alCerrar;
      m._alCerrar = null;
      if (f) f();
    }

    function tarjetaPedido(p) {
      const e = p.estado.toLowerCase();
      return `<button type="button" class="pedido borde-${e}" data-pedido="${p.id}">
        <span class="pedido-top"><strong>#${p.id} · ${fmtHora(p.creado)}</strong><span class="estado ${claseEstado(p.estado)}">${p.estado}</span></span>
        <span class="pedido-cliente">${esc(p.cliente.nombre)}</span>
        <span class="pedido-items">${esc(resumenItems(p))}</span>
        <span class="pedido-pie"><span>🗓️ Entrega ${esc(fmtDia(p.fechaEntrega))}</span><strong>${clp(total(p))}</strong></span>
      </button>`;
    }

    function render() {
      const db = cargar();
      if (!USA_API) ultimoRaw = leer(KEY);
      const nuevos = db.pedidos.filter(p => p.estado === 'Nuevo').length;
      const b = $('#nav-badge');
      b.textContent = nuevos;
      b.hidden = !nuevos;
      if (seccion === 'inicio') renderInicio(db);
      if (seccion === 'pedidos') renderPedidos(db);
      if (seccion === 'productos') renderProductos(db);
      if (seccion === 'balance') renderBalance(db);
      actualizarNotifUI();
    }

    function renderInicio(db) {
      const hoy = new Date();
      const h = hoy.getHours();
      const saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
      $('#saludo').textContent = `${saludo}, ${neg.duena} 👋`;
      const deHoy = db.pedidos.filter(p => mismoDia(new Date(p.creado), hoy));
      const ventas = deHoy.reduce((s, p) => s + total(p), 0);
      const porPreparar = db.pedidos.filter(p => p.estado === 'Nuevo' || p.estado === 'Preparando').length;
      const bajos = db.productos.filter(p => p.stock <= p.stockMin);
      $('#kpis').innerHTML =
        kpi('Ventas de hoy', clp(ventas), 'destacado') +
        kpi('Pedidos de hoy', deHoy.length) +
        kpi('Por preparar', porPreparar) +
        kpi('Stock bajo', bajos.length, bajos.length ? 'alerta' : '');
      $('#inicio-stock').innerHTML = bajos.length
        ? bajos.map(p => `<div class="fila">
            <div class="mini-foto" style="--tono:${esc(p.tono || TONOS[0])}">${esc(p.emoji)}</div>
            <div class="fila-info"><strong>${esc(p.nombre)}</strong><span>${p.stock <= 0 ? 'Agotado' : `Quedan ${p.stock}`} · mínimo ${p.stockMin}</span></div>
            <a href="#productos" class="btn btn-secundario btn-chico">Reponer</a>
          </div>`).join('')
        : '<p class="vacio">Todo el stock está en orden 👌</p>';
      const ultimos = ordenar(db.pedidos).slice(0, 3);
      $('#inicio-pedidos').innerHTML = ultimos.map(tarjetaPedido).join('') || '<p class="vacio">Aún no hay pedidos.</p>';
    }

    function renderPedidos(db) {
      const conteo = e => e === 'Todos' ? db.pedidos.length : db.pedidos.filter(p => p.estado === e).length;
      $('#filtro-estados').innerHTML = ['Todos', ...ESTADOS]
        .map(e => `<button type="button" class="chip${filtro === e ? ' activo' : ''}" data-filtro="${e}">${e} <b>${conteo(e)}</b></button>`).join('');
      const lista = ordenar(db.pedidos).filter(p => filtro === 'Todos' || p.estado === filtro);
      $('#lista-pedidos').innerHTML = lista.map(tarjetaPedido).join('') || '<p class="vacio">No hay pedidos en este estado.</p>';
    }

    function renderProductos(db) {
      const q = busqueda.toLowerCase();
      const lista = db.productos.filter(p => !q || p.nombre.toLowerCase().includes(q) || String(p.codigo || '').includes(q));
      $('#lista-productos').innerHTML = lista.map(p => {
        const estado = p.stock <= 0
          ? '<span class="etiqueta etiqueta-error">Agotado</span>'
          : p.stock <= p.stockMin ? '<span class="etiqueta etiqueta-alerta">Stock bajo</span>' : '';
        return `<div class="fila-producto">
          <div class="mini-foto" style="--tono:${esc(p.tono || TONOS[0])}">${esc(p.emoji)}</div>
          <div class="fila-info"><strong>${esc(p.nombre)}</strong><span>${clp(p.precio)} · ${esc(p.codigo || 'sin código')}</span>${estado}</div>
          <div class="stock-control">
            <button type="button" data-stock="-1" data-id="${esc(p.id)}" aria-label="Restar stock de ${esc(p.nombre)}">−</button>
            <span class="stock-num">${p.stock}</span>
            <button type="button" data-stock="1" data-id="${esc(p.id)}" aria-label="Sumar stock de ${esc(p.nombre)}">+</button>
          </div>
          <button type="button" class="btn-icono" data-editar="${esc(p.id)}" aria-label="Editar ${esc(p.nombre)}">✏️</button>
        </div>`;
      }).join('') || '<p class="vacio">No se encontraron productos.</p>';
    }

    function abreviar(n) {
      if (n >= 1000000) return '$' + (n / 1000000).toFixed(1).replace('.', ',') + 'M';
      if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
      return clp(n);
    }

    function graficoBarras(datos) {
      const W = 340, H = 200, base = 168, alto = 130;
      const ancho = W / datos.length;
      const max = Math.max(1, ...datos.map(d => d.v));
      const barras = datos.map((d, i) => {
        const h = Math.round((d.v / max) * alto);
        const w = ancho * 0.62;
        const x = i * ancho + (ancho - w) / 2;
        const esHoy = i === datos.length - 1;
        const dia = esHoy ? 'Hoy' : capitalizar(d.d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', ''));
        return `<g><title>${dia}: ${clp(d.v)}</title>
          <rect x="${x.toFixed(1)}" y="${base - h}" width="${w.toFixed(1)}" height="${h}" rx="5" class="barra${esHoy ? ' barra-hoy' : ''}"></rect>
          <text x="${(x + w / 2).toFixed(1)}" y="${base - h - 6}" class="g-valor">${d.v ? abreviar(d.v) : ''}</text>
          <text x="${(x + w / 2).toFixed(1)}" y="${base + 20}" class="g-dia">${dia}</text></g>`;
      }).join('');
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de ventas de los últimos 7 días"><line x1="0" x2="${W}" y1="${base}" y2="${base}" class="g-eje"></line>${barras}</svg>`;
    }

    function renderBalance(db) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const dias = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - i);
        dias.push(d);
      }
      const semana = db.pedidos.filter(p => new Date(p.creado) >= dias[0]);
      const deHoy = semana.filter(p => mismoDia(new Date(p.creado), hoy));
      const vHoy = deHoy.reduce((s, p) => s + total(p), 0);
      const vSem = semana.reduce((s, p) => s + total(p), 0);
      $('#bal-kpis').innerHTML =
        kpi('Ventas de hoy', clp(vHoy), 'destacado') +
        kpi('Ventas 7 días', clp(vSem)) +
        kpi('Pedidos 7 días', semana.length) +
        kpi('Ticket promedio', clp(semana.length ? vSem / semana.length : 0));
      const porDia = dias.map(d => ({ d, v: semana.filter(p => mismoDia(new Date(p.creado), d)).reduce((s, p) => s + total(p), 0) }));
      $('#bal-grafico').innerHTML = graficoBarras(porDia);
      const acumulado = {};
      semana.forEach(p => p.items.forEach(i => {
        const a = acumulado[i.id] || (acumulado[i.id] = { nombre: i.nombre, emoji: i.emoji, unidades: 0, monto: 0 });
        a.unidades += i.cantidad;
        a.monto += i.cantidad * i.precio;
      }));
      const top = Object.values(acumulado).sort((a, b) => b.unidades - a.unidades || b.monto - a.monto).slice(0, 5);
      const maxU = Math.max(1, ...top.map(t => t.unidades));
      $('#bal-top').innerHTML = top.length
        ? top.map(t => `<div class="top-item">
            <span class="mini-foto" style="width:32px;height:32px;font-size:1.1rem">${esc(t.emoji)}</span>
            <span><strong>${esc(t.nombre)}</strong><br><small>${t.unidades} unidades</small></span>
            <strong>${clp(t.monto)}</strong>
            <span class="top-barra"><i style="width:${Math.round((t.unidades / maxU) * 100)}%"></i></span>
          </div>`).join('')
        : '<p class="vacio">Sin ventas esta semana.</p>';
    }

    function htmlTicket(p) {
      const rep = repartidor(p.repartidor);
      return `<div class="ticket">
        <div class="t-centro"><strong class="t-grande">${esc(neg.nombre.toUpperCase())}</strong><br>${esc(neg.ciudad)} · ${esc(neg.telefonoVisible)}</div>
        <div class="t-sep"></div>
        <div class="t-centro"><strong class="t-grande">TICKET #${p.id}</strong></div>
        <div class="t-fila"><span>Fecha</span><span>${fmtFechaHora(p.creado)}</span></div>
        <div class="t-fila"><span>Entrega</span><span>${esc(fmtDia(p.fechaEntrega))}</span></div>
        <div class="t-fila"><span>Estado</span><span>${esc(p.estado)}</span></div>
        <div class="t-sep"></div>
        ${p.items.map(i => `<div>${esc(i.nombre)}</div><div class="t-fila"><span>${i.cantidad} x ${clp(i.precio)}</span><span>${clp(i.precio * i.cantidad)}</span></div>`).join('')}
        <div class="t-sep"></div>
        <div class="t-fila t-total"><span>TOTAL</span><span>${clp(total(p))}</span></div>
        <div class="t-fila"><span>Pago</span><span>${esc(p.pago)}</span></div>
        <div class="t-sep"></div>
        <div><strong>Cliente:</strong> ${esc(p.cliente.nombre)}</div>
        <div><strong>Tel:</strong> ${esc(p.cliente.telefono)}</div>
        <div><strong>Dirección:</strong> ${esc(p.cliente.direccion)}</div>
        ${p.comentario ? `<div><strong>Nota:</strong> ${esc(p.comentario)}</div>` : ''}
        ${rep ? `<div><strong>Repartidor:</strong> ${esc(rep.nombre)}</div>` : ''}
        <div class="t-sep"></div>
        <div class="t-centro">¡Gracias por su compra!<br><small>Documento sin validez tributaria · Demo</small></div>
      </div>`;
    }

    function imprimir(p) {
      $('#ticket-print').innerHTML = htmlTicket(p);
      setTimeout(() => window.print(), 50);
    }

    function verTicket(id) {
      const p = cargar().pedidos.find(x => x.id === id);
      if (!p) return;
      const cont = abrirModal(`<h2>Ticket #${p.id}</h2>
        <div class="ticket-vista">${htmlTicket(p)}</div>
        <button type="button" class="btn btn-primario btn-grande" id="btn-print">🖨️ Imprimir</button>
        <button type="button" class="btn btn-texto" id="btn-volver-pedido">← Volver al pedido</button>`);
      $('#btn-print', cont).addEventListener('click', () => imprimir(p));
      $('#btn-volver-pedido', cont).addEventListener('click', () => abrirPedido(p.id));
    }

    function mensajeRepartidor(p, rep) {
      return [
        `Hola ${rep.nombre.split(' ')[0]}, tienes un despacho de *${neg.nombre}*`,
        '',
        `*Pedido #${p.id}*`,
        `📦 ${resumenItems(p)}`,
        `👤 ${p.cliente.nombre}`,
        `📞 ${p.cliente.telefono}`,
        `📍 ${p.cliente.direccion}`,
        `🗓️ Entrega: ${fmtDia(p.fechaEntrega)}`,
        `💰 Total: ${clp(total(p))} (${p.pago})`,
        p.comentario ? `📝 ${p.comentario}` : null,
        '',
        `Mapa: https://maps.google.com/?q=${encodeURIComponent(p.cliente.direccion)}`
      ].filter(l => l !== null).join('\n');
    }

    function abrirPedido(id) {
      const p = cargar().pedidos.find(x => x.id === id);
      if (!p) return;
      const rep = repartidor(p.repartidor);
      const textoCliente = `Hola ${p.cliente.nombre.split(' ')[0]}, te escribimos de ${neg.nombre} por tu pedido #${p.id}.`;
      const cont = abrirModal(`<h2>Pedido #${p.id}</h2>
        <p class="nota">Recibido ${fmtFechaHora(p.creado)} · Pago: ${esc(p.pago)}</p>
        <div class="segmentado" role="group" aria-label="Estado del pedido">
          ${ESTADOS.map(e => `<button type="button" data-estado="${e}" class="${p.estado === e ? 'activo ' + claseEstado(e) : ''}" aria-pressed="${p.estado === e}">${e}</button>`).join('')}
        </div>
        <div class="tarjeta">
          <table class="tabla-items">
            <tbody>${p.items.map(i => `<tr><td>${i.cantidad}×</td><td>${esc(i.emoji)} ${esc(i.nombre)}</td><td class="der">${clp(i.precio * i.cantidad)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2">Total</td><td class="der">${clp(total(p))}</td></tr></tfoot>
          </table>
        </div>
        <div class="tarjeta datos-cliente">
          <p><span>Cliente</span><strong>${esc(p.cliente.nombre)}</strong></p>
          <p><span>Teléfono</span><a href="tel:+${esc(telWa(p.cliente.telefono))}">${esc(p.cliente.telefono)}</a></p>
          <p><span>Dirección</span><strong>${esc(p.cliente.direccion)}</strong></p>
          <p><span>Entrega</span><strong>${esc(fmtDia(p.fechaEntrega))}</strong></p>
          ${p.comentario ? `<p><span>Comentario</span><strong>${esc(p.comentario)}</strong></p>` : ''}
        </div>
        <div class="tarjeta">
          <h3>Repartidor</h3>
          <select id="sel-rep" aria-label="Elegir repartidor">
            <option value="">Elegir repartidor…</option>
            ${reps.map(r => `<option value="${esc(r.id)}"${p.repartidor === r.id ? ' selected' : ''}>${esc(r.nombre)} · ${esc(r.vehiculo)}</option>`).join('')}
          </select>
          <div class="acciones-2">
            <button type="button" id="btn-asignar" class="btn btn-secundario">Asignar repartidor</button>
            <button type="button" id="btn-wsp" class="btn btn-wsp"${rep ? '' : ' disabled'}>Enviar por WhatsApp</button>
          </div>
          <p class="nota">${rep ? `Asignado a <strong>${esc(rep.nombre)}</strong>` : 'Sin repartidor asignado'}</p>
        </div>
        <div class="acciones-2">
          <button type="button" id="btn-ticket" class="btn btn-primario">🧾 Ver ticket</button>
          <a class="btn btn-secundario" href="https://wa.me/${esc(telWa(p.cliente.telefono))}?text=${encodeURIComponent(textoCliente)}" target="_blank" rel="noopener">💬 Escribir al cliente</a>
        </div>`);

      $$('[data-estado]', cont).forEach(b => b.addEventListener('click', () => {
        const nuevo = b.dataset.estado;
        if (USA_API) { cambiarPedido(id, { estado: nuevo }, `Pedido #${id}: ${nuevo}`); return; }
        actualizar(db => { const x = db.pedidos.find(y => y.id === id); if (x) x.estado = nuevo; });
        toast(`Pedido #${id}: ${nuevo}`);
        render();
        abrirPedido(id);
      }));

      $('#btn-asignar', cont).addEventListener('click', () => {
        const rid = $('#sel-rep', cont).value;
        if (!rid) { toast('Elige un repartidor de la lista'); return; }
        if (USA_API) { cambiarPedido(id, { repartidor: rid }, `Asignado a ${repartidor(rid).nombre}`); return; }
        actualizar(db => { const x = db.pedidos.find(y => y.id === id); if (x) x.repartidor = rid; });
        toast(`Asignado a ${repartidor(rid).nombre}`);
        render();
        abrirPedido(id);
      });

      $('#btn-wsp', cont).addEventListener('click', () => {
        const actual = cargar().pedidos.find(x => x.id === id);
        const r = actual && repartidor(actual.repartidor);
        if (!r) return;
        window.open(`https://wa.me/${r.telefono}?text=${encodeURIComponent(mensajeRepartidor(actual, r))}`, '_blank', 'noopener');
      });

      $('#btn-ticket', cont).addEventListener('click', () => verTicket(id));
    }

    async function cambiarPedido(id, cambio, mensaje) {
      $$('#modal-contenido button').forEach(b => { b.disabled = true; });
      try {
        const p = await api('panel/pedidos/' + id, { method: 'PATCH', body: cambio });
        reemplazar(remoto.pedidos, p);
        toast(mensaje);
      } catch (e) {
        toast(e.message);
      }
      render();
      if (!$('#modal').hidden) abrirPedido(id);
    }

    function abrirEditor(id, codigoInicial) {
      const db = cargar();
      const p = id ? db.productos.find(x => x.id === id) : null;
      const v = p || { nombre: '', precio: '', stock: 0, stockMin: 3, emoji: '🎁', codigo: codigoInicial || '', categoria: '', descripcion: '' };
      const cats = [...new Set(db.productos.map(x => x.categoria))];
      const cont = abrirModal(`<h2>${p ? 'Editar producto' : 'Nuevo producto'}</h2>
        <form id="form-prod" class="form" novalidate>
          <label>Nombre<input name="nombre" required value="${esc(v.nombre)}" placeholder="Ej: Chaleco de lana"></label>
          <div class="dos-col">
            <label>Precio (CLP)<input name="precio" type="number" inputmode="numeric" min="0" step="10" required value="${esc(v.precio)}" placeholder="12990"></label>
            <label>Emoji / foto<input name="emoji" maxlength="8" value="${esc(v.emoji)}"></label>
          </div>
          <div class="dos-col">
            <label>Stock<input name="stock" type="number" inputmode="numeric" min="0" value="${esc(v.stock)}"></label>
            <label>Stock mínimo<input name="stockMin" type="number" inputmode="numeric" min="0" value="${esc(v.stockMin)}"></label>
          </div>
          <label>Categoría<input name="categoria" list="lista-cats" value="${esc(v.categoria)}" placeholder="Ej: Textil"></label>
          <datalist id="lista-cats">${cats.map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist>
          <label>Código de barras<input name="codigo" inputmode="numeric" value="${esc(v.codigo)}"></label>
          <label>Descripción<textarea name="descripcion" rows="2">${esc(v.descripcion)}</textarea></label>
          <p class="form-error" hidden></p>
          <button class="btn btn-primario btn-grande" type="submit">Guardar</button>
        </form>`);

      $('#form-prod', cont).addEventListener('submit', async e => {
        e.preventDefault();
        const f = e.target;
        const nombre = f.nombre.value.trim();
        const precio = Math.round(Number(f.precio.value));
        const err = $('.form-error', f);
        if (nombre.length < 2) { err.textContent = 'Escribe el nombre del producto.'; err.hidden = false; return; }
        if (!(precio > 0)) { err.textContent = 'Ingresa un precio mayor a $0.'; err.hidden = false; return; }
        const datos = {
          nombre,
          precio,
          stock: Math.max(0, Math.round(Number(f.stock.value) || 0)),
          stockMin: Math.max(0, Math.round(Number(f.stockMin.value) || 0)),
          emoji: f.emoji.value.trim() || '🎁',
          categoria: f.categoria.value.trim() || 'Otros',
          codigo: f.codigo.value.trim(),
          descripcion: f.descripcion.value.trim()
        };
        if (USA_API) {
          const btn = $('[type=submit]', f);
          btn.disabled = true;
          try {
            const prod = await api(id ? 'panel/productos/' + id : 'panel/productos', { method: id ? 'PUT' : 'POST', body: datos });
            reemplazar(remoto.productos, prod);
            if (!id) remoto.productos.push(remoto.productos.shift());
            cerrarModal();
            toast(p ? 'Producto actualizado' : 'Producto agregado');
            render();
          } catch (e2) {
            err.textContent = e2.message;
            err.hidden = false;
          } finally {
            btn.disabled = false;
          }
          return;
        }
        actualizar(db2 => {
          const x = id && db2.productos.find(y => y.id === id);
          if (x) Object.assign(x, datos);
          else db2.productos.push(Object.assign({ id: 'p' + Date.now(), tono: azar(TONOS), activo: true }, datos));
        });
        cerrarModal();
        toast(p ? 'Producto actualizado' : 'Producto agregado');
        render();
      });
    }

    function cambiarStock(id, delta) {
      if (USA_API) {
        const p = remoto.productos.find(x => x.id === id);
        if (!p) return;
        const previo = p.stock;
        p.stock = Math.max(0, p.stock + delta);
        render();
        api('panel/productos/' + id + '/stock', { method: 'POST', body: { delta } })
          .then(prod => { reemplazar(remoto.productos, prod); render(); })
          .catch(e => { p.stock = previo; render(); toast(e.message); });
        return;
      }
      actualizar(db => {
        const p = db.productos.find(x => x.id === id);
        if (p) p.stock = Math.max(0, p.stock + delta);
      });
      render();
    }

    function detenerCamara() {
      clearTimeout(timerScan);
      timerScan = null;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
    }

    async function abrirEscaner() {
      const cont = abrirModal(`<h2>Escanear código</h2>
        <div class="visor"><video id="video-scan" playsinline muted autoplay></video><div class="visor-marco"><span class="visor-linea"></span></div></div>
        <p class="nota centro" id="scan-estado">Abriendo cámara…</p>
        <button type="button" class="btn btn-secundario btn-grande" id="btn-simular-scan">Simular lectura</button>`, detenerCamara);
      $('#btn-simular-scan', cont).addEventListener('click', lecturaSimulada);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        $('#scan-estado').textContent = 'Este navegador no permite usar la cámara aquí (requiere HTTPS). Usa "Simular lectura".';
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        const video = $('#video-scan');
        if ($('#modal').hidden || !video) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        video.srcObject = s;
        try { await video.play(); } catch (e) {}
        $('#scan-estado').textContent = 'Apunta al código de barras del producto';
        if ('BarcodeDetector' in window) detectarCodigo(video);
        timerScan = setTimeout(lecturaSimulada, 4500);
      } catch (e) {
        const est = $('#scan-estado');
        if (est) est.textContent = 'No se pudo abrir la cámara (permiso denegado o sin cámara). Usa "Simular lectura".';
      }
    }

    function detectarCodigo(video) {
      let detector;
      try { detector = new window.BarcodeDetector(); } catch (e) { return; }
      const ciclo = async () => {
        if (!stream) return;
        try {
          const r = await detector.detect(video);
          if (r.length && stream) { resultadoScan(r[0].rawValue); return; }
        } catch (e) {}
        setTimeout(ciclo, 350);
      };
      ciclo();
    }

    function lecturaSimulada() {
      const ps = cargar().productos.filter(p => p.codigo);
      resultadoScan(ps.length ? azar(ps).codigo : '7800000000000');
    }

    function resultadoScan(codigo) {
      if ($('#modal').hidden || !$('#scan-estado')) return;
      detenerCamara();
      try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
      const p = cargar().productos.find(x => x.codigo === codigo);
      if (p) {
        const cont = abrirModal(`<h2>Código leído</h2>
          <p class="codigo-leido">${esc(codigo)}</p>
          <div class="fila">
            <div class="mini-foto" style="--tono:${esc(p.tono || TONOS[0])}">${esc(p.emoji)}</div>
            <div class="fila-info"><strong>${esc(p.nombre)}</strong><span>${clp(p.precio)} · Stock: <b id="scan-stock">${p.stock}</b></span></div>
          </div>
          <div class="acciones-2">
            <button type="button" class="btn btn-primario" id="scan-mas">+1 al stock</button>
            <button type="button" class="btn btn-secundario" id="scan-menos">−1 (venta)</button>
          </div>
          <div class="acciones-2">
            <button type="button" class="btn btn-texto" id="scan-editar">✏️ Editar</button>
            <button type="button" class="btn btn-texto" id="scan-otro">📷 Escanear otro</button>
          </div>`);
        const ajustar = delta => {
          cambiarStock(p.id, delta);
          const nuevo = cargar().productos.find(x => x.id === p.id);
          $('#scan-stock', cont).textContent = nuevo ? nuevo.stock : 0;
          toast(delta > 0 ? 'Stock +1' : 'Stock −1');
        };
        $('#scan-mas', cont).addEventListener('click', () => ajustar(1));
        $('#scan-menos', cont).addEventListener('click', () => ajustar(-1));
        $('#scan-editar', cont).addEventListener('click', () => abrirEditor(p.id));
        $('#scan-otro', cont).addEventListener('click', abrirEscaner);
      } else {
        const cont = abrirModal(`<h2>Producto no registrado</h2>
          <p class="codigo-leido">${esc(codigo)}</p>
          <p>Este código no está en tu catálogo.</p>
          <button type="button" class="btn btn-primario btn-grande" id="scan-crear">+ Crear producto con este código</button>
          <button type="button" class="btn btn-texto" id="scan-otro">📷 Escanear otro</button>`);
        $('#scan-crear', cont).addEventListener('click', () => abrirEditor(null, codigo));
        $('#scan-otro', cont).addEventListener('click', abrirEscaner);
      }
    }

    function descargarCSV(nombre, filas) {
      const celda = v => {
        const s = String(v ?? '');
        return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const contenido = '﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n');
      const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function exportarVentas() {
      const db = cargar();
      const filas = [['N° pedido', 'Fecha', 'Hora', 'Cliente', 'Teléfono', 'Dirección', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal', 'Total pedido', 'Medio de pago', 'Estado', 'Fecha entrega', 'Repartidor']];
      ordenar(db.pedidos).forEach(p => {
        const rep = repartidor(p.repartidor);
        p.items.forEach(i => filas.push([
          p.id, fmtFecha(p.creado), fmtHora(p.creado), p.cliente.nombre, p.cliente.telefono, p.cliente.direccion,
          i.nombre, i.cantidad, i.precio, i.precio * i.cantidad, total(p), p.pago, p.estado,
          fechaLocal(p.fechaEntrega).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          rep ? rep.nombre : ''
        ]));
      });
      descargarCSV(`ventas_${isoLocal(new Date())}.csv`, filas);
      toast('Excel de ventas descargado');
    }

    function exportarStock() {
      const db = cargar();
      const filas = [['Código', 'Producto', 'Categoría', 'Precio', 'Stock', 'Stock mínimo', 'Estado', 'Valor inventario']];
      db.productos.forEach(p => filas.push([
        p.codigo || '', p.nombre, p.categoria, p.precio, p.stock, p.stockMin,
        p.stock <= 0 ? 'Agotado' : p.stock <= p.stockMin ? 'Stock bajo' : 'OK',
        p.precio * p.stock
      ]));
      descargarCSV(`stock_${isoLocal(new Date())}.csv`, filas);
      toast('Excel de stock descargado');
    }

    function confirmarReset() {
      const cont = abrirModal(`<h2>¿Restablecer la demo?</h2>
        <p>Se borrarán los pedidos, productos y cambios hechos durante la presentación, y se cargarán los datos de ejemplo.</p>
        <button type="button" class="btn btn-primario btn-grande" id="si-reset">Sí, restablecer</button>
        <button type="button" class="btn btn-texto" data-cerrar>Cancelar</button>`);
      $('#si-reset', cont).addEventListener('click', () => {
        guardar(semilla());
        escribir(KEY_VISTOS, String(maxSemilla));
        escribir(KEY_CARRITO, '{}');
        cerrarModal();
        $('#alertas').innerHTML = '';
        toast('Demo restablecida');
        render();
      });
    }

    function sonar() {
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
      try {
        if (!audio) return;
        if (audio.state === 'suspended') audio.resume();
        [0, 0.22].forEach(retraso => {
          const t = audio.currentTime + retraso;
          const o = audio.createOscillator();
          const g = audio.createGain();
          o.type = 'sine';
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          o.connect(g);
          g.connect(audio.destination);
          o.start(t);
          o.stop(t + 0.2);
        });
      } catch (e) {}
    }

    async function mostrarNotificacion(titulo, cuerpo, tag) {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const opciones = { body: cuerpo, icon: 'icons/icon.svg', badge: 'icons/icon.svg', tag: tag || 'mi-puesto', renotify: true, data: { url: 'negocio.html#pedidos' } };
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) { await reg.showNotification(titulo, opciones); return; }
        }
      } catch (e) {}
      try { new Notification(titulo, opciones); } catch (e) {}
    }

    function actualizarNotifUI() {
      const btn = $('#btn-notif');
      if (!window.isSecureContext) {
        btn.hidden = true;
        $('#aviso-notif').hidden = true;
        return;
      }
      const estado = 'Notification' in window ? Notification.permission : 'unsupported';
      btn.classList.toggle('activo', estado === 'granted');
      btn.setAttribute('aria-label', estado === 'granted' ? 'Notificaciones activadas' : 'Activar notificaciones');
      btn.title = estado === 'granted' ? 'Notificaciones activadas' : 'Activar notificaciones';
      $('#aviso-notif').hidden = estado !== 'default';
    }

    async function pedirPermiso() {
      if (!('Notification' in window)) { toast('Este navegador no soporta notificaciones'); return; }
      if (Notification.permission === 'granted') {
        mostrarNotificacion('🔔 Notificaciones activas', 'Así te avisaremos de cada pedido nuevo.', 'prueba');
        toast('Las notificaciones ya están activas');
        return;
      }
      if (Notification.permission === 'denied') { toast('Están bloqueadas: actívalas en los ajustes del navegador'); return; }
      let r = 'default';
      try { r = await Notification.requestPermission(); } catch (e) {}
      actualizarNotifUI();
      if (r === 'granted') {
        toast('¡Listo! Te avisaremos de cada pedido');
        mostrarNotificacion('🔔 Notificaciones activadas', 'Así te llegarán los pedidos nuevos.', 'prueba');
      }
    }

    function mostrarAlerta(p) {
      const div = document.createElement('div');
      div.className = 'alerta';
      div.innerHTML = `<div class="alerta-cab"><span>🔔 Nuevo pedido · ${clp(total(p))}</span><button type="button" class="alerta-x" aria-label="Cerrar alerta">×</button></div>
        <table class="tabla-ticket">
          <thead><tr><th>Ticket</th><th>Producto(s)</th><th>Nombre</th><th>Dirección</th><th>Fecha</th><th>Entrega</th></tr></thead>
          <tbody><tr>
            <td data-label="Ticket"><strong>#${p.id}</strong></td>
            <td data-label="Producto(s)">${esc(resumenItems(p))}</td>
            <td data-label="Nombre">${esc(p.cliente.nombre)}</td>
            <td data-label="Dirección">${esc(p.cliente.direccion)}</td>
            <td data-label="Fecha">${fmtFechaHora(p.creado)}</td>
            <td data-label="Entrega">${esc(fmtDia(p.fechaEntrega))}</td>
          </tr></tbody>
        </table>
        <div class="alerta-acciones">
          <button type="button" class="btn btn-primario btn-chico" data-ver>Ver pedido</button>
          <button type="button" class="btn btn-secundario btn-chico" data-imp>🖨️ Imprimir</button>
        </div>`;
      $('.alerta-x', div).addEventListener('click', () => div.remove());
      $('[data-ver]', div).addEventListener('click', () => { div.remove(); abrirPedido(p.id); });
      $('[data-imp]', div).addEventListener('click', () => imprimir(cargar().pedidos.find(x => x.id === p.id) || p));
      const cont = $('#alertas');
      cont.prepend(div);
      while (cont.children.length > 3) cont.lastElementChild.remove();
    }

    function revisarNuevos() {
      const db = cargar();
      const vistos = Number(leer(KEY_VISTOS)) || 0;
      const nuevos = db.pedidos.filter(p => p.id > vistos).sort((a, b) => a.id - b.id);
      if (!nuevos.length) return;
      escribir(KEY_VISTOS, String(nuevos[nuevos.length - 1].id));
      nuevos.slice(-3).forEach(p => {
        mostrarAlerta(p);
        mostrarNotificacion(`🛍️ Nuevo pedido #${p.id} · ${clp(total(p))}`, `${p.cliente.nombre} · ${resumenItems(p)} · Entrega ${fmtDia(p.fechaEntrega)}`, 'pedido-' + p.id);
      });
      sonar();
    }

    async function sincronizar() {
      if (USA_API) {
        if (sincronizando || document.hidden) return;
        sincronizando = true;
        try {
          const raw = await cargarPanel();
          if (raw !== ultimoRaw) {
            ultimoRaw = raw;
            revisarNuevos();
            render();
          }
        } catch (e) {
        } finally {
          sincronizando = false;
        }
        return;
      }
      const raw = leer(KEY);
      if (raw === ultimoRaw) return;
      revisarNuevos();
      render();
    }

    function simularPedido() {
      toast('Llegará un pedido de prueba en 5 segundos…');
      setTimeout(() => {
        const disponibles = cargar().productos.filter(p => p.stock > 0);
        if (!disponibles.length) { toast('No hay stock para simular un pedido'); return; }
        const elegidos = [...disponibles].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
        const entrega = new Date();
        entrega.setDate(entrega.getDate() + 1 + Math.floor(Math.random() * 2));
        if (USA_API) {
          const c = azar(window.DEMO_DATA.clientesEjemplo);
          api('tienda/' + encodeURIComponent(neg.slug) + '/pedidos', {
            method: 'POST',
            body: {
              cliente: { nombre: c.nombre, telefono: c.telefono, direccion: c.direccion },
              fechaEntrega: isoLocal(entrega),
              comentario: '',
              pago: azar(PAGOS),
              items: elegidos.map(p => ({ id: p.id, cantidad: 1 + Math.floor(Math.random() * 2) }))
            }
          }).then(() => sincronizar()).catch(e => toast(e.message));
          return;
        }
        crearPedido({
          cliente: Object.assign({}, azar(window.DEMO_DATA.clientesEjemplo)),
          fechaEntrega: isoLocal(entrega),
          pago: azar(PAGOS)
        }, elegidos.map(p => ({ id: p.id, cantidad: 1 + Math.floor(Math.random() * 2) })));
        revisarNuevos();
        render();
      }, 5000);
    }

    function ruta() {
      let s = location.hash.slice(1) || 'inicio';
      if (!SECCIONES.includes(s)) s = 'inicio';
      seccion = s;
      SECCIONES.forEach(x => { $('#s-' + x).hidden = x !== s; });
      $$('.nav-inferior a').forEach(a => {
        const activo = a.dataset.sec === s;
        a.classList.toggle('activo', activo);
        if (activo) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      cerrarModal();
      render();
      window.scrollTo(0, 0);
    }

    document.addEventListener('click', e => {
      if (e.target.closest('[data-cerrar]')) { cerrarModal(); return; }
      const ped = e.target.closest('[data-pedido]');
      if (ped) { abrirPedido(Number(ped.dataset.pedido)); return; }
      const fil = e.target.closest('[data-filtro]');
      if (fil) { filtro = fil.dataset.filtro; render(); return; }
      const st = e.target.closest('[data-stock]');
      if (st) { cambiarStock(st.dataset.id, Number(st.dataset.stock)); return; }
      const ed = e.target.closest('[data-editar]');
      if (ed) abrirEditor(ed.dataset.editar);
    });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

    document.addEventListener('pointerdown', () => {
      if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) audio = new C();
      } catch (e) {}
    });

    $('#btn-notif').addEventListener('click', pedirPermiso);
    $('#btn-notif-2').addEventListener('click', pedirPermiso);
    $('#btn-simular').addEventListener('click', simularPedido);
    $('#btn-nuevo-prod').addEventListener('click', () => abrirEditor(null));
    $('#btn-escanear').addEventListener('click', abrirEscaner);
    $('#buscar-prod').addEventListener('input', e => { busqueda = e.target.value.trim(); renderProductos(cargar()); });
    $('#btn-csv-ventas').addEventListener('click', exportarVentas);
    $('#btn-csv-stock').addEventListener('click', exportarStock);
    $('#btn-reset').addEventListener('click', confirmarReset);
    $('#btn-reset').hidden = USA_API;
    $('#btn-salir').addEventListener('click', () => {
      borrar(KEY_SESION);
      location.replace('negocio.html');
    });

    window.addEventListener('hashchange', ruta);
    if (!USA_API) window.addEventListener('storage', e => { if (e.key === KEY) sincronizar(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(); });
    setInterval(sincronizar, 3000);

    ruta();
    revisarNuevos();
  }

  registrarSW();
  const pagina = document.body.dataset.page;
  if (pagina === 'portada') initPortada();
  if (pagina === 'cliente') { if (USA_API) initClienteApi(); else initCliente(); }
  if (pagina === 'negocio') initNegocio();
})();
