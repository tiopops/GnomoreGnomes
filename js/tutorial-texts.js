/* Gnomore Gnomes — Textos de Nizak en todos los tutoriales.
   Regla de oro: un archivo por mecánica. Este archivo SOLO guarda los diálogos
   (español e inglés) y el ánimo de Nizak de cada paso de cada tutorial.
   Cómo se usa: js/tutorial.js (Tutorial._steps) sustituye el texto de cada paso
   por el de aquí (mismo orden). Se edita desde debug/editar-dialogos-nizak.html,
   que genera este mismo archivo ya listo para sustituirlo.
   Por paso: say (diálogo), mission (nombre de la misión), ok (réplica al
   completarla), button (texto del botón), mood (normal | grunon | aplaude) y
   en: { say, mission, ok, button } con la traducción al inglés. */
const TUTORIAL_TEXTS = {
 "basic": [
  {
   "say": "Otro verdugo… perdón, «jugador». Soy Nizak, tu pelota oficial en este deporte de majaras. Te enseño lo básico para que me aplastes con elegancia.",
   "button": "Vale, viejales",
   "mood": "grunon",
   "en": {
    "say": "Another executioner… sorry, \"player\". I'm Nizak, your official ball in this lunatic sport. I'll teach you the basics so you squash me with style.",
    "button": "Fine, oldie"
   }
  },
  {
   "say": "Esa roca mugrienta es tu Obelisco: hogar, fábrica de reclutas y retrete. Púlsalo. No muerde (nosotros sí).",
   "mission": "Pulsa tu Obelisco",
   "ok": "Has tocado una piedra. Han dado diplomas por menos.",
   "mood": "normal",
   "en": {
    "say": "That filthy rock is your Obelisk: home, recruit factory and toilet. Tap it. It doesn't bite (we do).",
    "mission": "Tap your Obelisk",
    "ok": "You touched a rock. They've handed out diplomas for less."
   }
  },
  {
   "say": "Ahora el icono de Reclutar, el primero de la izquierda.",
   "mission": "Pulsa el icono de Reclutar",
   "ok": "Ya estás en la sala de entrenamiento. El presupuesto no dio para más.",
   "mood": "normal",
   "en": {
    "say": "Now the Recruit icon, the first one on the left.",
    "mission": "Tap the Recruit icon",
    "ok": "Welcome to the training room. The budget didn't stretch further."
   }
  },
  {
   "say": "Elige a TruenoEspora, el de la seta: versátil y con una seta-trampa bajo la manga. Cuesta Puntos de Gloria, ese número amarillo de arriba.",
   "mission": "Elige a TruenoEspora",
   "ok": "Qué sonrisa. Ya sabe a lo que ha venido.",
   "mood": "normal",
   "en": {
    "say": "Pick TruenoEspora, the mushroom guy: versatile, with a trap up his sleeve. He costs Glory Points, that yellow number up top.",
    "mission": "Pick TruenoEspora",
    "ok": "Look at that smile. He knows what he signed up for."
   }
  },
  {
   "say": "Pulsa RECLUTAR y otro pobre diablo firmará sin leer la letra pequeña.",
   "mission": "Pulsa RECLUTAR",
   "ok": "Has encontrado el botón. No despediremos al diseñador. De momento.",
   "mood": "grunon",
   "en": {
    "say": "Hit RECRUIT and another poor soul signs without reading the fine print.",
    "mission": "Tap RECRUIT",
    "ok": "You found the button. We won't fire the designer. Yet."
   }
  },
  {
   "say": "Las casillas marcadas son los sitios libres junto al Obelisco. Elige una.",
   "mission": "Elige una casilla para colocarlo",
   "ok": "¡Compañero leal! Veremos cuánto le dura cuando salpique la sangre.",
   "mood": "normal",
   "en": {
    "say": "Highlighted tiles are free spots next to the Obelisk. Pick one.",
    "mission": "Pick a tile to place it",
    "ok": "A loyal companion! Let's see how long that lasts once blood starts splashing."
   }
  },
  {
   "say": "Truco: selecciona a tu unidad y mantén pulsada su cara, abajo a la izquierda, para ver sus estadísticas. Con los enemigos igual.",
   "mission": "Mantén pulsada su cara (3 s)",
   "ok": "Cuánto aguanta, cuánto pega… información de oro, y gratis.",
   "mood": "normal",
   "en": {
    "say": "Tip: select your unit and hold its face, bottom left, to see its stats. Works on enemies too.",
    "mission": "Hold its face (3 s)",
    "ok": "What it can take, what it can dish out… free gold."
   }
  },
  {
   "say": "Uno solo se aburre. Recluta otro igual: necesitarás a alguien a quien lanzar cosas (yo soy una de ellas).",
   "mission": "Recluta una segunda unidad",
   "ok": "Dos pardillos mejor que uno. Los remordimientos se reparten.",
   "mood": "grunon",
   "en": {
    "say": "One is lonely. Recruit another: you'll need someone to throw things at (I'm one of them).",
    "mission": "Recruit a second unit",
    "ok": "Two fools are better than one. Guilt gets shared."
   }
  },
  {
   "say": "Para dar órdenes hay que seleccionar: pulsa a uno de tus aliados. Con cariño.",
   "mission": "Selecciona una unidad",
   "ok": "¡Eso es! Qué sensación de poder. No te acostumbres.",
   "mood": "normal",
   "en": {
    "say": "To give orders, select first: tap one of your allies. Gently.",
    "mission": "Select a unit",
    "ok": "That's it! Feels powerful, huh? Don't get used to it."
   }
  },
  {
   "say": "Los círculos del suelo marcan a dónde puede ir. Pulsa el que parpadea. Ojo: andar gasta una acción; aquí hasta caminar tiene precio.",
   "mission": "Mueve la unidad hasta la zona marcada.",
   "ok": "¡Camina! Un milagro de la ingeniería orgánica. Casi sin tropezar.",
   "mood": "grunon",
   "en": {
    "say": "The circles on the ground show where it can go. Tap the blinking one. Careful: walking costs an action; even that has a price here.",
    "mission": "Move the unit to the marked spot.",
    "ok": "It walks! A miracle of organic engineering. Barely tripped."
   }
  },
  {
   "say": "Ese arbusto es un escondite: dentro, el rival no te ve. Pero si alguien entra donde ya hay otro escondido, se lleva un golpe y pierde sus acciones.",
   "mission": "Escóndete en el arbusto",
   "ok": "Invisible. Como mi cuenta bancaria.",
   "mood": "normal",
   "en": {
    "say": "That bush is a hideout: inside, enemies can't see you. But if someone walks into an occupied bush, they take a hit and lose their actions.",
    "mission": "Hide in the bush",
    "ok": "Invisible. Like my bank account."
   }
  },
  {
   "say": "Ese gnomo que tiembla como un flan es Tinkle, mi primo. Aquí lo llamamos «balón». Pulsa la manita para cogerlo; tu unidad irá sola hasta él.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, perdóname. Eras tú o yo.",
   "mood": "grunon",
   "en": {
    "say": "That gnome shaking like jelly is Tinkle, my cousin. Here we call him \"the ball\". Tap the hand to grab him; your unit walks over by itself.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, forgive me. It was you or me."
   }
  },
  {
   "say": "Lo MÁS ingenioso: ¡golpéalo! Cada golpe suma puntos, y esos puntos serán el daño de tu «estampada». Suena a locura. Lo es.",
   "mission": "Golpea al gnomo (icono del puño)",
   "ok": "¡Puntos! Tinkle siempre encajó bien los golpes. El tío Klink mejor, pero ya es un recuerdo disperso sobre el césped.",
   "mood": "grunon",
   "en": {
    "say": "The cleverest part: hit him! Each hit adds points, and those points become the damage of your \"slam\". Sounds insane. It is.",
    "mission": "Hit the gnome (fist icon)",
    "ok": "Points! Tinkle always took hits well. Uncle Klink took them better, but now he's a scattered memory on the lawn."
   }
  },
  {
   "say": "Pasarse el balón también da puntos, por si duelen los nudillos. Pulsa lanzar y elige a tu aliado. Quien lanza gasta acción; quien recibe, no.",
   "mission": "Lánzale el gnomo a otra unidad.",
   "ok": "¡Buen pase! Tinkle, ¿todo bien? Te veo mareado.",
   "mood": "normal",
   "en": {
    "say": "Passing the ball also scores, in case your knuckles hurt. Tap throw and pick your ally. The thrower spends an action; the catcher doesn't.",
    "mission": "Throw the gnome to another unit.",
    "ok": "Nice pass! Tinkle, all good? You look dizzy."
   }
  },
  {
   "say": "Quien carga al gnomo no puede atacar: que el de las manos libres se ocupe del enemigo. Tranquilo, no devuelve el golpe; lo han programado así.",
   "mission": "Ataca al enemigo",
   "ok": "Ahora le duele algo, y mañana también.",
   "mood": "normal",
   "en": {
    "say": "Whoever carries the gnome can't attack, so let the free unit handle the enemy. Relax, it won't hit back; it's programmed that way.",
    "mission": "Attack the enemy",
    "ok": "Now something hurts, and tomorrow too."
   }
  },
  {
   "say": "Ese pino, las rocas y la mena de hierro también se golpean. Sueltan recursos que vuelan a tu mochila. Tala el pino.",
   "mission": "Tala el pino (2 golpes)",
   "ok": "¡Madera! Úsala en la armería de tu obelisco para mejorar el equipo.",
   "mood": "normal",
   "en": {
    "say": "That pine, the rocks and the iron ore can be hit too. They drop resources that fly into your backpack. Chop the pine.",
    "mission": "Chop down the pine (2 hits)",
    "ok": "Wood! Spend it at your obelisk's armory to upgrade gear."
   }
  },
  {
   "say": "¿Ves ese cofre? En las partidas de verdad hay varios. Escondes reliquias con ventajas, pero se desgastan cuando mueren tus unidades. Ábrelo.",
   "mission": "Abre el cofre de reliquias",
   "ok": "Botas TrotaMontes: más Movimiento. Fíjate en su durabilidad: cuida a tus unidades. Y no, no guardo el ticket.",
   "mood": "normal",
   "en": {
    "say": "See that chest? Real matches have several. They hold relics with perks, but they wear down when your units die. Open it.",
    "mission": "Open the relic chest",
    "ok": "TrotaMontes Boots: more Movement. Mind the durability: take care of your units. And no, I kept no receipt."
   }
  },
  {
   "say": "Lo mejor: conquistar un tótem con un gnomo cargado de puntos. Lo estampas y le quitas tanta vida como puntos lleve. Si se queda sin vida, es tuyo y te da Gloria cada turno. Pulsa la diana.",
   "mission": "Haz una “estampada” con el gnomo contra el tótem",
   "ok": "¡Tótem conquistado! ¿Alguien llama a emergencias por Tinkle? Truco: empezar el turno pegado a un tótem tuyo recarga la habilidad especial.",
   "mood": "grunon",
   "en": {
    "say": "The best part: conquer a totem with a point-loaded gnome. Slam him in and the totem loses as much life as he carries. At zero it's yours and pays Glory every turn. Tap the target.",
    "mission": "Slam the gnome into the totem",
    "ok": "Totem conquered! Can someone call an ambulance for Tinkle? Tip: starting your turn next to your own totem recharges the special ability."
   }
  },
  {
   "say": "Último truco, y de los buenos: el SACRIFICIO. Lanza al gnomo contra el agua, un volcán, un cepo… (verás una calavera) y ganas +3 de Gloria al instante. Más si llevaba puntos: 4 con 5+, 5 con 10+. Cuesta coger y lanzar, y luego aparece otro gnomo. Ese charco lo he puesto yo, de nada.",
   "mission": "Sacrifica al gnomo en el agua",
   "ok": "+3 de Gloria al instante. Tinkle dio su vida por la causa, aunque nadie le preguntó. El siguiente gnomo ya viene de camino.",
   "mood": "aplaude",
   "en": {
    "say": "One last trick, a good one: SACRIFICE. Throw the gnome into water, a volcano, a trap… (you'll see a skull) and gain +3 Glory instantly. More if it carried points: 4 with 5+, 5 with 10+. It costs grab and throw, then another gnome shows up. I made that puddle myself, you're welcome.",
    "mission": "Sacrifice the gnome in the water",
    "ok": "+3 Glory, instantly. Tinkle gave his life for the cause, though nobody asked him. The next gnome is already on its way."
   }
  },
  {
   "say": "Tu Obelisco guarda más trucos: abre Habilidades, mejoras permanentes que se compran con Gloria. Mírala y ciérrala.",
   "mission": "Abre Habilidades y ciérrala",
   "ok": "Demasiado árbol para tan poco bosque.",
   "mood": "normal",
   "en": {
    "say": "Your Obelisk has more tricks: open Skills, permanent upgrades bought with Glory. Take a look and close it.",
    "mission": "Open Skills and close it",
    "ok": "Too much tree for so little forest."
   }
  },
  {
   "say": "Y la Armería: aquí gastas madera, roca y metal en mejorar Arma y Armadura de todos. Ábrela y ciérrala.",
   "mission": "Abre la Armería y ciérrala",
   "ok": "Ya sabes dónde gastar los restos de la deforestación.",
   "mood": "normal",
   "en": {
    "say": "And the Armory: spend wood, rock and metal to upgrade everyone's Weapon and Armor. Open it and close it.",
    "mission": "Open the Armory and close it",
    "ok": "Now you know where to spend the leftovers of deforestation."
   }
  },
  {
   "say": "Sin acciones (o sin ganas), pulsa PASAR TURNO. Juega el rival y vuelves tú. Como la vida: esperas, esperas y estampas un gnomo.",
   "mission": "Pulsa PASAR TURNO",
   "ok": "El rival no hizo nada. Es un tutorial.",
   "mood": "grunon",
   "en": {
    "say": "Out of actions (or patience)? Hit END TURN. The rival plays, then you again. Like life: wait, wait, slam a gnome.",
    "mission": "Tap END TURN",
    "ok": "The rival did nothing. It's a tutorial."
   }
  },
  {
   "say": "¡Lo conseguiste! Ya sabes reclutar, mover, esconderte, lanzar, estampar, talar, abrir cofres y conquistar. Oficialmente, eres un asesino de gnomos… y a mí me parte el lomo. Si un gnomo te mira raro, ya conoce tus intenciones.",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "You did it! You can recruit, move, hide, throw, slam, chop, open chests and conquer. Officially, you're a gnome killer… and it breaks my back. If a gnome looks at you funny, he knows your plans.",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "mush": [
  {
   "say": "Bienvenido al Bosque MushBoom, antes «de la Paz y la Armonía». Cambió de nombre cuando alguien descubrió que las setas explotan. Desde entonces, menos turistas. Y menos gnomos.",
   "button": "Qué simpático",
   "mood": "grunon",
   "en": {
    "say": "Welcome to MushBoom Forest, formerly \"Peace and Harmony Forest\". Renamed the day someone found out the mushrooms explode. Fewer tourists since. Fewer gnomes too.",
    "button": "How charming"
   }
  },
  {
   "say": "Precioso, si te gusta el humo y el gnomo a la brasa. A veces tiembla la tierra: es un gigante hambriento bajo un altar. Hoy: setas explosivas, Altar de Sacrificios y GnomOgro.",
   "button": "Estoy deseando",
   "mood": "normal",
   "en": {
    "say": "Lovely, if you like smoke and grilled gnome. Sometimes the ground shakes: a hungry giant under an altar. Today: explosive mushrooms, the Sacrifice Altar and the GnomOgre.",
    "button": "Can't wait"
   }
  },
  {
   "say": "Las setas explosivas se cogen con la manita (sin gastar acción). Con una encima empieza una cuenta atrás y, al llegar a 0, explota con todo lo de alrededor. Te dejé una cerca. ¡Cógela!",
   "mission": "Coge la seta explosiva",
   "ok": "Fíjate en el número: turnos hasta que estalle. Sí, la cogiste tú. Yo no me hago responsable.",
   "mood": "normal",
   "en": {
    "say": "Explosive mushrooms are grabbed with the hand (no action spent). Carry one and a countdown starts; at 0 it blows up with everything around. I left one nearby. Grab it!",
    "mission": "Pick up the explosive mushroom",
    "ok": "See the number: turns until it blows. Yes, you grabbed it. Not my responsibility."
   }
  },
  {
   "say": "El número baja cuando TÚ terminas el turno. A 0, adiós seta y portador. Pasa turno y compruébalo: aún hay margen.",
   "mission": "Pasa turno y mira la cuenta atrás",
   "ok": "Un turno menos. Ya deberías pensar cómo librarte de ella.",
   "mood": "grunon",
   "en": {
    "say": "The number drops whenever YOU end your turn. At 0, goodbye mushroom and carrier. End turn and see: there's still time.",
    "mission": "End turn and watch the countdown",
    "ok": "One turn less. You should be thinking how to get rid of it."
   }
  },
  {
   "say": "Ese altar siempre tiene hambre: su barra se llena con ofrendas. Una seta explosiva le da puntos y se desactiva sin explotar. Acaba junto al altar o pulsa su diana.",
   "mission": "Ofrece la seta al altar",
   "ok": "Puntos para el altar y cero heridos. El trato más justo del bosque.",
   "mood": "normal",
   "en": {
    "say": "That altar is always hungry: its bar fills with offerings. An explosive mushroom gives it points and gets defused. End next to it or tap its target.",
    "mission": "Offer the mushroom to the altar",
    "ok": "Points for the altar and zero casualties. Fairest deal in the forest."
   }
  },
  {
   "say": "El altar también come gnomos: estampa uno contra él y se llena con TODOS sus puntos. Tinkle, ven aquí… tranquilo, será rápido. Para ti. Coge a Tinkle.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, te quiero. Lo suficiente como para que sufras pronto.",
   "mood": "grunon",
   "en": {
    "say": "The altar eats gnomes too: slam one into it and it fills with ALL his points. Tinkle, come here… relax, it'll be quick. For you. Grab Tinkle.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, I love you. Enough to make you suffer soon."
   }
  },
  {
   "say": "Tinkle trae puntos de sobra; no preguntes cómo. Con los de la seta, el altar queda lleno. Selecciona a tu unidad y pulsa la diana del altar.",
   "mission": "Estampa a Tinkle contra el altar",
   "ok": "¡Altar lleno! Se oye un crujido. Corre. Bueno, corre tú: yo soy mayor.",
   "mood": "normal",
   "en": {
    "say": "Tinkle brings plenty of points; don't ask how. With the mushroom's, the altar fills up. Select your unit and tap the altar's target.",
    "mission": "Smash Tinkle against the altar",
    "ok": "Altar full! Hear that crack? Run. Well, you run: I'm old."
   }
  },
  {
   "say": "Ese es el GnomOgro: un gigante a su aire, del bando de quien llenó el altar. Cada turno avanza hacia el Obelisco rival y mata de un golpe a quien tenga al lado. Si llega a la base, la destruye y se acaba la partida. Pasa turno.",
   "mission": "Pasa turno y mira al GnomOgro",
   "ok": "Un paso más cerca de la victoria. Da gusto verlo, mientras no vaya a por ti.",
   "mood": "grunon",
   "en": {
    "say": "That's the GnomOgre: a giant doing his own thing, on the side of whoever filled the altar. Each turn he marches toward the enemy Obelisk and one-shots anyone beside him. If he reaches the base, he destroys it and the match ends. End turn.",
    "mission": "End turn and watch the GnomOgre",
    "ok": "One step closer to victory. Lovely to watch, as long as he's not coming for you."
   }
  },
  {
   "say": "Resumen: coge setas pero no te las quedes, llena el altar con setas y gnomos, y deja que el GnomOgro haga el trabajo sucio. Si el rival llena el altar, ataca al gigante o llénalo tú antes. ¡Suerte, la vas a necesitar!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "Recap: grab mushrooms but don't keep them, fill the altar with mushrooms and gnomes, and let the GnomOgre do the dirty work. If the rival fills it, attack the giant or fill it first. Good luck, you'll need it!",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "rock": [
  {
   "say": "Colinas Rock'n Troll. Unos trols dieron aquí un concierto tan ruidoso que las colinas aún tiemblan. Se quedaron para los coros. Nadie les dice que ya no cantan bien.",
   "button": "Qué ambiente",
   "mood": "grunon",
   "en": {
    "say": "Rock'n Troll Hills. Some trolls played a concert so loud here that the hills still shake. They stayed for backing vocals. Nobody tells them they can't sing anymore.",
    "button": "What a vibe"
   }
  },
  {
   "say": "Aquí hay tambores, rocas que caen del cielo y un volcán harto del ruido. Hoy: Tambores de Guerra, Fragmentos y Volcán.",
   "button": "A por ellos",
   "mood": "normal",
   "en": {
    "say": "Here you'll find drums, rocks falling from the sky and a volcano sick of the noise. Today: War Drums, Shards and the Volcano.",
    "button": "Let's go"
   }
  },
  {
   "say": "Tambores de Guerra: si tienes MÁS unidades pegadas a un tambor que nadie, al acabar el turno llenas una porción de tu ruleta. Ruleta llena, ¡llueven rocas sobre tus rivales! Acerca tu unidad.",
   "mission": "Acerca tu unidad al tambor",
   "ok": "Bien pegadito. Si viene un colega rival, empate y nadie puntúa. Como en las reuniones familiares.",
   "mood": "normal",
   "en": {
    "say": "War Drums: if you have MORE units next to a drum than anyone else, you fill a slice of your wheel at end of turn. Full wheel, and rocks rain on your rivals! Move your unit close.",
    "mission": "Bring your unit next to the drum",
    "ok": "Nice and close. If a rival joins, it's a tie and nobody scores. Like family gatherings."
   }
  },
  {
   "say": "Truco: cada golpe a un gnomo junto a un tambor suma una porción extra. Tinkle viene con su ilusión de siempre. Cógelo.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, hoy de baquetas. Mejor no explicar.",
   "mood": "grunon",
   "en": {
    "say": "Trick: every hit on a gnome next to a drum adds an extra slice. Tinkle comes with his usual enthusiasm. Grab him.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, drumsticks duty today. Better not explain."
   }
  },
  {
   "say": "Golpéalo con el puño sin separarte del tambor. Cada golpe deja una porción pendiente para el final de tu turno.",
   "mission": "Golpea a Tinkle junto al tambor",
   "ok": "¡Rum-pum-pum! Qué talento desaprovechado.",
   "mood": "normal",
   "en": {
    "say": "Hit him with the fist without leaving the drum. Each hit queues a slice for the end of your turn.",
    "mission": "Hit Tinkle next to the drum",
    "ok": "Rum-pum-pum! Such wasted talent."
   }
  },
  {
   "say": "Te dejé la ruleta casi llena: al acabar el turno se completa. También puse un rival cerquita para el espectáculo. Pasa turno.",
   "mission": "Pasa turno y mira la lluvia de rocas",
   "ok": "¡Lluvia de rocas! Cada una pega más fuerte. Y los tambores, avergonzados, se mudaron.",
   "mood": "normal",
   "en": {
    "say": "I left your wheel almost full: it completes at end of turn. I also put a rival nearby for the show. End turn.",
    "mission": "End turn and watch the rock rain",
    "ok": "Rock rain! Each one hits harder. And the drums, embarrassed, moved away."
   }
  },
  {
   "say": "Cada roca se rompe y suelta Fragmentos. Se recogen al pisarlos y van a tu mochila. Cualquiera puede cogerlos: date prisa. Pisa uno.",
   "mission": "Recoge un fragmento",
   "ok": "Una piedra en la mochila. Como tu carrera, pero más útil.",
   "mood": "normal",
   "en": {
    "say": "Each rock breaks and drops Shards. Step on them to pick them up into your backpack. Anyone can take them: hurry. Step on one.",
    "mission": "Pick up a fragment",
    "ok": "A stone in the backpack. Like your career, but more useful."
   }
  },
  {
   "say": "Las piedras sirven para alimentar al volcán, apagar lava y quitar un gnomo en llamas; NUNCA contra rivales. Abre la mochila, pulsa el fragmento dos veces y apunta al volcán.",
   "mission": "Lanza el fragmento al volcán",
   "ok": "El volcán se enciende. Cuanto más lo alimentes, más cerca de erupcionar. No pongas esa cara de interés.",
   "mood": "grunon",
   "en": {
    "say": "Stones feed the volcano, put out lava and remove a burning gnome; NEVER against rivals. Open the backpack, tap the shard twice and aim at the volcano.",
    "mission": "Throw the fragment at the volcano",
    "ok": "The volcano lights up. The more you feed it, the closer to erupting. Stop looking so interested."
   }
  },
  {
   "say": "El volcán también come gnomos, estampados o lanzados. Al llenarse entra en erupción: un gnomo en llamas se agarra a cada unidad rival y explota al acabar tu turno. Tinkle ya trae puntos. Estámpalo.",
   "mission": "Estampa a Tinkle contra el volcán",
   "ok": "¡Erupción! Mira correr al gnomo en llamas. La vida del rival es dura.",
   "mood": "normal",
   "en": {
    "say": "The volcano eats gnomes too, slammed or thrown. When full it erupts: a burning gnome latches onto each rival unit and explodes at end of your turn. Tinkle already has points. Slam him.",
    "mission": "Smash Tinkle against the volcano",
    "ok": "Eruption! Watch that burning gnome run. A rival's life is hard."
   }
  },
  {
   "say": "Pasa turno: el gnomo estalla y deja lava que hiere a quien la pise. Una piedra apaga una casilla o libra a tu unidad del gnomo en llamas.",
   "mission": "Pasa turno y mira la explosión",
   "ok": "Lava por todas partes. Hogar, dulce hogar… de los trols.",
   "mood": "grunon",
   "en": {
    "say": "End turn: the gnome blows up and leaves lava that hurts whoever steps on it. A stone puts out a tile or frees your unit from the burning gnome.",
    "mission": "End turn and watch the explosion",
    "ok": "Lava everywhere. Home sweet home… for trolls."
   }
  },
  {
   "say": "Resumen: pega gnomos junto a los tambores para que llueva roca, recoge fragmentos antes que el rival y úsalos con cabeza. Cuando alguien llene el volcán: o corres, o te agarras a una piedra. ¡Suerte!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "Recap: hit gnomes by the drums to rain rocks, grab shards before the rival and use them wisely. When someone fills the volcano: run, or grab a stone. Good luck!",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "crane": [
  {
   "say": "Poblado HurryCrane: un pueblo en las nubes que espera a que eclosione un huevo de grulla gigante. Los vecinos ya apostaron qué saldrá… y a quién le tocará limpiar el nido.",
   "button": "Qué emoción",
   "mood": "grunon",
   "en": {
    "say": "HurryCrane Village: a cloud town waiting for a giant crane egg to hatch. The neighbors already bet on what comes out… and who cleans the nest.",
    "button": "How exciting"
   }
  },
  {
   "say": "Aquí no hay setas ni volcanes: hay un huevo con mala leche y bumpers. Jugamos al pinball: el huevo es la bola, los gnomos la fuerza motriz. Cada rebote lo CARGA (el destello cambia de color y suena más agudo). Mantén pulsado el huevo para ver rebotes y carga.",
   "button": "A jugar",
   "mood": "normal",
   "en": {
    "say": "No mushrooms or volcanoes here: an ill-tempered egg and bumpers. It's pinball: the egg is the ball, gnomes are the flipper. Each bounce CHARGES it (the glow changes color and the sound rises). Hold the egg to see bounces and charge.",
    "button": "Let's play"
   }
  },
  {
   "say": "Al huevo se le da con un gnomo, y adivina quién es el gnomo. Cógelo.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, hoy vuelas. No preguntes dónde aterrizas.",
   "mood": "normal",
   "en": {
    "say": "You hit the egg with a gnome, and guess who the gnome is. Grab him.",
    "mission": "Pick up Tinkle",
    "ok": "Tinkle, you fly today. Don't ask where you land."
   }
  },
  {
   "say": "Pulsa lanzar y apunta al huevo: alguna flecha se ayuda sola hacia un bumper cercano. El gnomo empuja el huevo en la dirección elegida. Con mando, usa la cruceta.",
   "mission": "Lánzale a Tinkle contra el huevo",
   "ok": "¡Zas! Tinkle se levanta y se va corriendo. Todo un profesional.",
   "mood": "normal",
   "en": {
    "say": "Tap throw and aim at the egg: some arrows auto-assist toward a nearby bumper. The gnome pushes the egg the way you pick. With a gamepad, use the d-pad.",
    "mission": "Throw Tinkle at the egg",
    "ok": "Zap! Tinkle gets up and runs off. A true professional."
   }
  },
  {
   "say": "Ahora, los bumpers: el huevo salta entre los cercanos con el camino despejado (sin niebla), pero cada bumper rebota UNA vez por turno. Cada rebote lo carga un nivel. Te puse dos: lanza otro gnomo y mira la carambola.",
   "mission": "Lanza otro gnomo y provoca una carambola",
   "ok": "¡Carambola! Cada golpe más agudo. Como una discoteca, pero con daño.",
   "mood": "grunon",
   "en": {
    "say": "Now the bumpers: the egg hops between nearby ones with a clear path (no fog), but each bumper bounces ONCE per turn. Every bounce adds a charge level. I placed two: throw another gnome and watch the chain.",
    "mission": "Throw another gnome and cause a carom",
    "ok": "Carom! Each hit higher-pitched. Like a nightclub, but with damage."
   }
  },
  {
   "say": "Obeliscos y tótems también lo rebotan, pero ellos pagan: el golpe quita vida según la carga. Y cada turno sin rebotar la enfría: no lo dejes. Con carga alta tiembla y se pone rojo.",
   "button": "Entendido",
   "mood": "normal",
   "en": {
    "say": "Obelisks and totems bounce it too, but they pay: the hit costs life depending on charge. And each turn without bouncing cools it: don't let it. At high charge it shakes and turns red.",
    "button": "Got it"
   }
  },
  {
   "say": "Rebotado al máximo, EXPLOTA: cada equipo cobra Gloria según sus rebotes, con lluvia de monedas y estrellas de premio. Lo dejé casi al máximo. Lanza el último gnomo y que sea lo que Dios quiera.",
   "mission": "Haz estallar el huevo",
   "ok": "¡BOOM! Plumas, luces… y mira quién viene a poner orden.",
   "mood": "grunon",
   "en": {
    "say": "Bounce it at max charge and it EXPLODES: each team earns Glory by its bounces, with a coin shower and bonus stars. I left it nearly maxed. Throw the last gnome and let fate decide.",
    "mission": "Make the egg explode",
    "ok": "BOOM! Feathers, lights… and look who's coming to restore order."
   }
  },
  {
   "say": "La grulla equilibra la partida: se posa en el obelisco que más ganó con el huevo y se queda dos turnos de su dueño. Ese obelisco no puede reclutar, mejorar ni forjar. Si quedas último, te toca a ti. Se vuelve transparente si te tapa.",
   "button": "Vaya con la grulla",
   "mood": "normal",
   "en": {
    "say": "The crane balances the match: she lands on the obelisk that earned most from the egg and stays two of its owner's turns. That obelisk can't recruit, upgrade or forge. If you finish last, it's your turn. She turns transparent if she blocks your view.",
    "button": "Wow, the crane"
   }
  },
  {
   "say": "¿Obelisco bloqueado? Lánzale un gnomo a la grulla: se asusta y vuela al siguiente obelisco, hasta visitarlos todos. Luego se va y el huevo renace en el centro. Dale un gnomazo.",
   "mission": "Espanta a la grulla con un gnomo",
   "ok": "¡Plumas por todas partes! Dos turnos en cada obelisco, salvo susto.",
   "mood": "grunon",
   "en": {
    "say": "Obelisk blocked? Throw a gnome at the crane: she gets scared and flies to the next obelisk, until she's visited them all. Then she leaves and the egg is reborn in the center. Give her a gnome-smack.",
    "mission": "Scare the crane away with a gnome",
    "ok": "Feathers everywhere! Two turns per obelisk, unless someone scares her."
   }
  },
  {
   "say": "Resumen: cada rebote carga el huevo; obeliscos y tótems pagan el golpe; al máximo explota; la grulla se posa donde más se ganó y bloquea ese obelisco. ¡Suerte!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "Recap: each bounce charges the egg; obelisks and totems pay for the hit; at max it explodes; the crane lands where most was earned and blocks that obelisk. Good luck!",
    "button": "FINISH TUTORIAL"
   }
  }
 ]
};
