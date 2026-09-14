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
  },
  en: {
    game_title: "Gnomore Gnomes",
    menu_new_game: "New Game",
    menu_resume_game: "Resume Game",
    menu_multiplayer: "Multiplayer (coming soon)",
    menu_footer: "Prototype under construction",
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

  t(key) {
    const dict = STRINGS[this.currentLang] || STRINGS[DEFAULT_LANGUAGE];
    return dict[key] || STRINGS[DEFAULT_LANGUAGE][key] || key;
  },

  apply() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = this.t(el.getAttribute("data-i18n"));
    });
  },
};

document.addEventListener("DOMContentLoaded", () => I18N.init());
