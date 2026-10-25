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
   "say": "Soy Nizak, tu pelota oficial. Te enseño lo básico en un momento… para que me aplastes con elegancia.",
   "button": "Vale, viejales",
   "mood": "grunon",
   "en": {
    "say": "I'm Nizak, your official ball. I'll teach you the basics in a minute… so you can squash me with style.",
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
   "say": "Elige a TruenoEspora, el de la seta. Se paga con Gloria: ese número amarillo de arriba.",
   "mission": "Elige a TruenoEspora",
   "ok": "Qué sonrisa. Ya sabe a lo que ha venido.",
   "mood": "normal",
   "en": {
    "say": "Pick TruenoEspora, the mushroom guy. He's paid for with Glory: that yellow number up top.",
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
   "say": "Mantén pulsada su cara (abajo a la izquierda) para ver sus estadísticas. Con los enemigos funciona igual.",
   "mission": "Mantén pulsada su cara",
   "ok": "Cuánto aguanta, cuánto pega… información de oro, y gratis.",
   "mood": "normal",
   "en": {
    "say": "Hold its face (bottom left) to see its stats. Works on enemies too.",
    "mission": "Hold its face",
    "ok": "What it can take, what it can dish out… free gold."
   }
  },
  {
   "say": "Recluta otra unidad igual: alguien tendrá que lanzarme cosas.",
   "mission": "Recluta una segunda unidad",
   "ok": "Dos pardillos mejor que uno. Los remordimientos se reparten.",
   "mood": "grunon",
   "en": {
    "say": "Recruit another one: somebody has to throw things at me.",
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
   "say": "Pulsa el círculo que parpadea para moverla. Cada paso gasta una acción.",
   "mission": "Mueve la unidad hasta la zona marcada.",
   "ok": "¡Camina! Un milagro de la ingeniería orgánica. Casi sin tropezar.",
   "mood": "grunon",
   "en": {
    "say": "Tap the blinking circle to move it. Each step costs an action.",
    "mission": "Move the unit to the marked spot.",
    "ok": "It walks! A miracle of organic engineering. Barely tripped."
   }
  },
  {
   "say": "Ese arbusto es un escondite: dentro, nadie te ve. Entra en él.",
   "mission": "Escóndete en el arbusto",
   "ok": "Invisible. Como mi cuenta bancaria.",
   "mood": "normal",
   "en": {
    "say": "That bush is a hideout: inside, nobody can see you. Step into it.",
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
    "say": "That trembling gnome is Tinkle, my cousin: \"the ball\". Tap the hand and your unit will go get him.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, forgive me. It was you or me."
   }
  },
  {
   "say": "¡Golpéalo! Cada golpe suma puntos, y esos puntos serán el daño de tu «estampada».",
   "mission": "Golpea al gnomo (icono del puño)",
   "ok": "¡Puntos! Tinkle encaja bien. El tío Klink encajaba mejor… hasta que se esparció por el césped.",
   "mood": "grunon",
   "en": {
    "say": "Hit him! Each hit adds points, and those points become the damage of your \"slam\".",
    "mission": "Hit the gnome (fist icon)",
    "ok": "Points! Tinkle takes hits well. Uncle Klink took them better… until he got scattered across the grass."
   }
  },
  {
   "say": "Pásale el balón a tu aliado: pulsa lanzar y elígelo. También da puntos.",
   "mission": "Lánzale el gnomo a otra unidad.",
   "ok": "¡Buen pase! Tinkle, ¿todo bien? Te veo mareado.",
   "mood": "normal",
   "en": {
    "say": "Pass the ball to your ally: tap throw and pick them. It scores too.",
    "mission": "Throw the gnome to another unit.",
    "ok": "Nice pass! Tinkle, all good? You look dizzy."
   }
  },
  {
   "say": "Quien carga al gnomo no ataca: usa a la unidad libre para golpear al enemigo.",
   "mission": "Ataca al enemigo",
   "ok": "Ahora le duele algo, y mañana también.",
   "mood": "normal",
   "en": {
    "say": "Whoever carries the gnome can't attack: use the free unit to hit the enemy.",
    "mission": "Attack the enemy",
    "ok": "Now something hurts, and tomorrow too."
   }
  },
  {
   "say": "Pinos, rocas y mena también se golpean y sueltan recursos. Tala el pino.",
   "mission": "Tala el pino (2 golpes)",
   "ok": "¡Madera! Úsala en la armería de tu obelisco para mejorar el equipo.",
   "mood": "normal",
   "en": {
    "say": "Pines, rocks and ore can be hit too and drop resources. Chop the pine.",
    "mission": "Chop down the pine (2 hits)",
    "ok": "Wood! Spend it at your obelisk's armory to upgrade gear."
   }
  },
  {
   "say": "Abre el cofre: guarda reliquias con ventajas que se desgastan si mueren tus unidades.",
   "mission": "Abre el cofre de reliquias",
   "ok": "Botas TrotaMontes: más Movimiento. Cuida su durabilidad. Y no, no guardo el ticket.",
   "mood": "normal",
   "en": {
    "say": "Open the chest: it holds relics with perks that wear down when your units die.",
    "mission": "Open the relic chest",
    "ok": "TrotaMontes Boots: more Movement. Mind the durability. And no, I kept no receipt."
   }
  },
  {
   "say": "Ahora conquista el tótem: pulsa la diana para estamparle al gnomo cargado de puntos. Sin vida, es tuyo y da Gloria cada turno.",
   "mission": "Haz una “estampada” con el gnomo contra el tótem",
   "ok": "¡Tótem conquistado! ¿Alguien llama a emergencias por Tinkle? Empezar el turno junto a un tótem tuyo recarga tu habilidad.",
   "mood": "grunon",
   "en": {
    "say": "Now conquer the totem: tap the target to slam the point-loaded gnome into it. At zero health it's yours and gives Glory every turn.",
    "mission": "Slam the gnome into the totem",
    "ok": "Totem conquered! Anyone calling an ambulance for Tinkle? Starting your turn next to your totem recharges your ability."
   }
  },
  {
   "say": "Último truco: el SACRIFICIO. Lanza al gnomo al agua (verás una calavera) y ganas Gloria al instante.",
   "mission": "Sacrifica al gnomo en el agua",
   "ok": "Gloria al instante. Tinkle dio su vida por la causa, aunque nadie le preguntó.",
   "mood": "aplaude",
   "en": {
    "say": "Last trick: SACRIFICE. Throw the gnome into the water (you'll see a skull) and gain Glory instantly.",
    "mission": "Sacrifice the gnome in the water",
    "ok": "Instant Glory. Tinkle gave his life for the cause, though nobody asked him."
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
   "say": "Cuando no te queden acciones, pulsa PASAR TURNO. Juega el rival y vuelves tú.",
   "mission": "Pulsa PASAR TURNO",
   "ok": "El rival no hizo nada. Es un tutorial.",
   "mood": "grunon",
   "en": {
    "say": "When you're out of actions, tap END TURN. The rival plays and you're back.",
    "mission": "Tap END TURN",
    "ok": "The rival did nothing. It's a tutorial."
   }
  },
  {
   "say": "¡Lo conseguiste! Ya sabes reclutar, mover, esconderte, lanzar, estampar, talar y conquistar. Oficialmente, eres un asesino de gnomos… y a mí me parte el lomo.",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "You did it! You can recruit, move, hide, throw, slam, chop and conquer. Officially, you're a gnome killer… and it breaks my back.",
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
