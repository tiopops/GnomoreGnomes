/* Gnomore Gnomes — guardado de partida.
   Regla de oro: la partida en curso se guarda SIEMPRE en local (por dispositivo),
   nunca en la nube. El progreso de perfil (logros, desbloqueos) irá aparte, en Firebase,
   cuando se implemente esa capa — ver documento de diseño. */

const SAVE_KEY = "gnomoregnomes_match_save";

const SaveGame = {
  hasSavedMatch() {
    return localStorage.getItem(SAVE_KEY) !== null;
  },

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Save corrupta, se ignora.", e);
      return null;
    }
  },

  save(matchState) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(matchState));
  },

  clear() {
    localStorage.removeItem(SAVE_KEY);
  },
};
