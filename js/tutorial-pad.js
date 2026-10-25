/* Gnomore Gnomes — Tutoriales con mando.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Las variantes "con mando" del diálogo, la misión y la réplica de CADA paso
       de los cuatro tutoriales (Primeros pasos, MushBoom, Rock'n Troll, HurryCrane), en español
       e inglés. Se aplican sobre los textos de js/tutorial-texts.js.
     - Cuándo se usa el modo mando (el último dispositivo usado es el mando) y
       cómo se cambia de uno a otro en directo en mitad de un paso.
   Formato por paso: { rep: [[desde, hasta], ...], add, say, mission, ok, button,
   en: {...igual...} }. `rep` cambia fragmentos del texto original (así el resto
   del guion sigue siendo el de js/tutorial-texts.js), `say/mission/ok/button`
   lo sustituyen entero y `add` añade al final. Los marcadores {confirm},
   {back}, {actions}, {endTurn}, {prevUnit}, {nextUnit}, {toObelisk}... se
   cambian por el botón REAL que el jugador tenga asignado a esa acción. */

const TUTORIAL_PAD_TEXTS = {
  basic: [
    { // 0
      add: " Veo que juegas con mando: {confirm} acepta, {back} cancela y {actions} abre las acciones. Yo te iré diciendo qué pulsar en cada momento.",
      en: { add: " I see you're playing with a controller: {confirm} confirms, {back} cancels and {actions} opens actions. I'll tell you what to press each time." },
    },
    { // 1 Obelisco
      rep: [["Púlsalo sin miedo.", "Lleva el cursor hasta él y pulsa {confirm} sin miedo (con {toObelisk} el cursor salta directo a tu Obelisco)."]],
      mission: "Selecciona tu Obelisco con {confirm}",
      en: { rep: [["Tap it without fear.", "Move the cursor onto it and press {confirm} without fear ({toObelisk} jumps the cursor straight to your Obelisk)."]], mission: "Select your Obelisk with {confirm}" },
    },
    { // 2 Reclutar
      rep: [["Ahora elige el icono de Reclutar, el primero de la izquierda.", "Ahora abre Reclutar, la primera de las tres opciones del Obelisco. {prevUnit} y {nextUnit} recorren las opciones y {confirm} abre la marcada: la primera ya lo está."]],
      mission: "Abre Reclutar con {confirm}",
      en: { rep: [["Now pick the Recruit icon, the first one on the left.", "Now open Recruit, the first of the Obelisk's three options. {prevUnit} and {nextUnit} cycle through the options and {confirm} opens the highlighted one: the first is already highlighted."]], mission: "Open Recruit with {confirm}" },
    },
    { // 3 TruenoEspora
      rep: [["Elige a TruenoEspora, el de la seta en la cabeza.", "Elige a TruenoEspora (muévete con la cruceta y pulsa {confirm}), el de la seta en la cabeza."]],
      mission: "Elige a TruenoEspora con {confirm}",
      en: { rep: [["Pick ThunderSpore, the one with the mushroom on his head.", "Pick ThunderSpore (move with the D-pad and press {confirm}), the one with the mushroom on his head."]], mission: "Pick ThunderSpore with {confirm}" },
    },
    { // 4 RECLUTAR
      rep: [["Pulsa RECLUTAR, necesitamos", "Baja con la cruceta hasta RECLUTAR, pulsa {confirm}, necesitamos"]],
      mission: "Pulsa RECLUTAR con {confirm}",
      en: { rep: [["Tap RECRUIT: we need", "Move down with the D-pad to RECRUIT, press {confirm}: we need"]], mission: "Press RECRUIT with {confirm}" },
    },
    { // 5 casilla
      rep: [["Elige una.", "Lleva el cursor a una con la cruceta y pulsa {confirm} ({back} cancela)."]],
      mission: "Elige una casilla con {confirm}",
      en: { rep: [["Pick one.", "Move the cursor to one with the D-pad and press {confirm} ({back} cancels)."]], mission: "Pick a tile with {confirm}" },
    },
    { // 6 información de la unidad (sin mantener pulsado)
      rep: [["Mantén pulsada su cara (abajo a la izquierda) para ver sus estadísticas. Con los enemigos funciona igual.",
             "Selecciona a tu unidad (cursor sobre ella y {confirm}), pulsa {actions} y elige «Información de la unidad» para ver sus estadísticas. Se cierra con {back}. Con los enemigos funciona igual: cursor sobre ellos y {confirm}."]],
      mission: "Abre su información y ciérrala con {back}",
      en: { rep: [["Hold its face (bottom left) to see its stats. It works the same on enemies.",
                   "Select your unit (cursor on it and {confirm}), press {actions} and choose \"Unit information\" to see its stats. Close it with {back}. Same with enemies: cursor on them and {confirm}."]],
            mission: "Open its information and close it with {back}" },
    },
    { // 7 segunda unidad
      rep: [["Recluta otra unidad igual:", "Recluta otra unidad igual (Obelisco —{toObelisk} lleva el cursor hasta él—, Reclutar, unidad, RECLUTAR y casilla, todo con {confirm}):"]],
      en: { rep: [["Recruit another one just like it:", "Recruit another one just like it (Obelisk —{toObelisk} moves the cursor there—, Recruit, unit, RECRUIT and tile, all with {confirm}):"]] },
    },
    { // 8 seleccionar
      rep: [["pulsa a uno de tus aliados.", "lleva el cursor a uno de tus aliados y pulsa {confirm}."]],
      mission: "Selecciona una unidad con {confirm}",
      en: { rep: [["tap one of your allies.", "move the cursor to one of your allies and press {confirm}."]], mission: "Select a unit with {confirm}" },
    },
    { // 9 mover
      rep: [["Pulsa el círculo que parpadea para que se mueva hasta allí.", "Lleva el cursor al círculo que parpadea y pulsa {confirm} para que se mueva hasta allí."]],
      en: { rep: [["Tap the blinking circle to make it move there.", "Move the cursor to the blinking circle and press {confirm} to make it move there."]] },
    },
    { // 10 arbusto
      rep: [["Entra en él.", "Entra en él (cursor sobre el arbusto y {confirm})."]],
      en: { rep: [["Step into it.", "Step into it (cursor on the bush and {confirm})."]] },
    },
    { // 11 coger a Tinkle
      rep: [["Pulsa la manita y tu unidad irá a por él.", "Con tu unidad seleccionada, lleva el cursor a Tinkle y pulsa {confirm} sobre la manita y tu unidad irá a por él."]],
      en: { rep: [["Tap the little hand and your unit will go get him.", "With your unit selected, move the cursor to Tinkle and press {confirm} on the little hand and your unit will go get him."]] },
    },
    { // 12 golpear
      rep: [["¡Golpéalo!", "¡Golpéalo! Con quien lo lleva seleccionado, pulsa {actions} y elige «Golpear gnomo» (el icono del puño)."]],
      mission: "Golpea al gnomo con {actions}",
      en: { rep: [["Hit him!", "Hit him! With the carrier selected, press {actions} and choose \"Hit gnome\" (the fist icon)."]], mission: "Hit the gnome with {actions}" },
    },
    { // 13 lanzar
      rep: [["pulsa lanzar y elígelo.", "con quien lo lleva seleccionado, pulsa {actions}, elige «Pasar gnomo», lleva el cursor a tu aliado y pulsa {confirm}."]],
      en: { rep: [["tap throw and pick them.", "with the carrier selected, press {actions}, choose \"Pass gnome\", move the cursor to your ally and press {confirm}."]] },
    },
    { // 14 atacar
      rep: [["usa a la unidad con las manos libres para atacar a ese enemigo.", "usa a la unidad con las manos libres para atacar a ese enemigo: selecciónala, lleva el cursor al enemigo y pulsa {confirm}."]],
      en: { rep: [["use the unit with free hands to attack that enemy.", "use the unit with free hands to attack that enemy: select it, move the cursor to the enemy and press {confirm}."]] },
    },
    { // 15 pino
      rep: [["Tala ese pino.", "Tala ese pino: selecciona a tu unidad libre, lleva el cursor al pino y pulsa {confirm}."]],
      en: { rep: [["Chop that pine.", "Chop that pine: select your free unit, move the cursor to the pine and press {confirm}."]] },
    },
    { // 16 cofre
      rep: [["Ahora abre el cofre:", "Ahora abre el cofre (con una unidad seleccionada, el cursor sobre él y {confirm}):"]],
      en: { rep: [["Now open the chest:", "Now open the chest (with a unit selected, the cursor over it and {confirm}):"]] },
    },
    { // 17 estampada
      rep: [["pulsa sobre él para reventar", "selecciona a quien lleva el gnomo, lleva el cursor al tótem y pulsa {confirm} sobre él para reventar"]],
      en: { rep: [["tap it to slam", "select whoever is carrying the gnome, move the cursor to the totem and press {confirm} on it to slam"]] },
    },
    { // 18 Sacrificio
      rep: [["Lanza al gnomo al agua", "Lanza al gnomo al agua (selecciona con {confirm}, abre las acciones con {actions}, elige lanzar y apunta a la calavera con {confirm})"]],
      en: { rep: [["Throw the gnome into the water", "Throw the gnome into the water (select with {confirm}, open actions with {actions}, choose throw and aim at the skull with {confirm})"]] },
    },
    { // 19 Habilidades
      rep: [["Abre Habilidades, échale un vistazo y ciérrala.", "Selecciona tu Obelisco ({toObelisk} lleva el cursor y {confirm} lo selecciona), abre Habilidades ({prevUnit} y {nextUnit} cambian de opción, {confirm} abre la marcada), échale un vistazo y ciérrala con {back}."]],
      mission: "Abre Habilidades y ciérrala con {back}",
      en: { rep: [["Open Skills, take a look and close it.", "Select your Obelisk ({toObelisk} moves the cursor there and {confirm} selects it), open Skills ({prevUnit} and {nextUnit} switch options, {confirm} opens the highlighted one), take a look and close it with {back}."]],
            mission: "Open Skills and close it with {back}" },
    },
    { // 20 Armería
      rep: [["Ábrela y ciérrala.", "Ábrela con {confirm} (con el Obelisco seleccionado, {prevUnit} y {nextUnit} cambian de opción) y ciérrala con {back}."]],
      mission: "Abre la Armería y ciérrala con {back}",
      en: { rep: [["Open it and close it.", "Open it with {confirm} (with the Obelisk selected, {prevUnit} and {nextUnit} switch options) and close it with {back}."]],
            mission: "Open the Armory and close it with {back}" },
    },
    { // 21 pasar turno
      rep: [["pulsa PASAR TURNO.", "pulsa {endTurn} (PASAR TURNO)."]],
      mission: "Pulsa {endTurn}: PASAR TURNO",
      en: { rep: [["tap END TURN.", "press {endTurn} (END TURN)."]], mission: "Press {endTurn}: END TURN" },
    },
    null, // 22 final
  ],

  mush: [
    null, // 0 historia
    null, // 1 historia
    { // 2 seta
      rep: [["con la manita (no gasta acción)", "con la manita (cursor sobre ella y {confirm}; no gasta acción)"]],
      en: { rep: [["with the little hand (it costs no action)", "with the little hand (cursor on it and {confirm}; costs no action)"]] },
    },
    { // 3 cuenta atrás
      rep: [["Pulsa PASAR TURNO y míralo.", "Pulsa {endTurn} (PASAR TURNO) y míralo."]],
      en: { rep: [["Tap END TURN and watch.", "Press {endTurn} (END TURN) and watch."]] },
    },
    { // 4 ofrecer
      rep: [["o pulsa su diana.", "o pulsa {confirm} sobre su diana (con la unidad seleccionada)."]],
      en: { rep: [["or tap its target.", "or press {confirm} on its target (with the unit selected)."]] },
    },
    { // 5 Tinkle
      rep: [["Cógelo.", "Cógelo: unidad seleccionada, cursor sobre él y {confirm} en la manita."]],
      en: { rep: [["Grab him.", "Grab him: unit selected, cursor on him and {confirm} on the little hand."]] },
    },
    { // 6 estampar
      rep: [["Selecciona a tu unidad y pulsa sobre el altar.", "Selecciona a tu unidad, lleva el cursor al altar y pulsa {confirm} sobre su diana."]],
      en: { rep: [["Select your unit and tap the altar.", "Select your unit, move the cursor to the altar and press {confirm} on its target icon."]] },
    },
    { // 7 GnomOgro
      rep: [["Pulsa PASAR TURNO y míralo.", "Pulsa {endTurn} (PASAR TURNO) y míralo."]],
      mission: "Pasa turno con {endTurn} y mira al GnomOgro",
      en: { rep: [["Tap END TURN and watch.", "Press {endTurn} (END TURN) and watch."]], mission: "End turn with {endTurn} and watch the GnomOgre" },
    },
    null, // 8 final
  ],

  rock: [
    null, // 0 historia
    null, // 1 historia
    { // 2 tambor
      rep: [["Acerca tu unidad y verás.", "Acerca tu unidad al tambor: selecciónala, lleva el cursor a una casilla pegada a él y pulsa {confirm}, y verás."]],
      en: { rep: [["Move your unit closer and you'll see.", "Move your unit closer: select it, move the cursor to a tile next to the drum and press {confirm}, and you'll see."]] },
    },
    { // 3 Tinkle
      rep: [["Coge a Tinkle.", "Coge a Tinkle: unidad seleccionada, cursor sobre él y {confirm} en la manita."]],
      en: { rep: [["Grab Tinkle.", "Grab Tinkle: unit selected, cursor on him and {confirm} on the little hand."]] },
    },
    { // 4 golpear
      rep: [["Golpéalo con el puño sin alejarte del tambor.", "Golpéalo sin separarte del tambor: con la unidad seleccionada, pulsa {actions} y elige «Golpear gnomo» (el puño)."]],
      mission: "Golpea a Tinkle junto al tambor con {actions}",
      en: { rep: [["Hit him with the fist without leaving the drum.", "Hit him without leaving the drum: with the unit selected, press {actions} and choose \"Hit gnome\" (the fist)."]], mission: "Hit Tinkle next to the drum with {actions}" },
    },
    { // 5 pasar turno
      rep: [["Pulsa PASAR TURNO.", "Pulsa {endTurn} (PASAR TURNO)."]],
      mission: "Pasa turno con {endTurn} y mira la lluvia de rocas",
      en: { rep: [["Tap END TURN.", "Press {endTurn} (END TURN)."]], mission: "End turn with {endTurn} and watch the rock rain" },
    },
    { // 6 fragmento
      rep: [["Pasa por encima de uno para recogerlo:", "Pasa por encima de uno (selecciona a tu unidad, lleva el cursor a la casilla marcada junto al fragmento y pulsa {confirm}) para recogerlo:"]],
      en: { rep: [["Walk over one to pick it up:", "Walk over one (select your unit, move the cursor to the marked tile by the fragment and press {confirm}) to pick it up:"]] },
    },
    { // 7 lanzar fragmento
      rep: [["Abre la mochila, elige una piedra y apunta al volcán.",
             "Abre la mochila ({actions} y elige «Mochila»), pulsa {confirm} sobre el fragmento dos veces (una elige, otra lo usa) y apunta al volcán: cursor sobre él y {confirm}. Con {back} cancelas el apuntado."]],
      en: { rep: [["Open the backpack, pick a stone and aim at the volcano.",
                   "Open the backpack (press {actions} and choose \"Backpack\"), press {confirm} on the shard twice (once to pick, once to use it) and aim at the volcano: cursor on it and {confirm}. {back} cancels the aiming."]] },
    },
    { // 8 estampar volcán
      rep: [["Estampa a Tinkle contra él y prepárate", "Estampa a Tinkle contra él (con quien lo lleva seleccionado, cursor sobre el volcán y {confirm} en su diana) y prepárate"]],
      en: { rep: [["Slam Tinkle into it and get ready", "Slam Tinkle into it (with the carrier selected, cursor on the volcano and {confirm} on its target icon) and get ready"]] },
    },
    { // 9 explosión
      rep: [["pulsa PASAR TURNO:", "pulsa {endTurn} (PASAR TURNO):"]],
      mission: "Pasa turno con {endTurn} y mira la explosión",
      en: { rep: [["tap END TURN:", "press {endTurn} (END TURN):"]], mission: "End turn with {endTurn} and watch the explosion" },
    },
    null, // 10 final
  ],
  crane: [
    null, // 0 historia
    null, // 1 historia
    { // 2 Tinkle
      rep: [["Coge a Tinkle.", "Coge a Tinkle: unidad seleccionada, cursor sobre él y {confirm} en la manita."]],
      en: { rep: [["Grab Tinkle.", "Grab Tinkle: unit selected, cursor on him and {confirm} on the little hand."]] },
    },
    { // 3 lanzar al huevo
      rep: [["Pulsa lanzar y apunta al huevo:", "Con la unidad seleccionada, pulsa {confirm} sobre el icono de lanzar y elige con la cruceta la flecha hacia el huevo:"]],
      en: { rep: [["Tap throw and aim at the egg:", "With the unit selected, press {confirm} on the throw icon and pick the arrow toward the egg with the D-pad:"]] },
    },
    { // 4 carambola
      rep: [["Lanza otro gnomo y mira la carambola.", "Lanza otro gnomo ({confirm} en el icono de lanzar y luego en la flecha) y mira la carambola."]],
      en: { rep: [["Throw another gnome and watch the carom.", "Throw another gnome ({confirm} on the throw icon, then on an arrow) and watch the carom."]] },
    },
    null, // 5 info
    { // 6 explotar
      rep: [["Lanza el último gnomo.", "Lanza el último gnomo: {confirm} en el icono de lanzar y luego en una flecha."]],
      en: { rep: [["Throw the last gnome.", "Throw the last gnome: {confirm} on the throw icon, then on an arrow."]] },
    },
    null, // 7 info
    { // 8 espantar a la grulla
      rep: [["Lánzale un gnomo a la grulla:", "Lánzale un gnomo a la grulla ({confirm} en el icono de lanzar y luego sobre ella):"]],
      en: { rep: [["Throw a gnome at the crane:", "Throw a gnome at the crane ({confirm} on the throw icon, then on it):"]] },
    },
    null, // 9 final
  ],
};

// Nombres de las opciones del menú de acciones (X) en inglés.
if (typeof I18N !== "undefined" && I18N.addTr) {
  [["Golpear gnomo", "Hit gnome"], ["Pasar gnomo", "Pass gnome"], ["Información de la unidad", "Unit information"], ["Mochila", "Backpack"], ["Acciones", "Actions"]].forEach(([es, en]) => I18N.addTr(es, en));
}

Object.assign(Tutorial, {
  // ¿Se está jugando ahora con el mando? (el último dispositivo usado es el mando)
  _padMode() {
    return typeof GamepadCtl !== "undefined" && !!GamepadCtl.connected && !!GamepadCtl.active;
  },

  // Firma del modo y de la asignación de botones: si cambia, se vuelve a escribir el paso.
  _padSig() {
    if (!this._padMode()) return "mouse";
    try {
      return "pad:" + JSON.stringify(GamepadCtl.map);
    } catch (e) {
      return "pad";
    }
  },

  // {confirm} → botón real asignado a esa acción (A, B, X, Y, LB, R3, Menú...).
  _padTokens(text) {
    if (!text || typeof text !== "string") return text;
    return text.replace(/\{(\w+)\}/g, (m, act) => {
      const i = GamepadCtl.map && GamepadCtl.map[act];
      const d = typeof GP_BTN !== "undefined" && GP_BTN[i];
      return d ? `[${d.n}]` : m;
    });
  },

  // Aplica la variante `pv` (parte es o en) a un texto original.
  _padApply(orig, pv, key, label) {
    if (!pv) return orig;
    let t = orig;
    if (typeof pv[key] === "string") return this._padTokens(pv[key]);
    if (key === "say") {
      (pv.rep || []).forEach(([from, to]) => {
        if (t && t.indexOf(from) >= 0) t = t.replace(from, to);
        else if (label) console.warn("[tutorial-pad] no se encontró el fragmento en", label, from);
      });
      if (pv.add) t = t + pv.add;
    }
    return this._padTokens(t);
  },

  // Usado por Tutorial._steps(): sustituye los textos del paso por los de mando.
  _padSteps(steps) {
    const set = TUTORIAL_PAD_TEXTS[this._scenario];
    if (!set || !this._padMode()) return steps;
    const base = this._textsFor(this._scenario) || [];
    steps.forEach((s, i) => {
      const pv = set[i];
      if (!pv) return;
      const bt = base[i] || {};
      ["say", "mission", "ok", "button"].forEach((k) => {
        if (!s[k]) return;
        const orig = s[k];
        const es = this._padApply(orig, pv, k, `${this._scenario}#${i}`);
        s[k] = es;
        const enOrig = bt.en && bt.en[k];
        if (enOrig && pv.en && typeof I18N !== "undefined" && I18N.addTr) {
          const en = this._padApply(enOrig, pv.en, k, `${this._scenario}#${i} (en)`);
          if (en !== enOrig) I18N.addTr(es, en);
        }
      });
    });
    return steps;
  },

  // Termina al instante la escritura animada (cambio de modo: no se vuelve a "hablar").
  _typeInstant() {
    clearTimeout(this._typeTimer);
    if (this._els.text) this._els.text.textContent = this._fullText || "";
    if (this._els.portrait) this._els.portrait.classList.remove("tut-portrait--talk");
  },

  // Cambio de ratón/táctil a mando (o al revés) en mitad de un paso: se reescribe
  // el diálogo, la misión y el botón de ESE paso sin repetir su preparación.
  _padWatch() {
    if (!this.active || !this._els || !this._els.panel) return;
    const sig = this._padSig();
    if (this._lastPadSig === undefined) this._lastPadSig = sig;
    if (sig === this._lastPadSig) return;
    this._lastPadSig = sig;
    // Si había un "mantén pulsado" a medias con el ratón, se cancela.
    if (this._hold) {
      cancelAnimationFrame(this._holdRaf);
      this._hold = null;
      if (this._els.hold) this._els.hold.classList.remove("tut-hold--on", "tut-hold--fail");
    }
    const i = this.stepIndex;
    const fresh = this._steps()[i];
    const cur = this._ctx.step;
    if (!fresh || !cur) return;
    ["say", "mission", "ok", "button"].forEach((k) => {
      if (fresh[k] !== undefined) cur[k] = fresh[k];
    });
    const E = this._els;
    const done = E.mission && E.mission.classList.contains("tut-mission--done");
    if (done) {
      if (cur.ok) {
        this._typeText(cur.ok);
        this._typeInstant();
      }
    } else {
      this._typeText(cur.say);
      this._typeInstant();
      if (cur.mission) E.missionText.textContent = typeof I18N !== "undefined" && I18N.tr ? I18N.tr(cur.mission) : cur.mission;
      if (cur.button) E.btn.textContent = typeof I18N !== "undefined" && I18N.tr ? I18N.tr(cur.button) : cur.button;
    }
  },
});
