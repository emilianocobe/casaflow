/* =========================================================
   CasaFlow · firebase-config.js
   Configuración de la nube (opcional).

   - Si CASAFLOW_FIREBASE es null → la app funciona en modo
     local (datos solo en este dispositivo).
   - Para activar la sincronización, pegá acá el objeto
     "firebaseConfig" que te da la consola de Firebase.
     (Estas claves son públicas por diseño: la seguridad la
     dan las reglas de Firestore, ver firestore.rules.)
   ========================================================= */

window.CASAFLOW_FIREBASE = {
  apiKey: "AIzaSyBsWCqPI6oVQVoN33V62-r8V4YUeta8t7s",
  authDomain: "casaflow-7c970.firebaseapp.com",
  projectId: "casaflow-7c970",
  storageBucket: "casaflow-7c970.firebasestorage.app",
  messagingSenderId: "1064842037162",
  appId: "1:1064842037162:web:5811185a83bd63be940dd3",
};

/* Para volver al modo local (datos solo en el dispositivo):
   window.CASAFLOW_FIREBASE = null;
   O abrí la app con ?demo al final de la URL para una demo local. */
