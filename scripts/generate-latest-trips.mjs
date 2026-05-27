import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '../latest-trips.json');
const DEFAULT_LIMIT = 20;
const MAX_RENDERED_TRIPS = 5;
const API_TIMEOUT_MS = 15000;

function getApiBaseUrl() {
  const baseUrl = (process.env.BACKEND_API_BASE_URL || '').trim();
  if (!baseUrl) {
    throw new Error('Missing BACKEND_API_BASE_URL secret.');
  }
  return baseUrl.replace(/\/+$/, '');
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
}

function parseFecha(fechaRaw) {
  if (!fechaRaw) return null;
  if (fechaRaw instanceof Date) return fechaRaw;
  if (typeof fechaRaw === 'string') {
    const fecha = new Date(fechaRaw);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  return null;
}

function buildFechaHoraViaje(data) {
  const sourceDate =
    data.estimated_arrival_at ||
    data.departure_at ||
    data.fecha;
  const fecha = parseFecha(sourceDate);
  if (!fecha) return null;

  const fechaHora = new Date(fecha);
  if (typeof data.hora === 'string' && data.hora.includes(':')) {
    const [horas, minutos] = data.hora.split(':').map(Number);
    if (Number.isFinite(horas) && Number.isFinite(minutos)) {
      fechaHora.setHours(horas, minutos, 0, 0);
    }
  }

  return fechaHora;
}

function parseDireccion(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.direccion === 'string') return value.direccion;
    if (typeof value.lat === 'number' && typeof value.lng === 'number') {
      return `${value.lat}, ${value.lng}`;
    }
  }
  return '';
}

function sanitizePackagesConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') return null;

  const definitions = {
    chico: 'Hasta 30x30x30 cm, máximo 5 kg',
    mediano: 'Hasta 50x50x50 cm, máximo 15 kg',
    grande: 'Hasta 80x80x80 cm, máximo 30 kg'
  };

  const result = {};
  for (const key of Object.keys(definitions)) {
    const config = rawConfig[key];
    if (!config || typeof config !== 'object') continue;
    const activo = config.activo === true || config.active === true;
    const precio = Number(config.precio ?? config.price ?? 0);
    if (!activo && !precio) continue;

    result[key] = {
      activo,
      precio: Number.isFinite(precio) ? precio : 0,
      descripcion: config.descripcion || config.description || definitions[key]
    };
  }

  return Object.keys(result).length > 0 ? result : null;
}

function sanitizeUserData(userData) {
  if (!userData || typeof userData !== 'object') {
    return {
      username: '',
      profileImageUrl: '',
      verified: false
    };
  }

  const username = String(userData.username || '').trim();
  return {
    username,
    profileImageUrl: userData.profileImageUrl || userData.profile_image_url || '',
    verified: Boolean(userData.verified ?? userData.nosis_verified)
  };
}

function sanitizeTrip(id, data, userData) {
  const fechaHoraViaje = buildFechaHoraViaje(data);
  const paquetesConfig = sanitizePackagesConfig(
    data.paquetesConfig || data.paquetes_config || data.packages_config
  );
  const seatsAvailable = Number(data.seats_available ?? data.lugares ?? data.listaPasajeros?.lugares ?? 0) || 0;
  const seatsCommitted = Number(data.seats_committed ?? 0) || 0;
  const seatsFree = Math.max(seatsAvailable - seatsCommitted, 0);
  const rawDate = fechaHoraViaje || parseFecha(data.estimated_arrival_at) || parseFecha(data.departure_at);
  const hora =
    typeof data.hora === 'string'
      ? data.hora
      : (rawDate ? rawDate.toISOString().slice(11, 16) : '');
  const driver = sanitizeUserData(userData);

  return {
    id,
    driverId: data.driver_id || data.driverId || '',
    nombreOrigen: data.nombreOrigen || data.origin_name || parseDireccion(data.coordOrigen) || '',
    nombreDestino: data.nombreDestino || data.destination_name || parseDireccion(data.coordDestino) || '',
    fecha: rawDate ? rawDate.toISOString() : '',
    hora,
    lugares: seatsFree,
    precio: Number(data.precio ?? data.price_per_seat ?? 0) || 0,
    informacion: data.informacion || data.info || '',
    aceptaPaquetes: Boolean(
      data.aceptaPaquetes ??
      data.acepta_paquetes ??
      paquetesConfig
    ),
    paquetesConfig,
    userData: driver
  };
}

async function fetchPublicProfile(driverId, baseUrl, headers) {
  if (!driverId) return null;

  const url = `${baseUrl}/api/v1/users/${encodeURIComponent(driverId)}`;
  const { controller, timeout } = withTimeout(API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTripsFromApi() {
  const baseUrl = getApiBaseUrl();
  const fromTime = new Date().toISOString();
  const url = new URL('/api/v1/trips', `${baseUrl}/`);
  url.searchParams.set('limit', String(DEFAULT_LIMIT));
  url.searchParams.set('from_time', fromTime);

  const headers = {
    Accept: 'application/json'
  };
  const token = (process.env.BACKEND_API_BEARER_TOKEN || '').trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const { controller, timeout } = withTimeout(API_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trips API request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Trips API returned an invalid payload. Expected array.');
  }
  return payload;
}

async function buildLatestTrips() {
  const baseUrl = getApiBaseUrl();
  const apiTrips = await fetchTripsFromApi();
  const now = new Date();
  const headers = {
    Accept: 'application/json'
  };
  const token = (process.env.BACKEND_API_BEARER_TOKEN || '').trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const upcoming = [];
  for (const data of apiTrips) {
    if (data.finalized === true) continue;
    const fechaHoraViaje = buildFechaHoraViaje(data);
    if (!fechaHoraViaje || fechaHoraViaje <= now) continue;
    upcoming.push(data);
    if (upcoming.length >= MAX_RENDERED_TRIPS) break;
  }

  const profiles = await Promise.all(
    upcoming.map((trip) => fetchPublicProfile(trip.driver_id, baseUrl, headers))
  );

  const trips = upcoming.map((data, index) => sanitizeTrip(data.id, data, profiles[index]));

  return {
    generatedAt: new Date().toISOString(),
    trips
  };
}

async function main() {
  const payload = await buildLatestTrips();
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Generated ${payload.trips.length} trips in latest-trips.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
