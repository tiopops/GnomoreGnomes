/* Gnomore Gnomes — configuración de Firebase para las cuentas.
   Pega aquí el objeto "firebaseConfig" que te da la consola de Firebase
   (Configuración del proyecto > Tus apps > Web). Mientras sea null, el panel
   de cuenta se abre pero avisa de que el servicio aún no está configurado.
   Estos valores NO son secretos (van en el navegador): lo que protege los
   datos son las reglas de seguridad de Firestore (ver firebase/firestore.rules). */
const GG_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDtRj126ONxAH6dn0FQularkKC6upPZoJo",
  authDomain: "goal2goat.firebaseapp.com",
  projectId: "goal2goat",
  storageBucket: "goal2goat.firebasestorage.app",
  messagingSenderId: "566382525133",
  appId: "1:566382525133:web:e87ee6ce639b2ad2350784",
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
