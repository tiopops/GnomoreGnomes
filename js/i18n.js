/* Gnomore Gnomes — sistema de idiomas.
   Regla de oro: todo el texto del juego pasa por aquí, nunca escrito directo en el HTML/JS.
   Para añadir un idioma nuevo: añadir su objeto de textos y añadir su código a AVAILABLE_LANGUAGES. */

const STRINGS = {
  es: {
    game_title: "Gnomore Gnomes",
    menu_new_game: "Partida Rápida",
    menu_tutorial: "Tutorial",
    menu_resume_game: "Reanudar Partida",
    menu_multiplayer: "Multijugador",
    menu_footer: "Prototipo en construcción",

    back: "Volver",

    choose_mode: "Elige el modo de juego",
    mode_gnomesmash: "GnomeSmash",
    mode_gnomesmash_desc: "Caza gnomos, cárgalos y machácalos en la base rival.",

    choose_race: "Elige tu raza",
    race_mushboom_forest: "Equipo GuardaBosques",
    race_mushboom_forest_flavor: "Habitantes del bosque y expertos en setas explosivas: GolemCorteza, SurcaBosques y TruenoEspora.",
    race_mushboom_forest_virtues: "Rápidos y ágiles: se mueven más casillas por turno y suelen golpear antes que el rival.",
    race_mushboom_forest_weaknesses: "Poco aguante: caen en pocos golpes, hay que jugar con cuidado y no exponerlos de más.",
    race_colinas_rockntroll: "Equipo TruenaRocas",
    race_colinas_rockntroll_flavor: "Trolls de las colinas rocosas, tan duros de roer como su música: LanzaGnomos, UrgaMentes y PuñoRroca.",
    race_colinas_rockntroll_virtues: "Duros como la roca: aguantan mucho castigo y golpean con fuerza cuerpo a cuerpo.",
    race_colinas_rockntroll_weaknesses: "Más lentos: tardan más turnos en alcanzar la línea de combate.",

    choose_level: "Elige el nivel",
    level_mushboom_forest: "Bosque MushBoom",
    level_mushboom_forest_flavor: "Un bosque de ríos y lagos donde cualquier seta puede ser una bomba.",
    level_mushboom_forest_f1: "Setas explosivas: aparecen por el mapa de vez en cuando. Si recoges una, explota a los 3 turnos: 5 de daño al portador y a las casillas adyacentes.",
    level_mushboom_forest_f2: "Altar de Sacrificios: cada jugador tiene su propia barra de ofrendas. Entrega una seta o un gnomo junto al altar como ofrenda (una seta rellena 10 puntos); el primero en llenarla invoca al GnomOgro.",
    level_mushboom_forest_f3: "GnomOgro: 30 de vida y 10 de ataque. Avanza hacia la base rival y la destruye si nadie lo detiene.",
    level_colinas_rockntroll: "Colinas Rock'n Troll",
    level_colinas_rockntroll_flavor: "Colinas rocosas con mecánicas propias, aún por revelar. Llegarán más adelante en el desarrollo.",
    level_coming_soon: "Próximamente",

    choose_opponents: "Elige el número de rivales",
    opponents_label: "{n} rival",
    opponents_label_plural: "{n} rivales",

    generating_map: "Generando escenario…",

    settings_title: "AJUSTES",
    settings_sfx: "Efectos de sonido",
    settings_music: "Música",
    your_turn: "¡ES TU TURNO!",
    start_match: "¡A LUCHAR!",
    settings_tab_game: "JUEGO",
    settings_tab_gfx: "GRÁFICOS",
    settings_sfx_vol: "Volumen de efectos",
    settings_music_vol: "Volumen de música",
    settings_teams: "Mostrar equipos",
    settings_shadows: "Sombras",
    settings_fog: "Animación de niebla",
    settings_vegetation: "Vegetación",
    settings_adaptive: "Resolución adaptativa",
    settings_perf: "Modo rendimiento",
    settings_exit: "Salir de la partida",
    settings_language: "Idioma",
    lang_es: "ESPAÑOL",
    lang_en: "ENGLISH",
    acc_aria: "Cuenta",
    fr_aria: "Amigos",
    fr_title: "AMIGOS",
    fr_add_title: "AÑADIR AMIGO",
    fr_ph: "Nombre de usuario",
    fr_add_btn: "ENVIAR SOLICITUD",
    fr_requests: "SOLICITUDES",
    fr_sent: "ENVIADAS",
    fr_list: "MIS AMIGOS",
    fr_none: "Aún no tienes amigos. ¡Añade a alguien por su nombre de usuario!",
    fr_login: "Inicia sesión para usar los amigos.",
    fr_accept: "ACEPTAR",
    fr_reject: "RECHAZAR",
    fr_cancel: "CANCELAR",
    fr_remove: "Eliminar amigo",
    fr_online: "En línea",
    fr_offline: "Desconectado",
    fr_confirm: "¿Eliminar a {0} de tus amigos?",
    fr_yes: "ELIMINAR",
    fr_no: "VOLVER",
    fr_pending: "Pendiente",
    fr_e_empty: "Escribe un nombre de usuario.",
    fr_e_notfound: "No existe ningún jugador con ese nombre.",
    fr_e_self: "No puedes añadirte a ti mismo.",
    fr_e_already: "Ya sois amigos.",
    fr_e_waiting: "Ya le has enviado una solicitud.",
    fr_e_generic: "No se ha podido completar. Inténtalo de nuevo.",
    fr_ok_sent: "Solicitud enviada a {0}.",
    fr_ok_joined: "¡Ahora eres amigo de {0}!",
    acc_my: "MI CUENTA",
    acc_verified: "Correo verificado",
    acc_unverified: "Correo sin verificar · revisa tu bandeja",
    acc_logout: "CERRAR SESIÓN",
    acc_login: "ENTRAR",
    acc_register: "REGISTRARSE",
    acc_create_title: "CREAR CUENTA",
    acc_register_btn: "REGISTRARME",
    acc_recover_title: "RECUPERAR",
    acc_send_mail: "ENVIAR CORREO",
    acc_forgot: "¿Has olvidado la contraseña?",
    acc_back: "Volver",
    acc_f_email: "Correo",
    acc_f_email_or_name: "Correo o nombre de usuario",
    acc_ph_email_or_name: "tu@correo.com o tu nombre",
    acc_f_pass: "Contraseña",
    acc_f_nick: "Nombre de usuario",
    acc_ph_nick: "3-16 letras, números o _",
    acc_ph_pass: "mínimo 6 caracteres",
    acc_f_pass2: "Repite la contraseña",
    acc_f_email_account: "Correo de tu cuenta",
    acc_e_email: "Escribe un correo válido.",
    acc_e_idf: "Escribe tu correo o nombre de usuario.",
    acc_e_pass: "Escribe tu contraseña.",
    acc_e_nick: "El nombre debe tener 3-16 letras, números o _ (sin espacios).",
    acc_e_pass_len: "La contraseña debe tener al menos 6 caracteres.",
    acc_e_pass_match: "Las contraseñas no coinciden.",
    acc_ok_created: "¡Cuenta creada! Te hemos enviado un correo para verificarla.",
    acc_ok_reset: "Si el correo existe, recibirás un enlace para cambiar la contraseña.",
    acc_x_notcfg: "El servicio de cuentas aún no está configurado.",
    acc_x_emailused: "Ese correo ya está registrado.",
    acc_x_bademail: "El correo no es válido.",
    acc_x_weak: "La contraseña es demasiado débil (mínimo 6 caracteres).",
    acc_x_cred: "Usuario, correo o contraseña incorrectos.",
    acc_x_many: "Demasiados intentos. Espera un momento.",
    acc_x_net: "Sin conexión. Inténtalo de nuevo.",
    acc_x_nametaken: "Ese nombre de usuario ya está en uso.",
    acc_x_generic: "Ha ocurrido un error. Inténtalo de nuevo.",
    acc_player: "Jugador",
  },
  en: {
    game_title: "Gnomore Gnomes",
    menu_new_game: "Quick Game",
    menu_tutorial: "Tutorial",
    menu_resume_game: "Resume Game",
    menu_multiplayer: "Multiplayer",
    menu_footer: "Prototype under construction",

    back: "Back",

    choose_mode: "Choose game mode",
    mode_gnomesmash: "GnomeSmash",
    mode_gnomesmash_desc: "Hunt gnomes, charge them up, and smash them in the enemy base.",

    choose_race: "Choose your race",
    race_mushboom_forest: "Team GuardaBosques",
    race_mushboom_forest_flavor: "Forest dwellers and masters of bomb mushrooms: GolemCorteza, SurcaBosques and TruenoEspora.",
    race_mushboom_forest_virtues: "Fast and agile: they cover more tiles per turn and usually strike before the enemy does.",
    race_mushboom_forest_weaknesses: "Low toughness: they go down in a few hits, so play them carefully.",
    race_colinas_rockntroll: "Team TruenaRocas",
    race_colinas_rockntroll_flavor: "Trolls from the rocky hills, as hard-headed as their music: LanzaGnomos, UrgaMentes and PuñoRroca.",
    race_colinas_rockntroll_virtues: "Rock-hard: they take a lot of punishment and hit hard in melee.",
    race_colinas_rockntroll_weaknesses: "Slower: they take more turns to reach the fight.",

    choose_level: "Choose the level",
    level_mushboom_forest: "MushBoom Forest",
    level_mushboom_forest_flavor: "A forest of rivers and lakes where any mushroom can be a bomb.",
    level_mushboom_forest_f1: "Explosive mushrooms: they pop up around the map from time to time. Pick one up and it explodes after 3 turns: 5 damage to the carrier and adjacent tiles.",
    level_mushboom_forest_f2: "Sacrifice Altar: each player has their own offering bar. Offer a mushroom or a gnome next to the altar (a mushroom fills 10 points); the first to fill it summons the GnomOgre.",
    level_mushboom_forest_f3: "GnomOgre: 30 health and 10 attack. It marches on the enemy base and destroys it unless someone stops it.",
    level_colinas_rockntroll: "Rock'n Troll Hills",
    level_colinas_rockntroll_flavor: "Rocky hills with their own mechanics, coming later in development.",
    level_coming_soon: "Coming soon",

    choose_opponents: "Choose number of opponents",
    opponents_label: "{n} opponent",
    opponents_label_plural: "{n} opponents",

    generating_map: "Generating map…",

    settings_title: "SETTINGS",
    settings_sfx: "Sound effects",
    settings_music: "Music",
    your_turn: "IT'S YOUR TURN!",
    start_match: "FIGHT!",
    settings_tab_game: "GAME",
    settings_tab_gfx: "GRAPHICS",
    settings_sfx_vol: "Effects volume",
    settings_music_vol: "Music volume",
    settings_teams: "Show teams",
    settings_shadows: "Shadows",
    settings_fog: "Fog animation",
    settings_vegetation: "Vegetation",
    settings_adaptive: "Adaptive resolution",
    settings_perf: "Performance mode",
    settings_exit: "Leave match",
    settings_language: "Language",
    lang_es: "ESPAÑOL",
    lang_en: "ENGLISH",
    acc_aria: "Account",
    fr_aria: "Friends",
    fr_title: "FRIENDS",
    fr_add_title: "ADD FRIEND",
    fr_ph: "Username",
    fr_add_btn: "SEND REQUEST",
    fr_requests: "REQUESTS",
    fr_sent: "SENT",
    fr_list: "MY FRIENDS",
    fr_none: "You have no friends yet. Add someone by their username!",
    fr_login: "Log in to use friends.",
    fr_accept: "ACCEPT",
    fr_reject: "DECLINE",
    fr_cancel: "CANCEL",
    fr_remove: "Remove friend",
    fr_online: "Online",
    fr_offline: "Offline",
    fr_confirm: "Remove {0} from your friends?",
    fr_yes: "REMOVE",
    fr_no: "BACK",
    fr_pending: "Pending",
    fr_e_empty: "Type a username.",
    fr_e_notfound: "No player has that name.",
    fr_e_self: "You can't add yourself.",
    fr_e_already: "You are already friends.",
    fr_e_waiting: "You already sent a request.",
    fr_e_generic: "Couldn't complete that. Try again.",
    fr_ok_sent: "Request sent to {0}.",
    fr_ok_joined: "You are now friends with {0}!",
    acc_my: "MY ACCOUNT",
    acc_verified: "Email verified",
    acc_unverified: "Email not verified · check your inbox",
    acc_logout: "LOG OUT",
    acc_login: "LOG IN",
    acc_register: "SIGN UP",
    acc_create_title: "CREATE ACCOUNT",
    acc_register_btn: "SIGN ME UP",
    acc_recover_title: "RECOVER",
    acc_send_mail: "SEND EMAIL",
    acc_forgot: "Forgot your password?",
    acc_back: "Back",
    acc_f_email: "Email",
    acc_f_email_or_name: "Email or username",
    acc_ph_email_or_name: "you@email.com or your name",
    acc_f_pass: "Password",
    acc_f_nick: "Username",
    acc_ph_nick: "3-16 letters, numbers or _",
    acc_ph_pass: "at least 6 characters",
    acc_f_pass2: "Repeat password",
    acc_f_email_account: "Your account email",
    acc_e_email: "Enter a valid email.",
    acc_e_idf: "Enter your email or username.",
    acc_e_pass: "Enter your password.",
    acc_e_nick: "Username must be 3-16 letters, numbers or _ (no spaces).",
    acc_e_pass_len: "Password must be at least 6 characters.",
    acc_e_pass_match: "Passwords do not match.",
    acc_ok_created: "Account created! We sent you an email to verify it.",
    acc_ok_reset: "If the email exists, you will receive a link to reset your password.",
    acc_x_notcfg: "The accounts service is not configured yet.",
    acc_x_emailused: "That email is already registered.",
    acc_x_bademail: "The email is not valid.",
    acc_x_weak: "Password is too weak (at least 6 characters).",
    acc_x_cred: "Wrong username, email or password.",
    acc_x_many: "Too many attempts. Wait a moment.",
    acc_x_net: "No connection. Try again.",
    acc_x_nametaken: "That username is already taken.",
    acc_x_generic: "Something went wrong. Try again.",
    acc_player: "Player",
  },
};

const AVAILABLE_LANGUAGES = Object.keys(STRINGS);
const DEFAULT_LANGUAGE = "es";

const I18N = {
  currentLang: DEFAULT_LANGUAGE,

  init() {
    let saved = null;
    try {
      saved = localStorage.getItem("gnomoregnomes_lang");
    } catch (e) {}
    // Español por defecto; solo cambia si el jugador lo elige en Ajustes.
    this.currentLang = AVAILABLE_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE;
    this.apply();
  },

  setLanguage(lang) {
    if (!AVAILABLE_LANGUAGES.includes(lang)) return;
    this.currentLang = lang;
    try {
      localStorage.setItem("gnomoregnomes_lang", lang);
    } catch (e) {}
    document.documentElement.lang = lang;
    this.apply();
    document.dispatchEvent(new CustomEvent("gg:langchange", { detail: { lang } }));
  },

  t(key, vars) {
    const dict = STRINGS[this.currentLang] || STRINGS[DEFAULT_LANGUAGE];
    let str = dict[key] || STRINGS[DEFAULT_LANGUAGE][key] || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace(`{${k}}`, vars[k]);
      });
    }
    return str;
  },

  apply() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = this.t(el.getAttribute("data-i18n"));
    });
  },
};

document.addEventListener("DOMContentLoaded", () => I18N.init());
