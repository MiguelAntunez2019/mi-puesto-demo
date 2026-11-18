(function () {
  const ahora = new Date();

  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const productos = [
    { id: 'p1', nombre: 'Manta tejida a telar', descripcion: 'Lana de oveja hilada a mano, diseño ñimin.', precio: 45990, stock: 4, stockMin: 2, emoji: '🧣', tono: '#F3D9C8', categoria: 'Textil', codigo: '7801234500011', activo: true },
    { id: 'p2', nombre: 'Witral decorativo', descripcion: 'Telar pequeño para colgar, lana natural.', precio: 34990, stock: 6, stockMin: 2, emoji: '🧶', tono: '#EADBF0', categoria: 'Textil', codigo: '7801234500028', activo: true },
    { id: 'p3', nombre: 'Trapelakucha en alpaca', descripcion: 'Réplica de joya tradicional hecha a mano.', precio: 18990, stock: 3, stockMin: 3, emoji: '📿', tono: '#E4E8F2', categoria: 'Platería', codigo: '7801234500035', activo: true },
    { id: 'p4', nombre: 'Aros de alpaca', descripcion: 'Aros livianos con diseño de luna.', precio: 9990, stock: 15, stockMin: 4, emoji: '💎', tono: '#DDEEF0', categoria: 'Platería', codigo: '7801234500042', activo: true },
    { id: 'p5', nombre: 'Canasto de ñocha', descripcion: 'Fibra vegetal tejida, 25 cm de diámetro.', precio: 14990, stock: 8, stockMin: 3, emoji: '🧺', tono: '#F4E6C9', categoria: 'Cestería', codigo: '7801234500059', activo: true },
    { id: 'p6', nombre: 'Set de cucharas de raulí', descripcion: 'Tres cucharas talladas a mano en madera nativa.', precio: 12990, stock: 2, stockMin: 2, emoji: '🥄', tono: '#F2D4CF', categoria: 'Madera', codigo: '7801234500066', activo: true },
    { id: 'p7', nombre: 'Merkén ahumado 100 g', descripcion: 'Ají cacho de cabra ahumado y molido con semillas.', precio: 3990, stock: 40, stockMin: 10, emoji: '🌶️', tono: '#F8D3C5', categoria: 'Despensa', codigo: '7801234500073', activo: true },
    { id: 'p8', nombre: 'Miel de ulmo 500 g', descripcion: 'Miel cruda de la Araucanía.', precio: 7990, stock: 12, stockMin: 5, emoji: '🍯', tono: '#FBE7B5', categoria: 'Despensa', codigo: '7801234500080', activo: true },
    { id: 'p9', nombre: 'Calcetines de lana', descripcion: 'Tejidos a palillo, talla única.', precio: 6990, stock: 20, stockMin: 5, emoji: '🧦', tono: '#E3EED9', categoria: 'Textil', codigo: '7801234500097', activo: true },
    { id: 'p10', nombre: 'Tazón de greda', descripcion: 'Greda cocida, apto para bebidas calientes.', precio: 8990, stock: 4, stockMin: 5, emoji: '🏺', tono: '#EFDCCB', categoria: 'Madera', codigo: '7801234500103', activo: true }
  ];

  const clientes = [
    { nombre: 'María González', telefono: '+56 9 0000 1101', direccion: 'Av. Alemania 0450, Temuco' },
    { nombre: 'José Huenchullán', telefono: '+56 9 0000 1102', direccion: 'Los Aromos 1234, Padre Las Casas' },
    { nombre: 'Valentina Soto', telefono: '+56 9 0000 1103', direccion: 'Manuel Montt 875, depto 302, Temuco' },
    { nombre: 'Pedro Antilef', telefono: '+56 9 0000 1104', direccion: 'Pasaje Las Rosas 56, Labranza' },
    { nombre: 'Francisca Muñoz', telefono: '+56 9 0000 1105', direccion: 'Av. Caupolicán 1580, Temuco' },
    { nombre: 'Diego Catalán', telefono: '+56 9 0000 1106', direccion: 'Camino a Chol Chol km 3, Temuco' },
    { nombre: 'Javiera Painemal', telefono: '+56 9 0000 1107', direccion: 'Bulnes 340, Villarrica' },
    { nombre: 'Carlos Fuentes', telefono: '+56 9 0000 1108', direccion: 'Prieto Norte 612, Temuco' }
  ];

  const repartidores = [
    { id: 'r1', nombre: 'Juan Pérez', vehiculo: 'Moto', telefono: '56900000101' },
    { id: 'r2', nombre: 'Camila Rojas', vehiculo: 'Bicicleta', telefono: '56900000102' },
    { id: 'r3', nombre: 'Despachos Sur Express', vehiculo: 'Furgón', telefono: '56900000103' }
  ];

  const especificacion = [
    [1001, 6, 10, 15, 0, [['p1', 1]], 'Webpay', 'Entregado', 1, 'r1'],
    [1002, 6, 16, 40, 1, [['p7', 3], ['p8', 1]], 'Transferencia', 'Entregado', 1, 'r2'],
    [1003, 5, 11, 5, 2, [['p4', 2]], 'Mercado Pago', 'Entregado', 2, 'r2'],
    [1004, 5, 18, 30, 3, [['p5', 1], ['p9', 2]], 'Webpay', 'Entregado', 1, 'r1'],
    [1005, 4, 12, 10, 4, [['p2', 1]], 'Transferencia', 'Entregado', 2, 'r3'],
    [1006, 3, 9, 50, 5, [['p7', 2], ['p9', 1]], 'Mercado Pago', 'Entregado', 1, 'r2'],
    [1007, 3, 15, 20, 6, [['p3', 1], ['p4', 1]], 'Webpay', 'Entregado', 3, 'r3'],
    [1008, 2, 10, 45, 7, [['p8', 2]], 'Transferencia', 'Entregado', 1, 'r1'],
    [1009, 2, 13, 0, 0, [['p6', 1], ['p10', 2]], 'Webpay', 'Despachado', 2, 'r3'],
    [1010, 1, 11, 30, 1, [['p1', 1], ['p7', 1]], 'Mercado Pago', 'Despachado', 1, 'r1'],
    [1011, 1, 17, 15, 2, [['p9', 3]], 'Webpay', 'Preparando', 2, null],
    [1012, 0, 9, 20, 3, [['p4', 1], ['p8', 1]], 'Transferencia', 'Preparando', 1, null],
    [1013, 0, 11, 45, 4, [['p5', 2]], 'Webpay', 'Nuevo', 1, null]
  ];

  const porId = Object.fromEntries(productos.map(p => [p.id, p]));

  const pedidos = especificacion.map(([id, dias, hora, minuto, ci, items, pago, estado, entregaDias, repartidor]) => {
    const creado = new Date(ahora);
    creado.setDate(creado.getDate() - dias);
    creado.setHours(hora, minuto, 0, 0);
    if (creado > ahora) creado.setTime(ahora.getTime() - ((id % 7) + 1) * 9 * 60000);
    const entrega = new Date(creado);
    entrega.setDate(entrega.getDate() + entregaDias);
    return {
      id,
      creado: creado.toISOString(),
      estado,
      pago,
      repartidor,
      cliente: Object.assign({}, clientes[ci]),
      fechaEntrega: iso(entrega),
      comentario: '',
      items: items.map(([pid, cantidad]) => {
        const p = porId[pid];
        return { id: pid, nombre: p.nombre, emoji: p.emoji, precio: p.precio, cantidad };
      })
    };
  });

  window.DEMO_DATA = {
    negocio: {
      nombre: 'Artesanías Mapuche Rayen',
      slogan: 'Hecho a mano en la Araucanía',
      duena: 'Rayen',
      ciudad: 'Temuco',
      telefonoVisible: '+56 9 0000 0000'
    },
    productos,
    pedidos,
    repartidores,
    clientesEjemplo: clientes
  };
})();
