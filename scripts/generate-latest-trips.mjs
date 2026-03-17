import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '../latest-trips.json');

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON secret.');
  }

  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  return serviceAccount;
}

function ensureFirebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert(getServiceAccount())
  });
}

function parseFecha(fechaRaw) {
  if (!fechaRaw) return null;
  if (fechaRaw instanceof Date) return fechaRaw;
  if (fechaRaw instanceof Timestamp) return fechaRaw.toDate();
  if (typeof fechaRaw?.toDate === 'function') return fechaRaw.toDate();
  if (typeof fechaRaw === 'string') {
    const fecha = new Date(fechaRaw);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  if (typeof fechaRaw === 'object' && typeof fechaRaw.seconds === 'number') {
    return new Date(fechaRaw.seconds * 1000);
  }
  return null;
}

function buildFechaHoraViaje(data) {
  const fecha = parseFecha(data.fecha);
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

function sanitizeTrip(id, data, userData) {
  const fechaHoraViaje = buildFechaHoraViaje(data);
  const paquetesConfig = sanitizePackagesConfig(
    data.paquetesConfig || data.paquetes_config || data.packages_config
  );

  return {
    id,
    nombreOrigen: data.nombreOrigen || data.origin_name || parseDireccion(data.coordOrigen) || '',
    nombreDestino: data.nombreDestino || data.destination_name || parseDireccion(data.coordDestino) || '',
    fecha: fechaHoraViaje ? fechaHoraViaje.toISOString() : '',
    hora: typeof data.hora === 'string' ? data.hora : '',
    lugares: Number(data.lugares || data.listaPasajeros?.lugares || 0) || 0,
    precio: Number(data.precio || 0) || 0,
    informacion: data.informacion || '',
    aceptaPaquetes: Boolean(
      data.aceptaPaquetes ??
      data.acepta_paquetes ??
      paquetesConfig
    ),
    paquetesConfig,
    userData: {
      username: userData?.username || 'Usuario',
      profileImageUrl: userData?.profileImageUrl || userData?.profile_image_url || ''
    }
  };
}

async function fetchUserData(db, userId) {
  if (!userId) return null;
  const userSnapshot = await db.collection('users').doc(userId).get();
  return userSnapshot.exists ? userSnapshot.data() : null;
}

async function buildLatestTrips() {
  ensureFirebaseApp();
  const db = getFirestore();
  const now = new Date();
  const tripsSnapshot = await db
    .collection('viajes')
    .orderBy('fechaPublicado', 'desc')
    .limit(20)
    .get();

  const trips = [];
  for (const tripDoc of tripsSnapshot.docs) {
    const data = tripDoc.data();
    if (data.finalizado !== false) continue;

    const fechaHoraViaje = buildFechaHoraViaje(data);
    if (!fechaHoraViaje || fechaHoraViaje <= now) continue;

    const userId = data.userId || data.ownerId || data.usuarioId || data.uid || null;
    const userData = await fetchUserData(db, userId);
    trips.push(sanitizeTrip(tripDoc.id, data, userData));

    if (trips.length >= 5) break;
  }

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
