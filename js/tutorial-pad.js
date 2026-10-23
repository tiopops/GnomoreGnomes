/* Gnomore Gnomes — Tutoriales con mando.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Las variantes "con mando" del diálogo, la misión y la réplica de CADA paso
       de los tres tutoriales (Primeros pasos, MushBoom, Rock'n Troll), en español
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
      rep: [["Púlsalo.", "Lleva el cursor hasta él y pulsa {confirm} (con {toObelisk} el cursor salta directo a tu Obelisco)."]],
      mission: "Selecciona tu Obelisco con {confirm}",
      en: { rep: [["Tap it.", "Move the cursor onto it and press {confirm} ({toObelisk} jumps the cursor straight to your Obelisk)."]], mission: "Select your Obelisk with {confirm}" },
    },
    { // 2 Reclutar
      rep: [["Ahora el icono de Reclutar, el primero de la izquierda.", "Ahora abre Reclutar, la primera de las tres opciones del Obelisco. {prevUnit} y {nextUnit} recorren las opciones y {confirm} abre la marcada: la primera ya lo está."]],
      mission: "Abre Reclutar con {confirm}",
      en: { rep: [["Now the Recruit icon, the first one on the left.", "Now open Recruit, the first of the Obelisk's three options. {prevUnit} and {nextUnit} cycle through the options and {confirm} opens the highlighted one: the first is already highlighted."]], mission: "Open Recruit with {confirm}" },
    },
    { // 3 TruenoEspora
      rep: [["Elige a TruenoEspora, el de la seta:", "Elige a TruenoEspora (muévete con la cruceta y pulsa {confirm}), el de la seta:"]],
      mission: "Elige a TruenoEspora con {confirm}",
      en: { rep: [["Pick TruenoEspora, the mushroom guy:", "Pick TruenoEspora (move with the D-pad and press {confirm}), the mushroom guy:"]], mission: "Pick TruenoEspora with {confirm}" },
    },
    { // 4 RECLUTAR
      rep: [["Pulsa RECLUTAR y otro", "Baja con la cruceta hasta RECLUTAR, pulsa {confirm} y otro"]],
      mission: "Pulsa RECLUTAR con {confirm}",
      en: { rep: [["Hit RECRUIT and another", "Move down with the D-pad to RECRUIT, press {confirm} and another"]], mission: "Press RECRUIT with {confirm}" },
    },
    { // 5 casilla
      rep: [["Elige una.", "Lleva el cursor a una con la cruceta y pulsa {confirm} ({back} cancela)."]],
      mission: "Elige una casilla con {confirm}",
      en: { rep: [["Pick one.", "Move the cursor to one with the D-pad and press {confirm} ({back} cancels)."]], mission: "Pick a tile with {confirm}" },
    },
    { // 6 información de la unidad (sin mantener pulsado)
      rep: [["selecciona a tu unidad y mantén pulsada su cara, abajo a la izquierda, para ver sus estadísticas. Con los enemigos igual.",
             "selecciona a tu unidad (cursor sobre ella y {confirm}), pulsa {actions} y elige «Información de la unidad» para ver sus estadísticas. Se cierra con {back}. Con los enemigos igual: cursor sobre ellos y {confirm}."]],
      mission: "Abre su información y ciérrala con {back}",
      en: { rep: [["select your unit and hold its face, bottom left, to see its stats. Works on enemies too.",
                   "select your unit (cursor on it and {confirm}), press {actions} and choose \"Unit information\" to see its stats. Close it with {back}. Same with enemies: cursor on them and {confirm}."]],
            mission: "Open its information and close it with {back}" },
    },
    { // 7 segunda unidad
      rep: [["Recluta otro igual:", "Recluta otro igual (Obelisco —{toObelisk} lleva el cursor hasta él—, Reclutar, unidad, RECLUTAR y casilla, todo con {confirm}):"]],
      en: { rep: [["Recruit another:", "Recruit another (Obelisk —{toObelisk} moves the cursor there—, Recruit, unit, RECRUIT and tile, all with {confirm}):"]] },
    },
    { // 8 seleccionar
      rep: [["pulsa a uno de tus aliados.", "lleva el cursor a uno de tus aliados y pulsa {confirm}."]],
      mission: "Selecciona una unidad con {confirm}",
      en: { rep: [["tap one of your allies.", "move the cursor to one of your allies and press {confirm}."]], mission: "Select a unit with {confirm}" },
    },
    { // 9 mover
      rep: [["Pulsa el que parpadea.", "Lleva el cursor al que parpadea y pulsa {confirm}."]],
      en: { rep: [["Tap the blinking one.", "Move the cursor to the blinking one and press {confirm}."]] },
    },
    { // 10 arbusto
      rep: [["dentro, el rival", "dentro (cursor sobre el arbusto y {confirm}), el rival"]],
      en: { rep: [["inside, enemies", "inside (cursor on the bush and {confirm}), enemies"]] },
    },
    { // 11 coger a Tinkle
      rep: [["Pulsa la manita para cogerlo;", "Con tu unidad seleccionada, lleva el cursor a Tinkle y pulsa {confirm} sobre la manita para cogerlo;"]],
      en: { rep: [["Tap the hand to grab him;", "With your unit selected, move the cursor to Tinkle and press {confirm} on the little hand to grab him;"]] },
    },
    { // 12 golpear
      rep: [["¡golpéalo!", "¡golpéalo! Con quien lo lleva seleccionado, pulsa {actions} y elige «Golpear gnomo» (el icono del puño)."]],
      mission: "Golpea al gnomo con {actions}",
      en: { rep: [["hit him!", "hit him! With the carrier selected, press {actions} and choose \"Hit gnome\" (the fist icon)."]], mission: "Hit the gnome with {actions}" },
    },
    { // 13 lanzar
      rep: [["Pulsa lanzar y elige a tu aliado.", "Con quien lo lleva seleccionado, pulsa {actions}, elige «Pasar gnomo» y luego lleva el cursor a tu amigo y pulsa {confirm}."]],
      en: { rep: [["Tap throw and pick your ally.", "With the carrier selected, press {actions}, choose \"Pass gnome\", then move the cursor to your friend and press {confirm}."]] },
    },
    { // 14 atacar
      rep: [["que el de las manos libres se ocupe del enemigo.", "que el de las manos libres se ocupe del enemigo: selecciónalo, lleva el cursor al enemigo y pulsa {confirm}."]],
      en: { rep: [["so let the free unit handle the enemy.", "so let the free unit handle the enemy: select it, move the cursor to the enemy and press {confirm}."]] },
    },
    { // 15 pino
      rep: [["Tala el pino.", "Tala el pino: selecciona a tu unidad libre, lleva el cursor al pino y pulsa {confirm}."]],
      en: { rep: [["Chop the pine.", "Chop the pine: select your free unit, move the cursor to the pine and press {confirm}."]] },
    },
    { // 16 cofre
      rep: [["Ábrelo.", "Ábrelo con una unidad seleccionada, el cursor sobre él y {confirm}."]],
      en: { rep: [["Open it.", "Open it with a unit selected, the cursor over it and {confirm}."]] },
    },
    { // 17 estampada
      rep: [["Pulsa la diana.", "Selecciona a quien lleva el gnomo, lleva el cursor al tótem y pulsa {confirm} sobre la diana."]],
      en: { rep: [["Tap the target.", "Select whoever is carrying the gnome, move the cursor to the totem and press {confirm} on the target."]] },
    },
    { // 18 Sacrificio
      rep: [["Ese charco lo he puesto yo, de nada.", "Ese charco lo he puesto yo, de nada. Selecciona con {confirm}, abre las acciones ({actions}), elige lanzar y apunta a la calavera con {confirm}."]],
      en: { rep: [["I made that puddle myself, you're welcome.", "I made that puddle myself, you're welcome. Select with {confirm}, open actions ({actions}), choose throw and aim at the skull with {confirm}."]] },
    },
    { // 19 Habilidades
      rep: [["abre Habilidades,", "selecciónalo ({toObelisk} lleva el cursor y {confirm} lo selecciona) y abre Habilidades ({prevUnit} y {nextUnit} cambian de opción, {confirm} abre la marcada),"],
            ["Mírala y ciérrala.", "Mírala y ciérrala con {back}."]],
      mission: "Abre Habilidades y ciérrala con {back}",
      en: { rep: [["open Skills,", "select it ({toObelisk} moves the cursor there and {confirm} selects it) and open Skills ({prevUnit} and {nextUnit} switch options, {confirm} opens the highlighted one),"],
                  ["Take a look and close it.", "Take a look and close it with {back}."]],
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
      en: { rep: [["Hit END TURN.", "Press {endTurn} (END TURN)."]], mission: "Press {endTurn}: END TURN" },
    },
    null, // 22 final
  ],

  mush: [
    null, // 0 historia
    null, // 1 historia
    { // 2 seta
      rep: [["con la manita (sin gastar acción)", "con la manita (cursor sobre ella y {confirm}; sin gastar acción)"]],
      en: { rep: [["with the hand (no action spent)", "with the hand (cursor on it and {confirm}; no action spent)"]] },
    },
    { // 3 cuenta atrás
      rep: [["Pasa turno y compruébalo", "Pulsa {endTurn} (PASAR TURNO) y compruébalo"]],
      en: { rep: [["End turn and see", "Press {endTurn} (END TURN) and see"]] },
    },
    { // 4 ofrecer
      rep: [["o pulsa su diana.", "o pulsa {confirm} sobre su diana (con la unidad seleccionada)."]],
      en: { rep: [["or tap its target.", "or press {confirm} on its target (with the unit selected)."]] },
    },
    { // 5 Tinkle
      rep: [["estampa uno contra él", "estampa uno contra él (con {confirm} sobre su diana)"],
            ["Coge a Tinkle.", "Coge a Tinkle: unidad seleccionada, cursor sobre él y {confirm} en la manita."]],
      en: { rep: [["slam one into it", "slam one into it (with {confirm} on its target)"],
                  ["Grab Tinkle.", "Pick up Tinkle: unit selected, cursor on him and {confirm} on the little hand."]] },
    },
    { // 6 estampar
      rep: [["Selecciona a tu unidad y pulsa la diana del altar.", "Selecciona a tu unidad, lleva el cursor al altar y pulsa {confirm} sobre su diana."]],
      en: { rep: [["Select your unit and tap the altar's target.", "Select your unit, move the cursor to the altar and press {confirm} on its target icon."]] },
    },
    { // 7 GnomOgro
      rep: [["Pasa turno.", "Pasa turno con {endTurn}."]],
      mission: "Pasa turno con {endTurn} y mira al GnomOgro",
      en: { rep: [["End turn.", "End turn with {endTurn}."]], mission: "End turn with {endTurn} and watch the GnomOgre" },
    },
    null, // 8 final
  ],

  rock: [
    null, // 0 historia
    null, // 1 historia
    { // 2 tambor
      rep: [["Acerca tu unidad.", "Acerca tu unidad al tambor: selecciónala, lleva el cursor a una casilla pegada a él y pulsa {confirm}."]],
      en: { rep: [["Move your unit close.", "Move your unit close: select it, move the cursor to a tile next to the drum and press {confirm}."]] },
    },
    { // 3 Tinkle
      rep: [["Cógelo.", "Cógelo: unidad seleccionada, cursor sobre él y {confirm} en la manita."]],
      en: { rep: [["Grab him.", "Grab him: unit selected, cursor on him and {confirm} on the little hand."]] },
    },
    { // 4 golpear
      rep: [["Golpéalo con el puño sin separarte del tambor.", "Golpéalo sin separarte del tambor: con la unidad seleccionada, pulsa {actions} y elige «Golpear gnomo» (el puño)."]],
      mission: "Golpea a Tinkle junto al tambor con {actions}",
      en: { rep: [["Hit him with the fist without leaving the drum.", "Hit him without leaving the drum: with the unit selected, press {actions} and choose \"Hit gnome\" (the fist)."]], mission: "Hit Tinkle next to the drum with {actions}" },
    },
    { // 5 pasar turno
      rep: [["Pasa turno.", "Pasa turno con {endTurn}."]],
      mission: "Pasa turno con {endTurn} y mira la lluvia de rocas",
      en: { rep: [["End turn.", "End turn with {endTurn}."]], mission: "End turn with {endTurn} and watch the rock rain" },
    },
    { // 6 fragmento
      rep: [["Pisa uno.", "Pisa uno: selecciona a tu unidad, lleva el cursor a la casilla marcada junto al fragmento y pulsa {confirm}."]],
      en: { rep: [["Step on one.", "Step on one: select your unit, move the cursor to the marked tile by the fragment and press {confirm}."]] },
    },
    { // 7 lanzar fragmento
      rep: [["Abre la mochila, pulsa el fragmento dos veces y apunta al volcán.",
             "Abre la mochila ({actions} y elige «Mochila»), pulsa {confirm} sobre el fragmento dos veces (una elige, otra lo usa) y apunta al volcán: cursor sobre él y {confirm}. Con {back} cancelas el apuntado."]],
      en: { rep: [["Open the backpack, tap the shard twice and aim at the volcano.",
                   "Open the backpack (press {actions} and choose \"Backpack\"), press {confirm} on the shard twice (once to pick, once to use it) and aim at the volcano: cursor on it and {confirm}. {back} cancels the aiming."]] },
    },
    { // 8 estampar volcán
      rep: [["Estámpalo.", "Estámpalo contra el volcán: con quien lo lleva seleccionado, cursor sobre el volcán y {confirm} en su diana."]],
      en: { rep: [["Slam him.", "Slam him against the volcano: with the carrier selected, cursor on the volcano and {confirm} on its target icon."]] },
    },
    { // 9 explosión
      rep: [["Pasa turno:", "Pasa turno con {endTurn}:"]],
      mission: "Pasa turno con {endTurn} y mira la explosión",
      en: { rep: [["End turn:", "End turn with {endTurn}:"]], mission: "End turn with {endTurn} and watch the explosion" },
    },
    null, // 10 final
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
