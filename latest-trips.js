import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, doc as docRef, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFmOsFGvjDg9ij94B7xYe07TwE6w9kQRE",
  authDomain: "viajapp-fir.firebaseapp.com",
  projectId: "viajapp-fir",
  storageBucket: "viajapp-fir.appspot.com",
  messagingSenderId: "714917887061",
  appId: "1:714917887061:web:0de5a23e88d38e651028dc",
  measurementId: "G-9D5FMS1VFT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function parseFecha(fechaRaw) {
  if (!fechaRaw) return '';
  // Si es string, parsear normal
  if (typeof fechaRaw === 'string') {
    const fecha = new Date(fechaRaw);
    if (isNaN(fecha.getTime())) return '';
    return fecha;
  }
  // Si es objeto tipo Timestamp de Firestore
  if (typeof fechaRaw === 'object' && typeof fechaRaw.seconds === 'number') {
    return new Date(fechaRaw.seconds * 1000);
  }
  return '';
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

async function getUserData(userId) {
  if (!userId) return null;
  try {
    const userDoc = await getDoc(docRef(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data();
    }
  } catch (e) {}
  return null;
}

async function mostrarUltimosViajes() {
  const tripsList = document.getElementById('trips-list');
  if (!tripsList) return;

  const viajesRef = collection(db, 'viajes');
  const q = query(viajesRef, orderBy('fechaPublicado', 'desc'), limit(10)); // Traemos más por si hay varios finalizados
  const querySnapshot = await getDocs(q);

  tripsList.innerHTML = '';
  const viajes = [];
  for (const doc of querySnapshot.docs) {
    const data = doc.data();
    if (data.finalizado === false) { // Solo viajes no finalizados
      const userId = data.userId || data.ownerId || data.usuarioId || data.uid || null;
      let userData = null;
      if (userId) {
        userData = await getUserData(userId);
      }
      viajes.push({ id: doc.id, ...data, userData });
    }
    if (viajes.length >= 5) break; // Solo mostrar 5
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
    const precio = data.precio ? `${data.precio} AR$` : '';
    const info = data.informacion || '';
    const qrData = `https://viajapp.github.io/viaje/${data.id}`;
    const qrUrl = generarQR(qrData);
    const user = data.userData;
    const username = user && user.username ? user.username : 'Usuario';
    const userImg = user && user.profileImageUrl ? user.profileImageUrl : 'images/viajapp-logo.png';

    tripsList.innerHTML += `
      <div class="trip-card">
        <div class="trip-user">
          <img src="${userImg}" alt="${username}" class="trip-user-img" />
          <span class="trip-user-name" title="${username}">${username}</span>
        </div>
        <div class="trip-header">
          <span class="trip-localidad" title="${origenSplit.localidad}">${origenSplit.localidad}</span>
          <span class="trip-direccion" title="${origenSplit.direccion}">${origenSplit.direccion}</span>
          <span class="trip-arrow"><i class='fa-solid fa-arrow-right'></i></span>
          <span class="trip-localidad" title="${destinoSplit.localidad}">${destinoSplit.localidad}</span>
          <span class="trip-direccion" title="${destinoSplit.direccion}">${destinoSplit.direccion}</span>
        </div>
        <div class="trip-details">
          <div><i class="fa-regular fa-calendar"></i> ${fecha}</div>
          <div><i class="fa-regular fa-clock"></i> ${formatearHora(hora)}</div>
          <div><i class="fa-solid fa-user-group"></i> ${lugares} asientos</div>
          ${precio ? `<div><i class='fa-solid fa-dollar-sign'></i> ${precio}</div>` : ''}
        </div>
        <div class="trip-qr">
          <img src="${qrUrl}" alt="QR para viaje ${data.id}" />
        </div>
        <div class="trip-info trip-info-multiline" title="${info}">
          <small>${info.replace(/\n/g, '<br>')}</small>
        </div>
      </div>
    `;
  });
}

document.addEventListener('DOMContentLoaded', mostrarUltimosViajes); 