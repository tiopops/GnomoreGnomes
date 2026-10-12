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
      rep: [["Pulsa sobre él.", "Lleva el cursor hasta él y pulsa {confirm} (con {toObelisk} el cursor salta directo a tu Obelisco)."]],
      mission: "Selecciona tu Obelisco con {confirm}",
      en: { rep: [["Tap it.", "Move the cursor onto it and press {confirm} ({toObelisk} jumps the cursor straight to your Obelisk)."]], mission: "Select your Obelisk with {confirm}" },
    },
    { // 2 Reclutar
      rep: [["Ahora pulsa sobre el icono de Reclutar, el primero de los tres.", "Ahora abre Reclutar, la primera de las tres opciones del Obelisco. {prevUnit} y {nextUnit} recorren las opciones y {confirm} abre la marcada: la primera ya lo está."]],
      mission: "Abre Reclutar con {confirm}",
      en: { rep: [["Now tap the Recruit icon, the first of the three.", "Now open Recruit, the first of the Obelisk's three options. {prevUnit} and {nextUnit} cycle through the options and {confirm} opens the highlighted one: the first is already highlighted."]], mission: "Open Recruit with {confirm}" },
    },
    { // 3 TruenoEspora
      rep: [["Elige a TruenoEspora, el del sombrero de seta:", "Elige a TruenoEspora (muévete con la cruceta y pulsa {confirm}), el del sombrero de seta:"]],
      mission: "Elige a TruenoEspora con {confirm}",
      en: { rep: [["Pick TruenoEspora, the one in the mushroom hat:", "Pick TruenoEspora (move with the D-pad and press {confirm}), the one in the mushroom hat:"]], mission: "Pick TruenoEspora with {confirm}" },
    },
    { // 4 RECLUTAR
      rep: [["Ahora pulsa RECLUTAR. Un clic más", "Ahora baja con la cruceta hasta RECLUTAR y pulsa {confirm}. Una pulsación más"]],
      mission: "Pulsa RECLUTAR con {confirm}",
      en: { rep: [["Now tap RECRUIT. One more click", "Now move down with the D-pad to RECRUIT and press {confirm}. One more press"]], mission: "Press RECRUIT with {confirm}" },
    },
    { // 5 casilla
      rep: [["Elige una y tu unidad aparecerá ahí", "Lleva el cursor a una con la cruceta y pulsa {confirm} ({back} cancela): tu unidad aparecerá ahí"]],
      mission: "Elige una casilla con {confirm}",
      en: { rep: [["Pick one and your unit will appear there", "Move the cursor to one with the D-pad and press {confirm} ({back} cancels): your unit will appear there"]], mission: "Pick a tile with {confirm}" },
    },
    { // 6 información de la unidad (sin mantener pulsado)
      rep: [["selecciona a TruenoEspora y mantén pulsada la cara de tu unidad, abajo a la izquierda, y verás todas sus estadísticas. Con las unidades enemigas funciona igual: selecciónalas y mira",
             "selecciona a TruenoEspora (cursor sobre ella y {confirm}), pulsa {actions} y elige «Información de la unidad»: verás todas sus estadísticas. Se cierra con {back}, sin mantener nada. Con las unidades enemigas funciona igual: lleva el cursor a ellas, pulsa {confirm} y mira"]],
      mission: "Abre su información y ciérrala con {back}",
      en: { rep: [["select TruenoEspora and hold down your unit's face, bottom left, and you'll see all its stats. It works the same with enemy units: select them and see",
                   "select TruenoEspora (cursor on it and {confirm}), press {actions} and choose \"Unit information\": you'll see all its stats. It closes with {back}, no holding needed. It works the same with enemy units: move the cursor to them, press {confirm} and see"]],
            mission: "Open its information and close it with {back}" },
    },
    { // 7 segunda unidad
      rep: [["Obelisco, Reclutar, unidad, RECLUTAR y casilla.", "Obelisco ({toObelisk} lleva el cursor hasta él), Reclutar, unidad, RECLUTAR y casilla, todo con {confirm}."]],
      en: { rep: [["Obelisk, Recruit, unit, RECRUIT and tile.", "Obelisk ({toObelisk} moves the cursor there), Recruit, unit, RECRUIT and tile, all with {confirm}."]] },
    },
    { // 8 seleccionar
      rep: [["pulsa sobre uno de tus aliados.", "lleva el cursor a uno de tus aliados y pulsa {confirm}."]],
      mission: "Selecciona una unidad con {confirm}",
      en: { rep: [["tap one of your allies.", "move the cursor to one of your allies and press {confirm}."]], mission: "Select a unit with {confirm}" },
    },
    { // 9 mover
      rep: [["Pulsa el que parpadea y se moverá.", "Lleva el cursor al que parpadea y pulsa {confirm}: se moverá."]],
      en: { rep: [["Tap the blinking one and off it goes.", "Move the cursor to the blinking one and press {confirm}: off it goes."]] },
    },
    { // 10 arbusto
      rep: [["Métete dentro y el rival", "Métete dentro (cursor sobre el arbusto y {confirm}) y el rival"]],
      en: { rep: [["Get inside and your rival", "Get inside (cursor on the bush and {confirm}) and your rival"]] },
    },
    { // 11 coger a Tinkle
      rep: [["Acércate y pulsa la manita para cogerlo.", "Con tu unidad seleccionada, lleva el cursor a Tinkle y pulsa {confirm} sobre la manita para cogerlo."]],
      en: { rep: [["Walk up and tap the little hand to grab him.", "With your unit selected, move the cursor to Tinkle and press {confirm} on the little hand to grab him."]] },
    },
    { // 12 golpear
      rep: [["¡Golpéalo!", "¡Golpéalo! Con quien lo lleva seleccionado, pulsa {actions} y elige «Golpear gnomo» (el icono del puño)."]],
      mission: "Golpea al gnomo con {actions}",
      en: { rep: [["Hit him!", "Hit him! With the carrier selected, press {actions} and choose \"Hit gnome\" (the fist icon)."]], mission: "Hit the gnome with {actions}" },
    },
    { // 13 lanzar
      rep: [["Pulsa el icono de lanzar y luego selecciona a tu amigo.", "Con quien lo lleva seleccionado, pulsa {actions}, elige «Pasar gnomo» y luego lleva el cursor a tu amigo y pulsa {confirm}."]],
      en: { rep: [["Tap the throw icon and then select your friend.", "With the carrier selected, press {actions}, choose \"Pass gnome\", then move the cursor to your friend and press {confirm}."]] },
    },
    { // 14 atacar
      rep: [["Selecciona a tu unidad libre y pulsa al enemigo.", "Selecciona a tu unidad libre, lleva el cursor al enemigo y pulsa {confirm}."]],
      en: { rep: [["Select your free unit and tap the enemy.", "Select your free unit, move the cursor to the enemy and press {confirm}."]] },
    },
    { // 15 pino
      rep: [["Selecciona a tu unidad libre y pulsa el pino.", "Selecciona a tu unidad libre, lleva el cursor al pino y pulsa {confirm}."]],
      en: { rep: [["Select your free unit and tap the pine.", "Select your free unit, move the cursor to the pine and press {confirm}."]] },
    },
    { // 16 cofre
      rep: [["Se abren haciendo clic sobre ellos", "Se abren con una unidad seleccionada, el cursor sobre ellos y {confirm},"]],
      en: { rep: [["You open them by clicking on them,", "You open them with a unit selected, the cursor over them and {confirm},"]] },
    },
    { // 17 estampada
      rep: [["Acércate con quien lleva el gnomo y pulsa la diana.", "Selecciona a quien lleva el gnomo, lleva el cursor al tótem y pulsa {confirm} sobre la diana."]],
      en: { rep: [["Walk up with whoever is carrying the gnome and tap the target.", "Select whoever is carrying the gnome, move the cursor to the totem and press {confirm} on the target."]] },
    },
    { // 18 Habilidades
      rep: [["Selecciónalo y abre Habilidades:", "Selecciónalo ({toObelisk} lleva el cursor y {confirm} lo selecciona) y abre Habilidades ({prevUnit} y {nextUnit} cambian de opción, {confirm} abre la marcada):"],
            ["ciérrala con la X.", "ciérrala con {back}."]],
      mission: "Abre Habilidades y ciérrala con {back}",
      en: { rep: [["Select it and open Skills:", "Select it ({toObelisk} moves the cursor there and {confirm} selects it) and open Skills ({prevUnit} and {nextUnit} switch options, {confirm} opens the highlighted one):"],
                  ["close it with the X.", "close it with {back}."]],
            mission: "Open Skills and close it with {back}" },
    },
    { // 19 Armería
      rep: [["Ábrela y ciérrala.", "Ábrela con {confirm} (con el Obelisco seleccionado, {prevUnit} y {nextUnit} cambian de opción) y ciérrala con {back}."]],
      mission: "Abre la Armería y ciérrala con {back}",
      en: { rep: [["Open it and close it.", "Open it with {confirm} (with the Obelisk selected, {prevUnit} and {nextUnit} switch options) and close it with {back}."]],
            mission: "Open the Armory and close it with {back}" },
    },
    { // 20 pasar turno
      rep: [["pulsa PASAR TURNO.", "pulsa {endTurn} (PASAR TURNO)."]],
      mission: "Pulsa {endTurn}: PASAR TURNO",
      en: { rep: [["tap END TURN.", "press {endTurn} (END TURN)."]], mission: "Press {endTurn}: END TURN" },
    },
    null, // 21 final
  ],

  mush: [
    null, // 0 historia
    null, // 1 historia
    { // 2 seta
      rep: [["con la manita (coger no gasta acción)", "con la manita (cursor sobre ella y {confirm}; coger no gasta acción)"]],
      en: { rep: [["with the little hand (picking up costs no action)", "with the little hand (cursor on it and {confirm}; picking up costs no action)"]] },
    },
    { // 3 cuenta atrás
      rep: [["Pulsa PASAR TURNO y compruébalo", "Pulsa {endTurn} (PASAR TURNO) y compruébalo"]],
      en: { rep: [["Press END TURN and see for yourself", "Press {endTurn} (END TURN) and see for yourself"]] },
    },
    { // 4 ofrecer
      rep: [["o con que pulses su diana, para ofrecérsela.", "o con que pulses {confirm} sobre su diana (con la unidad seleccionada), para ofrecérsela."]],
      en: { rep: [["or to press its target icon, to offer it.", "or to press {confirm} on its target icon (with the unit selected), to offer it."]] },
    },
    { // 5 Tinkle
      rep: [["(con la diana, como contra un tótem)", "(con {confirm} sobre su diana, como contra un tótem)"],
            ["Coge a Tinkle.", "Coge a Tinkle: unidad seleccionada, cursor sobre él y {confirm} en la manita."]],
      en: { rep: [["(with the target icon, like against a totem)", "(with {confirm} on its target icon, like against a totem)"],
                  ["Pick up Tinkle.", "Pick up Tinkle: unit selected, cursor on him and {confirm} on the little hand."]] },
    },
    { // 6 estampar
      rep: [["Selecciona a tu unidad y pulsa la diana del altar.", "Selecciona a tu unidad, lleva el cursor al altar y pulsa {confirm} sobre su diana."]],
      en: { rep: [["Select your unit and press the altar's target icon.", "Select your unit, move the cursor to the altar and press {confirm} on its target icon."]] },
    },
    { // 7 GnomOgro
      rep: [["Pasa turno y míralo caminar.", "Pasa turno con {endTurn} y míralo caminar."]],
      mission: "Pasa turno con {endTurn} y mira al GnomOgro",
      en: { rep: [["End your turn and watch it walk.", "End your turn with {endTurn} and watch it walk."]], mission: "End turn with {endTurn} and watch the GnomOgre" },
    },
    null, // 8 final
  ],

  rock: [
    null, // 0 historia
    null, // 1 historia
    { // 2 tambor
      rep: [["Acerca tu unidad al tambor.", "Acerca tu unidad al tambor: selecciónala, lleva el cursor a una casilla pegada a él y pulsa {confirm}."]],
      en: { rep: [["Bring your unit next to the drum.", "Bring your unit next to the drum: select it, move the cursor to a tile next to it and press {confirm}."]] },
    },
    { // 3 Tinkle
      rep: [["Cógelo.", "Cógelo: unidad seleccionada, cursor sobre él y {confirm} en la manita."]],
      en: { rep: [["Pick him up.", "Pick him up: unit selected, cursor on him and {confirm} on the little hand."]] },
    },
    { // 4 golpear
      rep: [["Ahora golpéalo, con el puño, mientras sigues pegado al tambor.", "Ahora golpéalo mientras sigues pegado al tambor: con la unidad seleccionada, pulsa {actions} y elige «Golpear gnomo» (el puño)."]],
      mission: "Golpea a Tinkle junto al tambor con {actions}",
      en: { rep: [["Now hit him, with your fist, while you stay next to the drum.", "Now hit him while you stay next to the drum: with the unit selected, press {actions} and choose \"Hit gnome\" (the fist)."]], mission: "Hit Tinkle next to the drum with {actions}" },
    },
    { // 5 pasar turno
      rep: [["Pulsa PASAR TURNO.", "Pulsa {endTurn} (PASAR TURNO)."]],
      mission: "Pasa turno con {endTurn} y mira la lluvia de rocas",
      en: { rep: [["Press END TURN.", "Press {endTurn} (END TURN)."]], mission: "End turn with {endTurn} and watch the rock rain" },
    },
    { // 6 fragmento
      rep: [["Pisa uno.", "Pisa uno: selecciona a tu unidad, lleva el cursor a la casilla marcada junto al fragmento y pulsa {confirm}."]],
      en: { rep: [["Step on one.", "Step on one: select your unit, move the cursor to the marked tile by the fragment and press {confirm}."]] },
    },
    { // 7 lanzar fragmento
      rep: [["Abre la mochila, pulsa el fragmento dos veces (una elige, otra lo usa) y apunta al volcán, el de ahí enfrente.",
             "Abre la mochila ({actions} y elige «Mochila»), pulsa {confirm} sobre el fragmento dos veces (una elige, otra lo usa) y apunta al volcán, el de ahí enfrente: cursor sobre él y {confirm}. Con {back} cancelas el apuntado."]],
      en: { rep: [["Open the backpack, press the fragment twice (once to pick, once to use it) and aim at the volcano, the one right there.",
                   "Open the backpack (press {actions} and choose \"Backpack\"), press {confirm} on the fragment twice (once to pick, once to use it) and aim at the volcano, the one right there: cursor on it and {confirm}. {back} cancels the aiming."]] },
    },
    { // 8 estampar volcán
      rep: [["Estámpalo contra el volcán.", "Estámpalo contra el volcán: con quien lo lleva seleccionado, cursor sobre el volcán y {confirm} en su diana."]],
      en: { rep: [["Smash him against the volcano.", "Smash him against the volcano: with the carrier selected, cursor on the volcano and {confirm} on its target icon."]] },
    },
    { // 9 explosión
      rep: [["Pasa turno:", "Pasa turno con {endTurn}:"]],
      mission: "Pasa turno con {endTurn} y mira la explosión",
      en: { rep: [["End your turn:", "End your turn with {endTurn}:"]], mission: "End turn with {endTurn} and watch the explosion" },
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
