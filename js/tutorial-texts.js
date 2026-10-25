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
    "say": "Pick TruenoEspora, the one with the mushroom on his head. His services are paid for with Glory points: that little yellow number at the top.",
    "mission": "Pick TruenoEspora",
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
    "ok": "TrotaMontes Boots: more Movement. Mind their durability, I didn't keep the receipt."
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
   "say": "Bosque MushBoom, antes «de la Paz y la Armonía». Cambió de nombre cuando alguien descubrió que las setas explotan.",
   "button": "Qué simpático",
   "mood": "grunon",
   "en": {
    "say": "MushBoom Forest, once \"of Peace and Harmony\". Renamed when someone discovered mushrooms explode.",
    "button": "How charming"
   }
  },
  {
   "say": "Hoy: setas explosivas, el Altar de Sacrificios y el GnomOgro. Empecemos por las setas.",
   "button": "Estoy deseando",
   "mood": "normal",
   "en": {
    "say": "Today: explosive mushrooms, the Sacrifice Altar and the GnomOgro. Mushrooms first.",
    "button": "Can't wait"
   }
  },
  {
   "say": "Coge la seta explosiva con la manita (no gasta acción). Con ella encima empieza una cuenta atrás.",
   "mission": "Coge la seta explosiva",
   "ok": "Fíjate en el número: turnos hasta que estalle. Sí, la cogiste tú. Yo no me hago responsable.",
   "mood": "normal",
   "en": {
    "say": "Grab the explosive mushroom with the hand (costs no action). Carrying it starts a countdown.",
    "mission": "Pick up the explosive mushroom",
    "ok": "See the number: turns until it blows. Yes, you grabbed it. Not my responsibility."
   }
  },
  {
   "say": "El número baja cuando TÚ acabas el turno; a cero, explota. Pulsa PASAR TURNO y míralo.",
   "mission": "Pasa turno y mira la cuenta atrás",
   "ok": "Un turno menos. Ya deberías pensar cómo librarte de ella.",
   "mood": "grunon",
   "en": {
    "say": "The number drops when YOU end your turn; at zero it explodes. Tap END TURN and watch.",
    "mission": "End turn and watch the countdown",
    "ok": "One turn less. You should be thinking how to get rid of it."
   }
  },
  {
   "say": "Ofrécela al altar: acaba junto a él o pulsa su diana. La seta se desactiva y llena su barra.",
   "mission": "Ofrece la seta al altar",
   "ok": "Puntos para el altar y cero heridos. El trato más justo del bosque.",
   "mood": "normal",
   "en": {
    "say": "Offer it to the altar: end next to it or tap its target. The mushroom is defused and fills its bar.",
    "mission": "Offer the mushroom to the altar",
    "ok": "Points for the altar and zero casualties. Fairest deal in the forest."
   }
  },
  {
   "say": "El altar también come gnomos, y se llena con todos sus puntos. Tinkle, ven… será rápido. Para ti. Cógelo.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, te quiero. Lo suficiente como para que sufras pronto.",
   "mood": "grunon",
   "en": {
    "say": "The altar eats gnomes too, filling with all their points. Tinkle, come here… it'll be quick. For you. Grab him.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, I love you. Enough to make you suffer soon."
   }
  },
  {
   "say": "Tinkle ya trae puntos de sobra. Selecciona a tu unidad y pulsa la diana del altar.",
   "mission": "Estampa a Tinkle contra el altar",
   "ok": "¡Altar lleno! Se oye un crujido. Corre. Bueno, corre tú: yo soy mayor.",
   "mood": "normal",
   "en": {
    "say": "Tinkle already carries plenty of points. Select your unit and tap the altar's target.",
    "mission": "Smash Tinkle against the altar",
    "ok": "Altar full! Hear that crack? Run. Well, you run: I'm old."
   }
  },
  {
   "say": "Ese es el GnomOgro: avanza solo hacia el Obelisco rival cada turno y mata de un golpe a quien tenga al lado. Pulsa PASAR TURNO y míralo.",
   "mission": "Pasa turno y mira al GnomOgro",
   "ok": "Un paso más cerca de la victoria. Da gusto verlo, mientras no vaya a por ti.",
   "mood": "grunon",
   "en": {
    "say": "That's the GnomOgro: it walks toward the rival Obelisk each turn and kills anyone next to it in one hit. Tap END TURN and watch.",
    "mission": "End turn and watch the GnomOgre",
    "ok": "One step closer to victory. Lovely to watch, as long as he's not coming for you."
   }
  },
  {
   "say": "Resumen: coge setas pero no te las quedes, llena el altar y deja que el GnomOgro haga el trabajo sucio. ¡Suerte, la vas a necesitar!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "Recap: grab mushrooms but don't keep them, fill the altar and let the GnomOgro do the dirty work. Good luck, you'll need it!",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "rock": [
  {
   "say": "Colinas Rock'n Troll. Unos trols dieron aquí un concierto tan ruidoso que las colinas aún tiemblan.",
   "button": "Qué ambiente",
   "mood": "grunon",
   "en": {
    "say": "Rock'n Troll Hills. Some trolls gave a concert so loud the hills still tremble.",
    "button": "What a vibe"
   }
  },
  {
   "say": "Hoy: Tambores de Guerra, Fragmentos y el Volcán. Primero, los tambores.",
   "button": "A por ellos",
   "mood": "normal",
   "en": {
    "say": "Today: War Drums, Fragments and the Volcano. Drums first.",
    "button": "Let's go"
   }
  },
  {
   "say": "Quien tenga más unidades pegadas a un tambor llena su ruleta al acabar el turno. Acerca tu unidad.",
   "mission": "Acerca tu unidad al tambor",
   "ok": "Bien pegadito. Con empate nadie puntúa, como en las reuniones familiares.",
   "mood": "normal",
   "en": {
    "say": "Whoever has the most units next to a drum fills their wheel at turn end. Move your unit close.",
    "mission": "Bring your unit next to the drum",
    "ok": "Nice and close. On a tie nobody scores, like family gatherings."
   }
  },
  {
   "say": "Cada golpe a un gnomo junto al tambor suma extra. Coge a Tinkle.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, hoy de baquetas. Mejor no explicar.",
   "mood": "grunon",
   "en": {
    "say": "Each hit on a gnome by the drum adds extra. Grab Tinkle.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, drumsticks duty today. Better not explain."
   }
  },
  {
   "say": "Golpéalo con el puño sin alejarte del tambor.",
   "mission": "Golpea a Tinkle junto al tambor",
   "ok": "¡Rum-pum-pum! Qué talento desaprovechado.",
   "mood": "normal",
   "en": {
    "say": "Hit him with the fist without leaving the drum.",
    "mission": "Hit Tinkle next to the drum",
    "ok": "Rum-pum-pum! Such wasted talent."
   }
  },
  {
   "say": "La ruleta está casi llena: al acabar el turno se completa y llueven rocas. Pulsa PASAR TURNO.",
   "mission": "Pasa turno y mira la lluvia de rocas",
   "ok": "¡Lluvia de rocas! Y los tambores, avergonzados, se mudaron.",
   "mood": "normal",
   "en": {
    "say": "The wheel is nearly full: at turn end it completes and rocks rain down. Tap END TURN.",
    "mission": "End turn and watch the rock rain",
    "ok": "Raining rocks! And the drums, embarrassed, moved away."
   }
  },
  {
   "say": "Las rocas sueltan Fragmentos. Pisa uno para recogerlo: cualquiera puede cogerlos, date prisa.",
   "mission": "Recoge un fragmento",
   "ok": "Una piedra en la mochila. Como tu carrera, pero más útil.",
   "mood": "normal",
   "en": {
    "say": "Rocks drop Fragments. Step on one to pick it up: anyone can take them, hurry.",
    "mission": "Pick up a fragment",
    "ok": "A stone in the backpack. Like your career, but more useful."
   }
  },
  {
   "say": "Los fragmentos alimentan al volcán (nunca se lanzan a rivales). Abre la mochila, pulsa el fragmento dos veces y apunta al volcán.",
   "mission": "Lanza el fragmento al volcán",
   "ok": "El volcán se enciende. Cuanto más lo alimentes, más cerca de erupcionar.",
   "mood": "grunon",
   "en": {
    "say": "Fragments feed the volcano (never thrown at rivals). Open the backpack, tap the fragment twice and aim at the volcano.",
    "mission": "Throw the fragment at the volcano",
    "ok": "The volcano lights up. The more you feed it, the closer it gets to erupting."
   }
  },
  {
   "say": "El volcán también come gnomos. Estampa a Tinkle contra él y entrará en erupción.",
   "mission": "Estampa a Tinkle contra el volcán",
   "ok": "¡Erupción! Mira correr al gnomo en llamas. La vida del rival es dura.",
   "mood": "normal",
   "en": {
    "say": "The volcano eats gnomes too. Slam Tinkle into it and it erupts.",
    "mission": "Smash Tinkle against the volcano",
    "ok": "Eruption! Watch that burning gnome run. A rival's life is hard."
   }
  },
  {
   "say": "Pulsa PASAR TURNO: el gnomo en llamas explota y deja lava. Una piedra la apaga.",
   "mission": "Pasa turno y mira la explosión",
   "ok": "Lava por todas partes. Hogar, dulce hogar… de los trols.",
   "mood": "grunon",
   "en": {
    "say": "Tap END TURN: the burning gnome explodes and leaves lava. A rock puts it out.",
    "mission": "End turn and watch the explosion",
    "ok": "Lava everywhere. Home sweet home… for trolls."
   }
  },
  {
   "say": "Resumen: pega gnomos junto a los tambores, recoge fragmentos antes que el rival y usa la roca con cabeza. ¡Suerte!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "Recap: hit gnomes by the drums, grab fragments before the rival and use rocks wisely. Good luck!",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "crane": [
  {
   "say": "Poblado HurryCrane: un pueblo en las nubes que espera a que eclosione un huevo de grulla gigante.",
   "button": "Qué emoción",
   "mood": "grunon",
   "en": {
    "say": "HurryCrane Village: a town in the clouds waiting for a giant crane egg to hatch.",
    "button": "How exciting"
   }
  },
  {
   "say": "Aquí se juega al pinball: el huevo es la bola y los gnomos, la fuerza. Cada rebote lo carga. Mantén pulsado el huevo para ver su carga.",
   "button": "A jugar",
   "mood": "normal",
   "en": {
    "say": "This is pinball: the egg is the ball and gnomes are the force. Each bounce charges it. Hold the egg to see its charge.",
    "button": "Let's play"
   }
  },
  {
   "say": "Al huevo se le da con un gnomo. Coge a Tinkle.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, hoy vuelas. No preguntes dónde aterrizas.",
   "mood": "normal",
   "en": {
    "say": "You hit the egg with a gnome. Grab Tinkle.",
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
   "say": "Los bumpers hacen rebotar el huevo entre ellos, uno por turno cada uno. Lanza otro gnomo y mira la carambola.",
   "mission": "Lanza otro gnomo y provoca una carambola",
   "ok": "¡Carambola! Cada golpe más agudo. Como una discoteca, pero con daño.",
   "mood": "grunon",
   "en": {
    "say": "Bumpers bounce the egg between them, once each per turn. Throw another gnome and watch the chain.",
    "mission": "Throw another gnome and cause a carom",
    "ok": "Carom! Each hit higher-pitched. Like a nightclub, but with damage."
   }
  },
  {
   "say": "Obeliscos y tótems también lo rebotan, pero pagan: pierden vida según la carga. Y cada turno sin rebotar, lo enfría.",
   "button": "Entendido",
   "mood": "normal",
   "en": {
    "say": "Obelisks and totems bounce it too, but they pay: they lose health based on the charge. And each turn without a bounce cools it.",
    "button": "Got it"
   }
  },
  {
   "say": "Con la carga al máximo el huevo EXPLOTA y cada equipo cobra Gloria según sus rebotes. Lanza el último gnomo.",
   "mission": "Haz estallar el huevo",
   "ok": "¡BOOM! Plumas, luces… y mira quién viene a poner orden.",
   "mood": "grunon",
   "en": {
    "say": "At max charge the egg EXPLODES and each team earns Glory based on its bounces. Throw the last gnome.",
    "mission": "Make the egg explode",
    "ok": "BOOM! Feathers, lights… and look who's coming to restore order."
   }
  },
  {
   "say": "La grulla se posa en el obelisco que más ganó y lo bloquea unos turnos: no puede reclutar ni mejorar.",
   "button": "Vaya con la grulla",
   "mood": "normal",
   "en": {
    "say": "The crane lands on the obelisk that earned most and blocks it for a few turns: no recruiting or upgrading.",
    "button": "Wow, the crane"
   }
  },
  {
   "say": "¿Obelisco bloqueado? Lánzale un gnomo a la grulla: se asusta y vuela al siguiente.",
   "mission": "Espanta a la grulla con un gnomo",
   "ok": "¡Plumas por todas partes! Dos turnos en cada obelisco, salvo susto.",
   "mood": "grunon",
   "en": {
    "say": "Obelisk blocked? Throw a gnome at the crane: it gets scared and flies to the next one.",
    "mission": "Scare the crane away with a gnome",
    "ok": "Feathers everywhere! Two turns per obelisk, unless someone scares her."
   }
  },
  {
   "say": "Resumen: cada rebote carga el huevo, al máximo explota y la grulla bloquea al que más ganó. ¡Suerte!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "Recap: each bounce charges the egg, at max it explodes and the crane blocks whoever earned most. Good luck!",
    "button": "FINISH TUTORIAL"
   }
  }
 ]
};
