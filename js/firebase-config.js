/* Gnomore Gnomes — configuración de Firebase para las cuentas.
   Pega aquí el objeto "firebaseConfig" que te da la consola de Firebase
   (Configuración del proyecto > Tus apps > Web). Mientras sea null, el panel
   de cuenta se abre pero avisa de que el servicio aún no está configurado.
   Estos valores NO son secretos (van en el navegador): lo que protege los
   datos son las reglas de seguridad de Firestore (ver firebase/firestore.rules). */
const GG_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDXV91nuZlqIopG0oz8rtMNLg4E28oheSc",
  authDomain: "gnomoregnomes-2fdf2.firebaseapp.com",
  projectId: "gnomoregnomes-2fdf2",
  storageBucket: "gnomoregnomes-2fdf2.firebasestorage.app",
  messagingSenderId: "246836907399",
  appId: "1:246836907399:web:8f2393d7016cc215229722",
};
/* Ejemplo:
const GG_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
*/
