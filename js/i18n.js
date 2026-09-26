/* Gnomore Gnomes — sistema de idiomas.
   Regla de oro: todo el texto del juego pasa por aquí, nunca escrito directo en el HTML/JS.
   Para añadir un idioma nuevo: añadir su objeto de textos y añadir su código a AVAILABLE_LANGUAGES. */

const STRINGS = {
  es: {
    game_title: "Gnomore Gnomes",
    menu_new_game: "Nueva Partida",
    menu_resume_game: "Reanudar Partida",
    menu_multiplayer: "Multijugador (próximamente)",
    menu_footer: "Prototipo en construcción",

    back: "Volver",

    choose_mode: "Elige el modo de juego",
    mode_gnomesmash: "GnomeSmash",
    mode_gnomesmash_desc: "Caza gnomos, cárgalos y machácalos en la base rival.",

    choose_race: "Elige tu raza",
    race_mushboom_forest: "Bosque MushBoom",
    race_mushboom_forest_flavor: "Habitantes del bosque y expertos en setas explosivas: GolemCorteza, SurcaBosques y TruenoEspora.",
    race_mushboom_forest_virtues: "Rápidos y ágiles: se mueven más casillas por turno y suelen golpear antes que el rival.",
    race_mushboom_forest_weaknesses: "Poco aguante: caen en pocos golpes, hay que jugar con cuidado y no exponerlos de más.",
    race_colinas_rockntroll: "Colinas Rock'n Troll",
    race_colinas_rockntroll_flavor: "Trolls de las colinas rocosas, tan duros de roer como su música: LanzaGnomos, UrgaMentes y PuñoRroca.",
    race_colinas_rockntroll_virtues: "Duros como la roca: aguantan mucho castigo y golpean con fuerza cuerpo a cuerpo.",
    race_colinas_rockntroll_weaknesses: "Más lentos: tardan más turnos en alcanzar la línea de combate.",

    choose_opponents: "Elige el número de rivales",
    opponents_label: "{n} rival",
    opponents_label_plural: "{n} rivales",

    generating_map: "Generando escenario…",
  },
  en: {
    game_title: "Gnomore Gnomes",
    menu_new_game: "New Game",
    menu_resume_game: "Resume Game",
    menu_multiplayer: "Multiplayer (coming soon)",
    menu_footer: "Prototype under construction",

    back: "Back",

    choose_mode: "Choose game mode",
    mode_gnomesmash: "GnomeSmash",
    mode_gnomesmash_desc: "Hunt gnomes, charge them up, and smash them in the enemy base.",

    choose_race: "Choose your race",
    race_mushboom_forest: "MushBoom Forest",
    race_mushboom_forest_flavor: "Forest dwellers and masters of bomb mushrooms: GolemCorteza, SurcaBosques and TruenoEspora.",
    race_mushboom_forest_virtues: "Fast and agile: they cover more tiles per turn and usually strike before the enemy does.",
    race_mushboom_forest_weaknesses: "Low toughness: they go down in a few hits, so play them carefully.",
    race_colinas_rockntroll: "Rock'n Troll Hills",
    race_colinas_rockntroll_flavor: "Trolls from the rocky hills, as hard-headed as their music: LanzaGnomos, UrgaMentes and PuñoRroca.",
    race_colinas_rockntroll_virtues: "Rock-hard: they take a lot of punishment and hit hard in melee.",
    race_colinas_rockntroll_weaknesses: "Slower: they take more turns to reach the fight.",

    choose_opponents: "Choose number of opponents",
    opponents_label: "{n} opponent",
    opponents_label_plural: "{n} opponents",

    generating_map: "Generating map…",
  },
};

const AVAILABLE_LANGUAGES = Object.keys(STRINGS);
const DEFAULT_LANGUAGE = "es";

const I18N = {
  currentLang: DEFAULT_LANGUAGE,

  init() {
    const saved = localStorage.getItem("gnomoregnomes_lang");
    const browserLang = (navigator.language || DEFAULT_LANGUAGE).slice(0, 2);
    this.currentLang = AVAILABLE_LANGUAGES.includes(saved)
      ? saved
      : (AVAILABLE_LANGUAGES.includes(browserLang) ? browserLang : DEFAULT_LANGUAGE);
    this.apply();
  },

  setLanguage(lang) {
    if (!AVAILABLE_LANGUAGES.includes(lang)) return;
    this.currentLang = lang;
    localStorage.setItem("gnomoregnomes_lang", lang);
    this.apply();
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
