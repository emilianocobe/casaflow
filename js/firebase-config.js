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

window.CASAFLOW_FIREBASE = null;

/* Ejemplo:
window.CASAFLOW_FIREBASE = {
  apiKey: "AIza...",
  authDomain: "casaflow-xxxxx.firebaseapp.com",
  projectId: "casaflow-xxxxx",
  storageBucket: "casaflow-xxxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
*/
