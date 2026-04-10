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
  return horaStr.slice(0,5); // "14:00"
}

function formatearPrecio(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return '';
  return `${numero} AR$`;
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
  // Usamos api.qrserver.com para generar el QR
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(texto)}`;
}

function parseDireccion(obj) {
  // Si es string, devolver directo. Si es objeto, intentar armar string legible.
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object') {
    // Si tiene lat/lng, mostrar "Lat, Lng". Si tiene dirección, mostrar dirección.
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
  // localidad es lo que está después de la primera coma
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

function renderPaquetes(infoPaquetes) {
  if (!infoPaquetes.acepta) {
    return `
      <div class="trip-packages trip-packages-disabled">
        <div class="trip-packages-title">
          <i class="fa-solid fa-box-open"></i>
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
        <i class="fa-solid fa-box-open"></i>
        <span>Acepta paquetes</span>
      </div>
      <div class="trip-packages-list">
        ${chips}
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
    tripsList.innerHTML = `
      <div class="trip-card">
        <div class="trip-packages trip-packages-disabled">
          <div class="trip-packages-title">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>No pudimos cargar los viajes ahora</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const viajesRaw = Array.isArray(payload) ? payload : payload?.trips ?? [];
  const viajes = viajesRaw.filter(esViajeConSalidaPosteriorAhora);

  if (viajes.length === 0) {
    tripsList.innerHTML = `
      <div class="trip-card">
        <div class="trip-packages trip-packages-disabled">
          <div class="trip-packages-title">
            <i class="fa-regular fa-calendar"></i>
            <span>No hay viajes disponibles en este momento</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  viajes.forEach((data) => {
    // Usar nombreOrigen/nombreDestino si existen, si no, fallback
    const origenRaw = data.nombreOrigen || parseDireccion(data.coordOrigen) || 'Origen';
    const destinoRaw = data.nombreDestino || parseDireccion(data.coordDestino) || 'Destino';
    const origenSplit = splitLocalidadDireccion(origenRaw);
    const destinoSplit = splitLocalidadDireccion(destinoRaw);
    const fecha = formatearFecha(data.fecha);
    const hora = data.hora || '';
    const lugares = data.lugares || (data.listaPasajeros && data.listaPasajeros.lugares) || '';
    const precio = formatearPrecio(data.precio);
    const info = data.informacion || '';
    const qrData = `https://viajapp.github.io/viaje/${data.id}`;
    const qrUrl = generarQR(qrData);
    const user = data.userData || data.user || {};
    const username = user && user.username ? user.username : 'Usuario';
    const userImg = user && (user.profileImageUrl || user.profile_image_url) ? (user.profileImageUrl || user.profile_image_url) : 'images/viajapp-logo.png';
    const infoPaquetes = obtenerInfoPaquetes(data);
    const paquetesHtml = renderPaquetes(infoPaquetes);
    const asientosTexto = lugares ? `${lugares} asientos` : 'Sin asientos informados';
    const infoEscapada = escapeHtml(info);

    tripsList.innerHTML += `
      <div class="trip-card">
        <div class="trip-user">
          <img src="${escapeHtml(userImg)}" alt="${escapeHtml(username)}" class="trip-user-img" />
          <span class="trip-user-name" title="${escapeHtml(username)}">${escapeHtml(username)}</span>
        </div>
        <div class="trip-header">
          <span class="trip-localidad" title="${escapeHtml(origenSplit.localidad)}">${escapeHtml(origenSplit.localidad)}</span>
          <span class="trip-direccion" title="${escapeHtml(origenSplit.direccion)}">${escapeHtml(origenSplit.direccion)}</span>
          <span class="trip-arrow"><i class='fa-solid fa-arrow-right'></i></span>
          <span class="trip-localidad" title="${escapeHtml(destinoSplit.localidad)}">${escapeHtml(destinoSplit.localidad)}</span>
          <span class="trip-direccion" title="${escapeHtml(destinoSplit.direccion)}">${escapeHtml(destinoSplit.direccion)}</span>
        </div>
        <div class="trip-details">
          <div><i class="fa-regular fa-calendar"></i> ${escapeHtml(fecha)}</div>
          <div><i class="fa-regular fa-clock"></i> ${escapeHtml(formatearHora(hora))}</div>
          <div><i class="fa-solid fa-user-group"></i> ${escapeHtml(asientosTexto)}</div>
          ${precio ? `<div><i class='fa-solid fa-dollar-sign'></i> ${precio}</div>` : ''}
        </div>
        ${paquetesHtml}
        <div class="trip-qr">
          <img src="${qrUrl}" alt="QR para viaje ${data.id}" />
        </div>
        <div class="trip-info trip-info-multiline" title="${infoEscapada}">
          <small>${infoEscapada.replace(/\n/g, '<br>')}</small>
        </div>
      </div>
    `;
  });
}

document.addEventListener('DOMContentLoaded', mostrarUltimosViajes); 