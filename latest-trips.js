function parseFecha(fechaRaw) {
  if (!fechaRaw) return '';
  if (typeof fechaRaw === 'string') {
    const fecha = new Date(fechaRaw);
    if (isNaN(fecha.getTime())) return '';
    return fecha;
  }
  if (typeof fechaRaw === 'object' && typeof fechaRaw.seconds === 'number') {
    return new Date(fechaRaw.seconds * 1000);
  }
  return '';
}

function esViajeConSalidaPosteriorAhora(data) {
  const instante = parseFecha(data.fecha);
  if (!instante || isNaN(instante.getTime())) {
    return false;
  }
  return instante.getTime() > Date.now();
}

function formatearFecha(fechaRaw) {
  const fecha = parseFecha(fechaRaw);
  if (!fecha || isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatearHora(horaStr) {
  if (!horaStr) return '';
  return horaStr.slice(0, 5);
}

function formatearPrecio(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return '';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(numero);
}

function escapeHtml(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function generarQR(texto) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(texto)}`;
}

function parseDireccion(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object') {
    if (obj.direccion) return obj.direccion;
    if (obj.lat && obj.lng) return `${obj.lat}, ${obj.lng}`;
    return JSON.stringify(obj);
  }
  return '';
}

function splitLocalidadDireccion(nombre) {
  if (!nombre) return { localidad: '', direccion: '' };
  const partes = nombre.split(',');
  if (partes.length === 1) {
    return { localidad: nombre.trim(), direccion: '' };
  }
  return {
    direccion: partes[0].trim(),
    localidad: partes.slice(1).join(',').trim()
  };
}

function obtenerInfoPaquetes(data) {
  const definiciones = {
    chico: {
      label: 'Chico',
      descripcion: 'Hasta 30x30x30 cm, máximo 5 kg'
    },
    mediano: {
      label: 'Mediano',
      descripcion: 'Hasta 50x50x50 cm, máximo 15 kg'
    },
    grande: {
      label: 'Grande',
      descripcion: 'Hasta 80x80x80 cm, máximo 30 kg'
    }
  };

  const aceptaPaquetes = data.aceptaPaquetes ?? data.acepta_paquetes ?? false;
  const rawConfig = data.paquetesConfig || data.paquetes_config || data.packages_config || null;
  const tipos = [];

  if (rawConfig && typeof rawConfig === 'object') {
    for (const [key, fallback] of Object.entries(definiciones)) {
      const config = rawConfig[key];
      if (!config || typeof config !== 'object') continue;
      const activo = config.activo === true || config.active === true;
      const precio = config.precio ?? config.price ?? null;
      if (!activo && !precio) continue;
      tipos.push({
        key,
        label: fallback.label,
        descripcion: config.descripcion || config.description || fallback.descripcion,
        precio: formatearPrecio(precio)
      });
    }
  }

  const precioGeneral = formatearPrecio(data.precioPaquete || data.precio_paquete || data.packagePrice);
  if (tipos.length === 0 && (aceptaPaquetes || precioGeneral)) {
    tipos.push({
      key: 'general',
      label: 'Paquete',
      descripcion: 'Consultá tamaños disponibles en la app',
      precio: precioGeneral
    });
  }

  return {
    acepta: Boolean(aceptaPaquetes || tipos.length),
    tipos
  };
}

function obtenerConductor(data) {
  const user = data.userData || data.user || data.driver || {};
  const candidatos = [
    user.username,
    user.name,
    data.driverName,
    data.driver_name,
    data.driverUsername,
    data.driver_username
  ];

  const nombre = candidatos
    .map((valor) => String(valor || '').trim())
    .find((valor) => valor && valor.toLowerCase() !== 'usuario');

  const profileImageUrl = user.profileImageUrl || user.profile_image_url || '';
  const verified = Boolean(user.verified ?? user.nosis_verified ?? user.nosisVerified);

  return {
    nombre: nombre || '',
    profileImageUrl,
    verified
  };
}

function renderPaquetes(infoPaquetes) {
  if (!infoPaquetes.acepta) {
    return `
      <div class="trip-packages trip-packages-disabled">
        <div class="trip-packages-title">
          <i class="fa-solid fa-box-open" aria-hidden="true"></i>
          <span>No acepta paquetes</span>
        </div>
      </div>
    `;
  }

  const chips = infoPaquetes.tipos.map((tipo) => `
    <div class="trip-package-chip" title="${escapeHtml(tipo.descripcion)}">
      <span class="trip-package-chip-label">${escapeHtml(tipo.label)}</span>
      <span class="trip-package-chip-price">${escapeHtml(tipo.precio || 'Consultar')}</span>
    </div>
  `).join('');

  return `
    <div class="trip-packages">
      <div class="trip-packages-title">
        <i class="fa-solid fa-box-open" aria-hidden="true"></i>
        <span>Acepta paquetes</span>
      </div>
      <div class="trip-packages-list">
        ${chips}
      </div>
    </div>
  `;
}

function renderRuta(origenSplit, destinoSplit) {
  const origenDetalle = origenSplit.direccion
    ? `<span class="trip-direccion">${escapeHtml(origenSplit.direccion)}</span>`
    : '';
  const destinoDetalle = destinoSplit.direccion
    ? `<span class="trip-direccion">${escapeHtml(destinoSplit.direccion)}</span>`
    : '';

  return `
    <div class="trip-route">
      <div class="trip-route-point">
        <span class="trip-localidad">${escapeHtml(origenSplit.localidad || 'Origen')}</span>
        ${origenDetalle}
      </div>
      <div class="trip-arrow" aria-hidden="true">
        <i class="fa-solid fa-arrow-down"></i>
      </div>
      <div class="trip-route-point">
        <span class="trip-localidad">${escapeHtml(destinoSplit.localidad || 'Destino')}</span>
        ${destinoDetalle}
      </div>
    </div>
  `;
}

function renderConductor(conductor) {
  if (!conductor.nombre) {
    return '';
  }

  const userImg = conductor.profileImageUrl || 'images/viajapp-logo.png';
  const verifiedBadge = conductor.verified
    ? '<span class="trip-user-verified" title="Identidad verificada con Nosis"><i class="fas fa-circle-check" aria-hidden="true"></i> Verificado</span>'
    : '';

  return `
    <div class="trip-user">
      <img src="${escapeHtml(userImg)}" alt="" class="trip-user-img" loading="lazy" />
      <div class="trip-user-meta">
        <span class="trip-user-name">${escapeHtml(conductor.nombre)}</span>
        ${verifiedBadge}
      </div>
    </div>
  `;
}

function renderTripCard(data) {
  const origenRaw = data.nombreOrigen || parseDireccion(data.coordOrigen) || 'Origen';
  const destinoRaw = data.nombreDestino || parseDireccion(data.coordDestino) || 'Destino';
  const origenSplit = splitLocalidadDireccion(origenRaw);
  const destinoSplit = splitLocalidadDireccion(destinoRaw);
  const fecha = formatearFecha(data.fecha);
  const hora = formatearHora(data.hora || '');
  const lugares = data.lugares || (data.listaPasajeros && data.listaPasajeros.lugares) || '';
  const precio = formatearPrecio(data.precio);
  const info = data.informacion || '';
  const qrData = `https://viajapp.com.ar/viaje/${data.id}`;
  const qrUrl = generarQR(qrData);
  const conductor = obtenerConductor(data);
  const infoPaquetes = obtenerInfoPaquetes(data);
  const paquetesHtml = renderPaquetes(infoPaquetes);
  const asientosTexto = lugares ? `${lugares} asiento${Number(lugares) === 1 ? '' : 's'}` : 'Sin asientos informados';
  const infoEscapada = escapeHtml(info);
  const infoHtml = infoEscapada
    ? `<div class="trip-info trip-info-multiline" title="${infoEscapada}"><small>${infoEscapada.replace(/\n/g, '<br>')}</small></div>`
    : '';

  return `
    <article class="trip-card">
      ${renderConductor(conductor)}
      ${renderRuta(origenSplit, destinoSplit)}
      <div class="trip-details">
        <div class="trip-detail-item"><i class="fa-regular fa-calendar" aria-hidden="true"></i><span>${escapeHtml(fecha)}</span></div>
        <div class="trip-detail-item"><i class="fa-regular fa-clock" aria-hidden="true"></i><span>${escapeHtml(hora)}</span></div>
        <div class="trip-detail-item"><i class="fa-solid fa-user-group" aria-hidden="true"></i><span>${escapeHtml(asientosTexto)}</span></div>
        ${precio ? `<div class="trip-detail-item trip-detail-price"><i class="fa-solid fa-tag" aria-hidden="true"></i><span>${escapeHtml(precio)}</span></div>` : ''}
      </div>
      ${paquetesHtml}
      <div class="trip-footer">
        <div class="trip-qr">
          <img src="${qrUrl}" alt="QR para abrir el viaje en la app" width="96" height="96" loading="lazy" />
        </div>
        <p class="trip-qr-hint">Escaneá para ver el viaje en la app</p>
      </div>
      ${infoHtml}
    </article>
  `;
}

function renderEstadoVacio(mensaje, icono) {
  return `
    <div class="trip-card trip-card-empty">
      <div class="trip-packages trip-packages-disabled">
        <div class="trip-packages-title">
          <i class="${icono}" aria-hidden="true"></i>
          <span>${escapeHtml(mensaje)}</span>
        </div>
      </div>
    </div>
  `;
}

async function mostrarUltimosViajes() {
  const tripsList = document.getElementById('trips-list');
  if (!tripsList) return;
  tripsList.innerHTML = '';

  let payload;
  try {
    const response = await fetch('./latest-trips.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch latest-trips.json: ${response.status}`);
    }
    payload = await response.json();
  } catch (error) {
    console.error(error);
    tripsList.innerHTML = renderEstadoVacio('No pudimos cargar los viajes ahora', 'fa-solid fa-circle-exclamation');
    return;
  }

  const viajesRaw = Array.isArray(payload) ? payload : payload?.trips ?? [];
  const viajes = viajesRaw.filter(esViajeConSalidaPosteriorAhora);

  if (viajes.length === 0) {
    tripsList.innerHTML = renderEstadoVacio('No hay viajes disponibles en este momento', 'fa-regular fa-calendar');
    return;
  }

  tripsList.innerHTML = viajes.map(renderTripCard).join('');
}

document.addEventListener('DOMContentLoaded', mostrarUltimosViajes);
