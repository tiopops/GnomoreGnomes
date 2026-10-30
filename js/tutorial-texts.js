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
   "say": "Soy Nizak, tu pelota oficial. Te enseño lo básico en un momento… ya que vas a aplastarme, al menos hazlo con elegancia.",
   "button": "Vale, viejales",
   "mood": "grunon",
   "en": {
    "say": "I'm Nizak, your official ball. I'll teach you the basics in a minute… since you're going to squash me anyway, at least do it with style.",
    "button": "Fine, old-timer"
   }
  },
  {
   "say": "Esa roca mugrienta de tres metros es tu Obelisco: hogar, fábrica de reclutas y retrete. Púlsalo sin miedo. No muerde (nosotros sí).",
   "mission": "Pulsa tu Obelisco",
   "ok": "Has tocado una piedra. Han dado diplomas por menos…",
   "mood": "normal",
   "en": {
    "say": "That filthy ten-foot rock is your Obelisk: home, recruit factory and toilet. Tap it without fear. It doesn't bite (we do).",
    "mission": "Tap your Obelisk",
    "ok": "You touched a rock. People have been handed diplomas for less…"
   }
  },
  {
   "say": "Ahora elige el icono de Reclutar, el primero de la izquierda.",
   "mission": "Pulsa el icono de Reclutar",
   "ok": "Ya estás en la sala de entrenamiento. Íbamos a traer a los mejores guerreros, pero el presupuesto no dio para más.",
   "mood": "normal",
   "en": {
    "say": "Now pick the Recruit icon, the first one on the left.",
    "mission": "Tap the Recruit icon",
    "ok": "Welcome to the training room. We were going to bring in the best warriors, but the budget didn't stretch any further."
   }
  },
  {
   "say": "Elige a TruenoEspora, el de la seta en la cabeza. Sus servicios se pagan con puntos de Gloria: ese numerito amarillo de arriba.",
   "mission": "Elige a TruenoEspora",
   "ok": "Qué sonrisa. Eso es que ya sabe a lo que ha venido.",
   "mood": "normal",
   "en": {
    "say": "Pick ThunderSpore, the one with the mushroom on his head. His services are paid for with Glory points: that little yellow number at the top.",
    "mission": "Pick ThunderSpore",
    "ok": "What a smile. He clearly knows what he's here for."
   }
  },
  {
   "say": "Pulsa RECLUTAR, necesitamos soldados para lo que vamos a hacer.",
   "mission": "Pulsa RECLUTAR",
   "ok": "Otro pobre diablo que firma sin leer la letra pequeña…",
   "mood": "grunon",
   "en": {
    "say": "Tap RECRUIT: we need soldiers for what we're about to do.",
    "mission": "Tap RECRUIT",
    "ok": "Another poor devil signing without reading the fine print…"
   }
  },
  {
   "say": "Las casillas marcadas son los sitios libres junto al Obelisco donde puedes desplegar las unidades. Elige una.",
   "mission": "Elige una casilla para colocarlo",
   "ok": "¡Un compañero leal! Veremos cuánto le dura la lealtad cuando empiece a salpicar la sangre.",
   "mood": "normal",
   "en": {
    "say": "The highlighted tiles are the free spots next to the Obelisk where you can deploy your units. Pick one.",
    "mission": "Pick a tile to place it",
    "ok": "A loyal companion! Let's see how long that loyalty lasts once the blood starts splashing."
   }
  },
  {
   "say": "Mantén pulsada su cara (abajo a la izquierda) para ver sus estadísticas. Con los enemigos funciona igual.",
   "mission": "Mantén pulsada su cara",
   "ok": "Su vida, su fuerza, su habilidad… información de oro, y gratis.",
   "mood": "normal",
   "en": {
    "say": "Hold its face (bottom left) to see its stats. It works the same on enemies.",
    "mission": "Hold its face",
    "ok": "Its health, its strength, its ability… pure gold information, and free."
   }
  },
  {
   "say": "Recluta otra unidad igual: necesitaremos a alguien a quien lanzarle las cosas. Sí, hay gente que nos llama «cosas».",
   "mission": "Recluta una segunda unidad",
   "ok": "Dos pardillos son mejor que uno. Así los remordimientos se reparten.",
   "mood": "grunon",
   "en": {
    "say": "Recruit another one just like it: we'll need someone to throw things at. Yes, some people call us “things”.",
    "mission": "Recruit a second unit",
    "ok": "Two fools are better than one. That way the guilt gets shared."
   }
  },
  {
   "say": "Para dar órdenes a una unidad hay que seleccionarla: pulsa a uno de tus aliados. Con cariño, no le saques un ojo.",
   "mission": "Selecciona una unidad",
   "ok": "¡Eso es! Qué sensación de poder. No te acostumbres.",
   "mood": "normal",
   "en": {
    "say": "To give orders to a unit you have to select it first: tap one of your allies. Gently, don't poke an eye out.",
    "mission": "Select a unit",
    "ok": "That's it! What a feeling of power. Don't get used to it."
   }
  },
  {
   "say": "Pulsa el círculo que parpadea para que se mueva hasta allí. Cada movimiento gasta una acción.",
   "mission": "Mueve la unidad hasta la zona marcada",
   "ok": "¡Camina! Un milagro de la ingeniería orgánica. ¡Y sin tropezarse! Bueno, casi.",
   "mood": "grunon",
   "en": {
    "say": "Tap the blinking circle to make it move there. Each move costs an action.",
    "mission": "Move the unit to the marked area",
    "ok": "It walks! A miracle of organic engineering. And without tripping! Well, almost."
   }
  },
  {
   "say": "Ese arbusto es un escondite perfecto para hacer emboscadas o acercarte a los gnomos sin que te vean. Entra en él.",
   "mission": "Escóndete en el arbusto",
   "ok": "Invisible. Como mi cuenta bancaria.",
   "mood": "normal",
   "en": {
    "say": "That bush is a perfect hideout for ambushes or for sneaking up on gnomes unseen. Step into it.",
    "mission": "Hide in the bush",
    "ok": "Invisible. Like my bank account."
   }
  },
  {
   "say": "Ese gnomo tembloroso es Tinkle, mi primo: el «balón». Pulsa la manita y tu unidad irá a por él.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, perdóname. Eras tú o yo.",
   "mood": "grunon",
   "en": {
    "say": "That trembling gnome is Tinkle, my cousin: the “ball”. Tap the little hand and your unit will go get him.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, forgive me. It was you or me."
   }
  },
  {
   "say": "¡Golpéalo! Cada golpe suma puntos al gnomo, y esos puntos aumentarán el daño de tu «estampada». Puedes consultar los puntos acumulados de un gnomo pulsando sobre él.",
   "mission": "Golpea al gnomo (icono del puño)",
   "ok": "¡Puntos! Tinkle encaja bien los golpes. El tío Klink encajaba mejor los nudillos… hasta que terminó esparcido por el césped.",
   "mood": "grunon",
   "en": {
    "say": "Hit him! Each hit adds points to the gnome, and those points will increase the damage of your “slam”. You can check a gnome's accumulated points by tapping on it.",
    "mission": "Hit the gnome (fist icon)",
    "ok": "Points! Tinkle takes a beating well. Uncle Klink took knuckles even better… until he ended up scattered across the grass."
   }
  },
  {
   "say": "Pásale el balón a tu aliado: pulsa lanzar y elígelo. También aumenta los puntos del gnomo.",
   "mission": "Lánzale el gnomo a otra unidad",
   "ok": "¡Buen pase! Tinkle, ¿todo bien? Te veo mareado.",
   "mood": "normal",
   "en": {
    "say": "Pass the ball to your ally: tap throw and pick them. That adds to the gnome's points too.",
    "mission": "Throw the gnome to another unit",
    "ok": "Nice pass! Tinkle, are you okay? You look dizzy."
   }
  },
  {
   "say": "Quien carga con el gnomo no puede atacar: usa a la unidad con las manos libres para atacar a ese enemigo.",
   "mission": "Ataca al enemigo",
   "ok": "Ahora le duele algo, y mañana seguro que también.",
   "mood": "normal",
   "en": {
    "say": "Whoever carries the gnome can't attack: use the unit with free hands to attack that enemy.",
    "mission": "Attack the enemy",
    "ok": "Now something hurts, and tomorrow it surely will too."
   }
  },
  {
   "say": "Pinos, rocas y menas también pueden recogerse y sueltan recursos. Tala ese pino.",
   "mission": "Tala el pino (2 golpes)",
   "ok": "¡Madera! Úsala en la Armería de tu Obelisco para mejorar el equipo de tus unidades.",
   "mood": "normal",
   "en": {
    "say": "Pines, rocks and ore can be gathered too, and they drop resources. Chop that pine.",
    "mission": "Chop down the pine (2 hits)",
    "ok": "Wood! Spend it at your Obelisk's Armory to upgrade your units' gear."
   }
  },
  {
   "say": "Ahora abre el cofre: guarda reliquias con ventajas que se desgastan si mueren tus unidades.",
   "mission": "Abre el cofre de reliquias",
   "ok": "Botas TrotaMontes: más Movimiento. Cuida su durabilidad, no conservo el ticket de compra.",
   "mood": "normal",
   "en": {
    "say": "Now open the chest: it holds relics with perks that wear down when your units die.",
    "mission": "Open the relic chest",
    "ok": "MountainTrotter Boots: more Movement. Mind their durability, I didn't keep the receipt."
   }
  },
  {
   "say": "Ahora vamos a conquistar un tótem: pulsa sobre él para reventar al gnomo cargado de puntos. Los tótems dan puntos de Gloria cada turno.",
   "mission": "Haz una “estampada” con el gnomo contra el tótem",
   "ok": "¡Tótem conquistado! ¿Alguien puede llamar a emergencias? Tinkle no tiene buena cara… espera, ¡Tinkle ya no tiene cara! Si empiezas el turno junto a un tótem conquistado, recargarás las habilidades de tus unidades.",
   "mood": "grunon",
   "en": {
    "say": "Now let's conquer a totem: tap it to slam the gnome loaded with points into it. Totems give Glory points every turn.",
    "mission": "Slam the gnome into the totem",
    "ok": "Totem conquered! Can somebody call an ambulance? Tinkle doesn't look well… wait, Tinkle doesn't have a face anymore! If you start your turn next to a conquered totem, your units' abilities will recharge."
   }
  },
  {
   "say": "Último truco: el SACRIFICIO. Lanza al gnomo al agua (verás una calavera en las zonas de sacrificio) y ganarás Gloria al instante.",
   "mission": "Sacrifica al gnomo en el agua",
   "ok": "No es lo más bonito que puedes hacer con un gnomo, pero recibes Gloria al instante. Tinkle dio su vida por la causa, aunque nadie le preguntó si quería unirse a ella.",
   "mood": "aplaude",
   "en": {
    "say": "Last trick: SACRIFICE. Throw the gnome into the water (you'll see a skull on the sacrifice zones) and you'll gain Glory instantly.",
    "mission": "Sacrifice the gnome in the water",
    "ok": "Not the prettiest thing you can do with a gnome, but you get Glory instantly. Tinkle gave his life for the cause, though nobody asked him if he wanted to join it."
   }
  },
  {
   "say": "Tu Obelisco guarda más trucos: las habilidades y mejoras para la partida se compran con Gloria. Abre Habilidades, échale un vistazo y ciérrala.",
   "mission": "Abre Habilidades y ciérrala",
   "ok": "Demasiado árbol de habilidades para tan poco bosque… no me hagas caso, es un chiste malo de gnomos.",
   "mood": "normal",
   "en": {
    "say": "Your Obelisk holds more tricks: skills and upgrades for the match, bought with Glory. Open Skills, take a look and close it.",
    "mission": "Open Skills and close it",
    "ok": "Too much skill tree for so little forest… ignore me, it's a bad gnome joke."
   }
  },
  {
   "say": "Y la Armería: aquí gastas madera, roca y metal en mejorar las armas y armaduras de todas tus unidades. Ábrela y ciérrala.",
   "mission": "Abre la Armería y ciérrala",
   "ok": "Ya sabes dónde gastar los restos de la deforestación.",
   "mood": "normal",
   "en": {
    "say": "And the Armory: here you spend wood, rock and metal to upgrade the weapons and armor of all your units. Open it and close it.",
    "mission": "Open the Armory and close it",
    "ok": "Now you know where to spend the leftovers of the deforestation."
   }
  },
  {
   "say": "Cuando no te queden acciones, pulsa PASAR TURNO. Cuando termine su turno el rival, volverás a jugar tú.",
   "mission": "Pulsa PASAR TURNO",
   "ok": "El rival no ha hecho nada. Era de esperar: esto es un tutorial.",
   "mood": "grunon",
   "en": {
    "say": "When you have no actions left, tap END TURN. When the rival finishes their turn, it's your turn again.",
    "mission": "Tap END TURN",
    "ok": "The rival did nothing. To be expected: this is a tutorial."
   }
  },
  {
   "say": "¡Lo has conseguido! Ya sabes reclutar, mover, esconderte, lanzar, estampar, talar y conquistar. Oficialmente, tienes todo lo necesario para ser un asesino de gnomos licenciado… espero no volver a verte.",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "You did it! You now know how to recruit, move, hide, throw, slam, chop and conquer. Officially, you have everything you need to be a licensed gnome killer… I hope I never see you again.",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "mush": [
  {
   "say": "Bosque MushBoom, antes llamado «El Bosque de la Paz y la Armonía». Cambió de nombre cuando alguien descubrió que las setas explotan. Ese alguien perdió una pierna...",
   "button": "Qué simpática historia",
   "mood": "grunon",
   "en": {
    "say": "MushBoom Forest, formerly known as “The Forest of Peace and Harmony”. It was renamed when someone discovered that the mushrooms explode. That someone lost a leg...",
    "button": "What a lovely story"
   }
  },
  {
   "say": "En el menú de Hoy: setas explosivas, el Altar de Sacrificios y el GnomOgro. Empecemos por las setas.",
   "button": "¿Y de postre?",
   "mood": "normal",
   "en": {
    "say": "On today's menu: explosive mushrooms, the Sacrifice Altar and the GnomOgre. Let's start with the mushrooms.",
    "button": "What about dessert?"
   }
  },
  {
   "say": "Coge la seta explosiva con la manita (no gasta acción). Cuando la cojas empezará una cuenta atrás.",
   "mission": "Coge la seta explosiva",
   "ok": "Fíjate en el número: son los turnos que restan hasta que estalle. Sí, la cogiste tú. Yo no me hago responsable y el seguro médico tampoco.",
   "mood": "normal",
   "en": {
    "say": "Grab the explosive mushroom with the little hand (it costs no action). Once you pick it up, a countdown starts.",
    "mission": "Pick up the explosive mushroom",
    "ok": "Mind the number: it's how many turns are left until it blows. Yes, you picked it up. I take no responsibility, and neither does the health insurance."
   }
  },
  {
   "say": "El número baja con cada turno; cuando llegue a cero, explota. ¿No me crees? Pulsa PASAR TURNO y míralo.",
   "mission": "Pasa turno y mira la cuenta atrás",
   "ok": "Un turno menos. Ya deberías pensar cómo librarte de ella o pedir hora en el traumatólogo.",
   "mood": "grunon",
   "en": {
    "say": "The number drops every turn; when it hits zero, it explodes. Don't believe me? Tap END TURN and watch.",
    "mission": "End turn and watch the countdown",
    "ok": "One turn less. You should start thinking about how to get rid of it, or book an appointment with the orthopedist."
   }
  },
  {
   "say": "Ofrécela al altar: acaba junto a él o pulsa su diana. La seta se desactiva y llena su barra de sacrificio.",
   "mission": "Ofrece la seta al altar",
   "ok": "Puntos para el altar y cero heridos. El trato más justo que encontrarás en este bosque.",
   "mood": "aplaude",
   "en": {
    "say": "Offer it to the altar: end your move next to it or tap its target. The mushroom is defused and fills the altar's sacrifice bar.",
    "mission": "Offer the mushroom to the altar",
    "ok": "Points for the altar and zero casualties. The fairest deal you'll find in this forest."
   }
  },
  {
   "say": "El altar también acepta gnomos como sacrificio, y se llena con todos sus puntos. Tinkle, ven… será rápido. Para ti. Cógelo.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, no te resistas, déjate llevar.",
   "mood": "grunon",
   "en": {
    "say": "The altar also accepts gnomes as a sacrifice, and fills up with all their points. Tinkle, come here… it'll be quick. For you, anyway. Grab him.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, don't resist, just let it happen."
   }
  },
  {
   "say": "Tinkle ya trae acumulados puntos de sobra. Selecciona a tu unidad y pulsa sobre el altar.",
   "mission": "Estampa a Tinkle contra el altar",
   "ok": "¡Altar de sacrificios lleno! Se oye un crujido. Corre. Bueno, corre tú, Tinkle ha perdido la capacidad de correr.",
   "mood": "normal",
   "en": {
    "say": "Tinkle already carries more than enough points. Select your unit and tap the altar.",
    "mission": "Smash Tinkle against the altar",
    "ok": "Sacrifice altar full! I hear a crack. Run. Well, you run: Tinkle has lost the ability to."
   }
  },
  {
   "say": "Este chicarrón es el GnomOgro: avanza solo hacia el Obelisco rival cada turno y mata de un golpe a quien tenga a su lado. Pulsa PASAR TURNO y míralo.",
   "mission": "Pasa turno y mira al GnomOgro",
   "ok": "Un paso más cerca de la victoria. Da gusto verlo, mientras no vaya a por ti, claro.",
   "mood": "grunon",
   "en": {
    "say": "This big fellow is the GnomOgre: it walks toward the rival Obelisk by itself every turn and kills anyone next to it in one hit. Tap END TURN and watch.",
    "mission": "End turn and watch the GnomOgre",
    "ok": "One step closer to victory. Lovely to watch, as long as it isn't coming for you, of course."
   }
  },
  {
   "say": "Resumen: coge setas, pero no te las quedes demasiado tiempo. Llena el altar de sacrificios con setas o gnomos y deja que el GnomOgro haga el trabajo sucio. ¡Suerte, la vas a necesitar!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "Recap: grab mushrooms, but don't hold on to them for too long. Fill the sacrifice altar with mushrooms or gnomes and let the GnomOgre do the dirty work. Good luck, you'll need it!",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "rock": [
  {
   "say": "Colinas Rock'n Troll. Unos trols dieron aquí un concierto tan ruidoso que las colinas aún tiemblan del recuerdo de aquel día.",
   "button": "Qué ambientazo",
   "mood": "grunon",
   "en": {
    "say": "Rock'n Troll Hills. Some trolls gave a concert here so loud that the hills still tremble at the memory of that day.",
    "button": "What an atmosphere"
   }
  },
  {
   "say": "En la lección de hoy: Tambores de Guerra, Fragmentos de piedra y el Volcán. Primero, los tambores.",
   "button": "A por ellos",
   "mood": "normal",
   "en": {
    "say": "In today's lesson: War Drums, Stone Fragments and the Volcano. Drums first.",
    "button": "Let's go"
   }
  },
  {
   "say": "Es sencillo, quien tenga más unidades pegadas a un tambor rellena el medidor de ruido al acabar el turno. Acerca tu unidad y verás.",
   "mission": "Acerca tu unidad al tambor",
   "ok": "Bien pegadito. Si empatas a unidades con el rival nadie puntuará. Así que asegúrate de invitar a tus amigos.",
   "mood": "normal",
   "en": {
    "say": "It's simple: whoever has the most units next to a drum fills their noise meter at the end of the turn. Move your unit closer and you'll see.",
    "mission": "Bring your unit next to the drum",
    "ok": "Nice and close. If you tie with the rival on units, nobody scores. So make sure you invite your friends."
   }
  },
  {
   "say": "Puedes golpear a un gnomo cerca del tambor para sumar puntos de ruido extra. Al final lo importante es hacer más ruido que los demás. Coge a Tinkle.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, hoy interpretas a unas baquetas. Mejor no dar más explicaciones.",
   "mood": "grunon",
   "en": {
    "say": "You can hit a gnome next to the drum to add extra noise points. In the end, what matters is making more noise than everyone else. Grab Tinkle.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, today you play the drumsticks. Better not to explain any further."
   }
  },
  {
   "say": "Golpéalo con el puño sin alejarte del tambor.",
   "mission": "Golpea a Tinkle junto al tambor",
   "ok": "¡Rum-pum-pum! Qué talento desaprovechado. ¡Rock'n Troll!",
   "mood": "aplaude",
   "en": {
    "say": "Hit him with the fist without leaving the drum.",
    "mission": "Hit Tinkle next to the drum",
    "ok": "Rum-pum-pum! Such wasted talent. Rock'n Troll!"
   }
  },
  {
   "say": "El medidor de ruido está casi lleno: al acabar el turno se completa y llueven rocas del cielo. Pulsa PASAR TURNO.",
   "mission": "Pasa turno y mira la lluvia de rocas",
   "ok": "¡Lluvia de rocas para tus enemigos! Y los tambores cambiarán de sitio: tendrás que volver a buscarlos por el mapa.",
   "mood": "normal",
   "en": {
    "say": "The noise meter is almost full: when your turn ends it fills up and rocks rain down from the sky. Tap END TURN.",
    "mission": "End turn and watch the rock rain",
    "ok": "Rocks raining down on your enemies! And the drums will move to another spot, so you'll have to look for them around the map again."
   }
  },
  {
   "say": "Las rocas sueltan Fragmentos. Pasa por encima de uno para recogerlo: cualquiera puede cogerlos, date prisa, ¡son gratis!",
   "mission": "Recoge un fragmento",
   "ok": "Una piedra en la mochila. Mejor en la mochila que dentro del zapato.",
   "mood": "normal",
   "en": {
    "say": "Rocks drop Fragments. Walk over one to pick it up: anyone can take them, so hurry, they're free!",
    "mission": "Pick up a fragment",
    "ok": "A stone in the backpack. Better in the backpack than in your shoe."
   }
  },
  {
   "say": "Puedes lanzar fragmentos al volcán para que entre en erupción. Abre la mochila, elige una piedra y apunta al volcán.",
   "mission": "Lanza el fragmento al volcán",
   "ok": "El volcán se enciende. Cuanto más lo alteres, antes entrará en erupción.",
   "mood": "grunon",
   "en": {
    "say": "You can throw fragments at the volcano to make it erupt. Open the backpack, pick a stone and aim at the volcano.",
    "mission": "Throw the fragment at the volcano",
    "ok": "The volcano lights up. The more you upset it, the sooner it will erupt."
   }
  },
  {
   "say": "Como era de esperar, el volcán también acepta gnomos como combustible. Estampa a Tinkle contra él y prepárate para unos fuegos artificiales.",
   "mission": "Estampa a Tinkle contra el volcán",
   "ok": "¡Erupción! Mira cómo corre ese gnomo envuelto en llamas. La vida de un gnomo es más dura de lo que crees.",
   "mood": "normal",
   "en": {
    "say": "As expected, the volcano also takes gnomes as fuel. Slam Tinkle into it and get ready for some fireworks.",
    "mission": "Smash Tinkle against the volcano",
    "ok": "Eruption! Look at that gnome running, wrapped in flames. A gnome's life is tougher than you think."
   }
  },
  {
   "say": "Puedes quitarte a los gnomos de encima tirándoles piedras. Ahora pulsa PASAR TURNO: verás cómo el gnomo en llamas explota y deja lava a su alrededor. Puedes apagar esos charcos lanzando piedras sobre ellos.",
   "mission": "Pasa turno y mira la explosión",
   "ok": "Lava por todas partes. Hogar, dulce hogar… de los trols.",
   "mood": "grunon",
   "en": {
    "say": "You can get rid of gnomes clinging to you by throwing stones at them. Now tap END TURN: you'll see the burning gnome explode and leave lava around it. You can put out those puddles by throwing stones on them.",
    "mission": "End turn and watch the explosion",
    "ok": "Lava everywhere. Home sweet home… for trolls."
   }
  },
  {
   "say": "Resumen del día: golpea a los gnomos junto a los tambores, recoge fragmentos de piedra y haz entrar el volcán en erupción antes que el rival. ¡Suerte! La cosa está calentita.",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "Daily recap: hit gnomes next to the drums, collect stone fragments and make the volcano erupt before the rival does. Good luck! Things are heating up.",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "crane": [
  {
   "say": "Bienvenido al poblado HurryCrane: un pueblo en las nubes que lleva años esperando a que eclosione un huevo de grulla gigante.",
   "button": "Qué emoción",
   "mood": "grunon",
   "en": {
    "say": "Welcome to HurryCrane Village: a town in the clouds that has spent years waiting for a giant crane egg to hatch.",
    "button": "How exciting"
   }
  },
  {
   "say": "Aquí se juega al pinball: el huevo es la bola y los gnomos no iban a ser menos. Cada rebote calienta el huevo. Mantén pulsado el huevo para ver cuantos puntos lleva acumulados.",
   "button": "A jugar",
   "mood": "normal",
   "en": {
    "say": "This is pinball: the egg is the ball, and the gnomes had to join in too. Each bounce heats the egg up. Hold the egg to see how many points it has stored.",
    "button": "Let's play"
   }
  },
  {
   "say": "Para hacer rebotar el huevo necesitaremos un gnomo. Coge a Tinkle.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, hoy vuelas. No preguntes dónde aterrizas.",
   "mood": "normal",
   "en": {
    "say": "To bounce the egg we'll need a gnome. Grab Tinkle.",
    "mission": "Pick up Tinkle",
    "ok": "Tinkle, you fly today. Don't ask where you land."
   }
  },
  {
   "say": "Pulsa lanzar y apunta al huevo: el gnomo lo empujará en esa dirección.",
   "mission": "Lánzale a Tinkle contra el huevo",
   "ok": "¡Zas! Tinkle se levanta y se va corriendo. Todo un profesional.",
   "mood": "normal",
   "en": {
    "say": "Tap throw and aim at the egg: the gnome pushes it that way.",
    "mission": "Throw Tinkle at the egg",
    "ok": "Zap! Tinkle gets up and runs off. A true professional."
   }
  },
  {
   "say": "Los bumpers hacen rebotar el huevo y se activan al ser golpeados. No puedes hacerlo rebotar contra el mismo bumper en el mismo turno. Lanza otro gnomo y mira la carambola.",
   "mission": "Lanza otro gnomo y provoca una carambola",
   "ok": "¡Carambola! Cada golpe calienta mas el huevo, no te pases, no queremos una tortilla.",
   "mood": "grunon",
   "en": {
    "say": "Bumpers make the egg bounce and light up when they're hit. You can't bounce it off the same bumper twice in the same turn. Throw another gnome and watch the carom.",
    "mission": "Throw another gnome and cause a carom",
    "ok": "Carom! Every hit heats the egg up more. Don't overdo it, we don't want an omelette."
   }
  },
  {
   "say": "Obeliscos y tótems también lo hacen rebotar, pero pierden vida según lo caliente que esté el huevo. Y cada turno sin rebotar, hace que se enfríe.",
   "button": "Entendido",
   "mood": "normal",
   "en": {
    "say": "Obelisks and totems bounce it too, but they lose health depending on how hot the egg is. And every turn without a bounce cools it down.",
    "button": "Got it"
   }
  },
  {
   "say": "Con la carga al máximo el huevo EXPLOTA y cada equipo recibe tantos puntos de Gloria como rebotes haya acumulado. Lanza el último gnomo.",
   "mission": "Haz estallar el huevo",
   "ok": "¡BOOM! Plumas, luces, trozos de cáscara… y mira quién viene a poner orden.",
   "mood": "grunon",
   "en": {
    "say": "At full charge the egg EXPLODES and each team receives as much Glory as bounces it has racked up. Throw the last gnome.",
    "mission": "Make the egg explode",
    "ok": "BOOM! Feathers, lights, eggshell chunks… and look who's coming to restore order."
   }
  },
  {
   "say": "La grulla se posa en el obelisco del jugador que más puntos de Gloria recibió y lo bloquea unos turnos: durante ese tiempo no puede reclutar ni mejorar.",
   "button": "Vaya con la grulla",
   "mood": "normal",
   "en": {
    "say": "The crane lands on the obelisk of the player who received the most Glory and blocks it for a few turns: during that time it can't recruit or upgrade.",
    "button": "Wow, the crane"
   }
  },
  {
   "say": "¿Obelisco bloqueado? Lánzale un gnomo a la grulla: se asustará y volará al siguiente obelisco. Al final lanzar un gnomo es la solución para todo en este juego.",
   "mission": "Espanta a la grulla con un gnomo",
   "ok": "¡Plumas por todas partes! Se posa dos turnos en cada obelisco, salvo que le lances un Gnomo, tenlo en cuenta.",
   "mood": "grunon",
   "en": {
    "say": "Obelisk blocked? Throw a gnome at the crane: it will get scared and fly to the next obelisk. In the end, throwing a gnome is the answer to everything in this game.",
    "mission": "Scare the crane away with a gnome",
    "ok": "Feathers everywhere! She perches for two turns on each obelisk, unless you throw a gnome at her. Keep that in mind."
   }
  },
  {
   "say": "Resumen: cada rebote carga el huevo, al máximo explota y la grulla equilibra la partida. ¡Suerte!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "Recap: every bounce charges the egg, at full charge it explodes and the crane keeps the match balanced. Good luck!",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "wall": [
  {
   "say": "Fortaleza WallForge. Una isla blindada de arriba abajo, habitada por gente tan obsesionada con proteger su gran Reliquia que hasta las paredes llevan armadura. Lo gracioso es que nadie sabe qué es.",
   "button": "Qué paranoia",
   "mood": "grunon",
   "en": {
    "say": "WallForge Fortress. An island armored from top to bottom, home to people so obsessed with protecting their great Relic that even the walls wear armor. The funny part is that nobody knows what it is.",
    "button": "How paranoid"
   }
  },
  {
   "say": "En el centro duerme la Reliquia, sellada con cadenas y vigilada por tres guardias paranoicos. A los guardias no se les pega: se les lanza un gnomo, y ya. Para variar, coge a Tinkle.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, hoy te toca ser munición. Otra vez.",
   "mood": "normal",
   "en": {
    "say": "At the centre sleeps the Relic, sealed with chains and watched by three paranoid guards. You don't hit the guards: you throw a gnome at them, and that's it. For a change, grab Tinkle.",
    "mission": "Pick up Tinkle",
    "ok": "Tinkle, today you're ammunition. Again."
   }
  },
  {
   "say": "Pulsa lanzar y apunta a un guardia. El gnomo lo deja mareado un buen rato y, de paso, se lleva puntos encima. Mareado, el guardia es una estatua blindada. Muy decorativa.",
   "mission": "Lánzale a Tinkle contra un guardia",
   "ok": "Mareado y sin dignidad. El guardia, digo. Tinkle hace tiempo que no tiene.",
   "mood": "normal",
   "en": {
    "say": "Press throw and aim at a guard. The gnome leaves it dizzy for a good while and picks up some points along the way. Dizzy, the guard is an armored statue. Very decorative.",
    "mission": "Throw Tinkle at a guard",
    "ok": "Dizzy and undignified. The guard, I mean. Tinkle lost his dignity ages ago."
   }
  },
  {
   "say": "Ahora la cámara sellada. Cada gnomo que le estampes rompe una cadena, y cuando no queden, suelta la Reliquia. Te presto los gnomos necesarios: Tinkle tiene muchos primos.",
   "mission": "Rompe las cadenas de la cámara",
   "ok": "Libre. Y por el estruendo, ya lo sabe toda la isla.",
   "mood": "grunon",
   "en": {
    "say": "Now the sealed chamber. Every gnome you smash into it breaks a chain, and when none are left, it releases the Relic. I'll lend you as many gnomes as needed: Tinkle has plenty of cousins.",
    "mission": "Break the chamber's chains",
    "ok": "Free. And judging by the racket, the whole island knows."
   }
  },
  {
   "say": "Ahí flota. Acércate y cógela: ahora eres el portador, y eso trae responsabilidades. Y enemigos. Muchos enemigos.",
   "mission": "Coge la Reliquia",
   "ok": "Es tuya. Mientras la lleves, claro.",
   "mood": "normal",
   "en": {
    "say": "There it floats. Walk over and grab it: you're the carrier now, and that comes with responsibilities. And enemies. Lots of enemies.",
    "mission": "Take the Relic",
    "ok": "It's yours. For as long as you carry it, of course."
   }
  },
  {
   "say": "Quien lleva la Reliquia deja ondas en los pies, y todos lo ven: a él y todo lo que él ve. Esconderse no vale. Los guardias van a por el portador, sea del equipo que sea, y si cae, la Reliquia queda en el suelo para quien la quiera. Los puntos se ganan pisando páginas: pisa esa de ahí.",
   "mission": "Pisa una página",
   "ok": "Puntos. Pocos, pero tuyos.",
   "mood": "grunon",
   "en": {
    "say": "Whoever carries the Relic leaves ripples at their feet, and everyone can see them, and everything they see. Hiding doesn't work. The guards go after the carrier, whatever their team, and if the carrier falls, the Relic lies on the ground for whoever wants it. Points come from stepping on pages: step on that one.",
    "mission": "Step on a page",
    "ok": "Points. Few, but yours."
   }
  },
  {
   "say": "Y si te sobra un gnomo: lánzalo contra una página y se convierte en ceniza, con página y todo. Suma puntos al portador de tu equipo y se los resta al del rival. Humor negro con propósito, mi especialidad.",
   "mission": "Convierte a Tinkle en ceniza",
   "ok": "Ceniza al viento. Tinkle siempre quiso volar.",
   "mood": "normal",
   "en": {
    "say": "And if you have a spare gnome: throw it at a page and it turns to ash, page and all. It adds points to your team's carrier and takes them from the rival's. Black humour with a purpose, my specialty.",
    "mission": "Turn Tinkle to ash",
    "ok": "Ash on the wind. Tinkle always wanted to fly."
   }
  },
  {
   "say": "Para cobrar, llévala junto a tu obelisco: se te abonan todos los puntos y tu rival pierde los mismos. La Reliquia vuelve a su cámara, que se resella, y vuelta a empezar.",
   "mission": "Entrega la Reliquia en tu obelisco",
   "ok": "¡Cobrado! Y el rival, un poco más pobre.",
   "mood": "grunon",
   "en": {
    "say": "To cash in, bring it next to your obelisk: all your points are credited and your rival loses the same. The Relic returns to its chamber, which reseals, and it all starts over.",
    "mission": "Deliver the Relic to your obelisk",
    "ok": "Cashed in! And the rival, a little poorer."
   }
  },
  {
   "say": "Y eso es todo de la Fortaleza WallForge. Resumen: marea guardias con gnomos, rompe las cadenas, coge la Reliquia, pisa páginas, sacrifica gnomos para sumar o restar, y cobra junto a tu obelisco. ¡Suerte, la vas a necesitar!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "And that's all for WallForge Fortress. Recap: stun guards with gnomes, break the chains, take the Relic, step on pages, sacrifice gnomes to add or subtract, and cash in next to your obelisk. Good luck, you'll need it!",
    "button": "FINISH TUTORIAL"
   }
  }
 ]
};
