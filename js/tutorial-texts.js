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
   "say": "Vaya, otro verdugo. Perdón, «jugador»: así os llamamos antes de que nos aplastéis. Soy Nizak, llevo media vida dedicándome a ser vuestra pelota en este deporte de majaras. Siempre digo que de algo hay que vivir. Bueno, vivir, vivir... Te enseñaré lo básico para que, al menos, me aplastes con cierta elegancia.",
   "button": "Vale, viejales",
   "mood": "grunon",
   "en": {
    "say": "Well, well, another executioner. Sorry, \"player\": that's what we call you before you squash us. I'm Nizak, and I've spent half my life as your ball in this lunatic sport. I always say a gnome's gotta make a living. Well, living, living... I'll teach you the basics so you can at least squash me with some elegance.",
    "button": "Fine, oldie"
   }
  },
  {
   "say": "Esa roca mugrienta de 2 metros es tu Obelisco Ancestral: hogar, fábrica de reclutas y retrete, todo en uno. Pulsa sobre él. No muerde (nosotros los gnomos sí, pero de eso hablaremos en otro momento).",
   "mission": "Pulsa tu Obelisco",
   "ok": "Muy bien. Has tocado una piedra. Han dado diplomas por menos.",
   "mood": "normal",
   "en": {
    "say": "That filthy 2-meter rock is your Ancestral Obelisk: home, recruit factory and toilet, all in one. Tap it. It doesn't bite (we gnomes do, but that's a story for another time).",
    "mission": "Tap your Obelisk",
    "ok": "Very good. You touched a rock. They've handed out diplomas for less."
   }
  },
  {
   "say": "Ahora pulsa sobre el icono de Reclutar, el primero de los tres. El de la izquierda… ¿Sabes cuál te digo, no?",
   "mission": "Pulsa el icono de Reclutar",
   "ok": "Perfecto. Ya estás en la sala de entrenamiento. La idea era reunir a los mejores, pero se nos iba el presupuesto.",
   "mood": "normal",
   "en": {
    "say": "Now tap the Recruit icon, the first of the three. The one on the left… You know which one I mean, right?",
    "mission": "Tap the Recruit icon",
    "ok": "Perfect. You're now in the training hall. The plan was to gather the best, but we ran out of budget."
   }
  },
  {
   "say": "Elige a TruenoEspora, el del sombrero de seta: no está nada mal, es bastante versátil y esconde una seta-trampa bajo la manga. Cada uno cuesta Puntos de Gloria, ese número amarillo y reluciente de arriba, lo único bonito de todo este asunto.",
   "mission": "Elige a TruenoEspora",
   "ok": "Mira qué sonrisa, ya sabe a lo que ha venido. Una lástima que los míos no estén tan contentos.",
   "mood": "normal",
   "en": {
    "say": "Pick TruenoEspora, the one in the mushroom hat: not bad at all, pretty versatile, and he's hiding a trap mushroom up his sleeve. Each one costs Glory Points, that shiny yellow number up top, the only pretty thing about this whole affair.",
    "mission": "Pick TruenoEspora",
    "ok": "Look at that smile, he knows what he signed up for. Shame mine aren't so happy."
   }
  },
  {
   "say": "Ahora pulsa RECLUTAR. Un clic más y tendrás bajo tus órdenes a otro pobre diablo que firma sin haber leído la letra pequeña.",
   "mission": "Pulsa RECLUTAR",
   "ok": "¡Estupendo! Veo que has encontrado el botón. No despediremos al diseñador de interfaces… de momento.",
   "mood": "grunon",
   "en": {
    "say": "Now tap RECRUIT. One more click and you'll have another poor devil under your command who signed without reading the fine print.",
    "mission": "Tap RECRUIT",
    "ok": "Great! Looks like you found the button. We won't fire the interface designer… for now."
   }
  },
  {
   "say": "Las casillas destacadas te indican los sitios disponibles donde colocarlo junto al Obelisco. Elige una y tu unidad aparecerá ahí, como un champiñón, pero con peor carácter.",
   "mission": "Elige una casilla para colocarlo",
   "ok": "¡Ya tienes un compañero leal! A ver si la lealtad le dura mucho cuando empiece a salpicar la sangre.",
   "mood": "normal",
   "en": {
    "say": "The highlighted tiles show the available spots next to the Obelisk to place it. Pick one and your unit will appear there, like a button mushroom, but with a worse temper.",
    "mission": "Pick a tile to place it",
    "ok": "You've got yourself a loyal companion! Let's see how long that loyalty lasts once the blood starts splattering."
   }
  },
  {
   "say": "Antes de seguir, un truco útil: selecciona a TruenoEspora y mantén pulsada la cara de tu unidad, abajo a la izquierda, y verás todas sus estadísticas. Con las unidades enemigas funciona igual: selecciónalas y mira de qué pasta están hechas… antes de que te hagan pasta a ti.",
   "mission": "Mantén pulsada su cara (3 s)",
   "ok": "Ahora sabes cuánto aguanta, cuánto pega y cuánto le queda. Información de oro, y gratis.",
   "mood": "normal",
   "en": {
    "say": "Before we go on, a handy trick: select TruenoEspora and hold down your unit's face, bottom left, and you'll see all its stats. It works the same with enemy units: select them and see what they're made of… before they make mincemeat of you.",
    "mission": "Hold its face (3 s)",
    "ok": "Now you know how much it can take, how hard it hits and how much it has left. Golden info, and free."
   }
  },
  {
   "say": "Uno solo se aburre, y yo me aburro con él. Recluta otro igual: Obelisco, Reclutar, unidad, RECLUTAR y casilla. Necesitarás a alguien a quien lanzar cosas (sí, cosas: yo soy una de ellas).",
   "mission": "Recluta una segunda unidad",
   "ok": "Dos pardillos mejor que uno. Así la culpa y los remordimientos se repartirán.",
   "mood": "grunon",
   "en": {
    "say": "One alone gets bored, and I get bored with it. Recruit another one just like it: Obelisk, Recruit, unit, RECRUIT and tile. You'll need someone to throw things at (yes, things: I'm one of them).",
    "mission": "Recruit a second unit",
    "ok": "Two suckers are better than one. That way the guilt and remorse get split."
   }
  },
  {
   "say": "Para dar instrucciones a una unidad hay que seleccionarla: pulsa sobre uno de tus aliados. Con cariño, no vayas a clavarle esa flecha puntiaguda voladora en el ojo.",
   "mission": "Selecciona una unidad",
   "ok": "¡Eso es! Qué sensación de poder, ¿verdad? Pues no te acostumbres.",
   "mood": "normal",
   "en": {
    "say": "To give orders to a unit, you have to select it: tap one of your allies. Gently, please, unless you want to put that pointy flying arrow through its eye.",
    "mission": "Select a unit",
    "ok": "That's it! What a rush of power, huh? Don't get used to it."
   }
  },
  {
   "say": "Esos círculos del suelo te indican las zonas a donde puede moverse. Pulsa el que parpadea y se moverá. Ojo: andar gasta una de sus acciones por turno; aquí hasta caminar tiene precio, como en la vida.",
   "mission": "Mueve la unidad hasta la zona marcada.",
   "ok": "¡Está andando! Un milagro de la ingeniería orgánica, y sin tropezarse. Bueno, casi.",
   "mood": "grunon",
   "en": {
    "say": "Those circles on the ground show where it can move. Tap the blinking one and off it goes. Heads up: walking costs one of its actions each turn. Even walking has a price here, just like in life.",
    "mission": "Move the unit to the marked spot.",
    "ok": "It's walking! A miracle of organic engineering, and without tripping. Well, almost."
   }
  },
  {
   "say": "Ese arbusto tan mono no es decoración: es un escondite. Métete dentro y el rival dejará de verte (tú sí te ves, qué detalle). Eso sí: si alguien entra en un arbusto donde ya hay alguien escondido, se llevará un golpe y perderá sus acciones. Esconderse: el arte de no estar donde te buscan.",
   "mission": "Escóndete en el arbusto",
   "ok": "Invisible. Como mi cuenta bancaria.",
   "mood": "normal",
   "en": {
    "say": "That cute bush isn't decoration: it's a hiding spot. Get inside and your rival stops seeing you (you can still see yourself, how thoughtful). But beware: if someone enters a bush where someone is already hiding, they take a hit and lose their actions. Hiding: the art of not being where they look for you.",
    "mission": "Hide in the bush",
    "ok": "Invisible. Just like my bank account."
   }
  },
  {
   "say": "¿Ves ese gnomo de ahí? El que tiembla como un flan. Es Tinkle, mi primo segundo. Aquí lo llamamos «balón». Acércate y pulsa la manita para cogerlo. Si hace falta, tu unidad caminará solo hasta él.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, perdóname. Eras tú o yo.",
   "mood": "grunon",
   "en": {
    "say": "See that gnome over there? The one shaking like jelly. That's Tinkle, my second cousin. Around here we call him \"the ball\". Walk up and tap the little hand to grab him. If needed, your unit will walk over by itself.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, forgive me. It was you or me."
   }
  },
  {
   "say": "Y ahora lo MÁS ingenioso del juego: ¡Golpéalo! Cada golpe le suma puntos (cuanta más fuerza, más puntos) y esos puntos serán el daño de tu “estampada”. Nuestro deporte nacional, ¡yupi! Sí, ya sé que suena a locura. De hecho lo es.",
   "mission": "Golpea al gnomo (icono del puño)",
   "ok": "¡Puntos! Tinkle, de toda la familia, tú siempre fuiste quien mejor encajaba los golpes. Bueno, el tío Klink era mejor, pero el tío Klink solo es un recuerdo, un recuerdo disperso sobre el césped...",
   "mood": "grunon",
   "en": {
    "say": "And now the MOST ingenious part of the game: Hit him! Every hit adds points to him (the more strength, the more points), and those points become the damage of your \"slam\". Our national sport, yippee! Yes, I know it sounds insane. Because it is.",
    "mission": "Hit the gnome (fist icon)",
    "ok": "Points! Tinkle, of the whole family, you were always the one who took a beating best. Well, Uncle Klink was better, but Uncle Klink is just a memory now, a memory scattered across the grass..."
   }
  },
  {
   "say": "Noticia: pasarse el balón también da puntos, por si en algún momento te duelen los nudillos. Pulsa el icono de lanzar y luego selecciona a tu amigo. Quien lanza gasta acción; quien recibe, no. Es lo más parecido a la justicia que verás por aquí.",
   "mission": "Lánzale el gnomo a otra unidad.",
   "ok": "¡Buen lanzamiento! Tinkle, ¿todo bien? Se te ve mareado.",
   "mood": "normal",
   "en": {
    "say": "News flash: passing the ball also earns points, in case your knuckles start to ache. Tap the throw icon and then select your friend. The thrower spends an action; the receiver doesn't. It's the closest thing to justice you'll see around here.",
    "mission": "Throw the gnome to another unit.",
    "ok": "Nice throw! Tinkle, are you okay? You look dizzy."
   }
  },
  {
   "say": "Mientras uno carga con el gnomo no puede atacar, así que el que tenga las manos libres que se encargue de ese que te mira raro. Tranquilo, no devolverá el golpe (ni siquiera sabe, al pobre lo han programado para que no lo haga). Selecciona a tu unidad libre y pulsa al enemigo.",
   "mission": "Ataca al enemigo",
   "ok": "Muy bien. Ahora seguro que le duele algo, y mañana también.",
   "mood": "normal",
   "en": {
    "say": "While someone is carrying the gnome they can't attack, so whoever has free hands can deal with the guy giving you funny looks. Relax, he won't hit back (poor thing was programmed not to). Select your free unit and tap the enemy.",
    "mission": "Attack the enemy",
    "ok": "Very good. Now something definitely hurts, and tomorrow too."
   }
  },
  {
   "say": "¿Ves ese pino? Y las rocas, y la mena de hierro: también se golpean. Al romperse, sueltan un recurso que vuela solito hasta tu mochila (abajo a la izquierda). Selecciona a tu unidad libre y pulsa el pino. Ojalá salga todo bien, toquemos madera.",
   "mission": "Tala el pino (2 golpes)",
   "ok": "¡Madera conseguida! Ya puedes fabricarme un ataúd... o una mejora de armadura, que queda más elegante. En la armería de tu obelisco tienes las mejoras de equipo.",
   "mood": "normal",
   "en": {
    "say": "See that pine? And the rocks, and the iron ore: you can hit those too. When they break, they drop a resource that flies by itself to your backpack (bottom left). Select your free unit and tap the pine. Hopefully it all goes well, knock on wood.",
    "mission": "Chop down the pine (2 hits)",
    "ok": "Wood acquired! Now you can build me a coffin... or an armor upgrade, which is classier. Gear upgrades are in your obelisk's armory."
   }
  },
  {
   "say": "Por si no te parecía suficientemente satisfactorio reventar gnomos... ¿ves ese cofre escondido en un rincón? En las partidas de verdad hay un buen puñado repartidos por el mapa. Se abren haciendo clic sobre ellos y esconden reliquias, de las que dan ventajas de las buenas… Cuando las consigas, cada vez que muera una unidad tuya, perderán durabilidad, y cuando se les acabe se rompen. Como la clavícula de mi tío Klink.",
   "mission": "Abre el cofre de reliquias",
   "ok": "¡Reliquia en la mochila! Son las Botas TrotaMontes: más Movimiento para todas tus unidades. Fíjate en el marcador que tiene al lado: indica su durabilidad. Cuida de tus unidades o las botas se gastarán antes de tiempo. Y no, no guardo el ticket de compra, así que olvídate de la garantía.",
   "mood": "normal",
   "en": {
    "say": "In case bursting gnomes wasn't satisfying enough for you... see that chest hidden in a corner? In real matches there are quite a few scattered around the map. You open them by clicking on them, and they hide relics, the kind that give really good advantages… Once you get them, every time one of your units dies they lose durability, and when it runs out they break. Like my uncle Klink's collarbone.",
    "mission": "Open the relic chest",
    "ok": "Relic in the backpack! These are the TrotaMontes Boots: extra Movement for all your units. Look at the marker next to it: that's their durability. Look after your units or the boots will wear out early. And no, I didn't keep the receipt, so forget about the warranty."
   }
  },
  {
   "say": "No hay nada mejor que conquistar un tótem con un gnomo cargado de puntos. Tu unidad lo estampa contra él y le resta tanta vida como puntos lleve. Si se queda sin puntos, el tótem es tuyo y te da Puntos de Gloria cada turno, se capture como se capture. Ya puedes ir pensando en la jubilación. ¿Por qué me miras a mí y al tótem de esa manera? Acércate con quien lleva el gnomo y pulsa la diana. Lo que la gente del gremio conoce como “estampada”.",
   "mission": "Haz una “estampada” con el gnomo contra el tótem",
   "ok": "¡Un tótem conquistado! ¿Tinkle? ¿Alguien puede llamar a emergencias? O a una funeraria... Y un truco: si una de tus unidades empieza el turno pegada a un tótem tuyo, recarga su habilidad especial. Capturar tótems también sirve para eso.",
   "mood": "grunon",
   "en": {
    "say": "There's nothing better than conquering a totem with a gnome loaded with points. Your unit slams him against it and takes off as much health as the points he carries. If it runs out of points, the totem is yours and gives you Glory Points every turn, however you capture it. You can start thinking about retirement. Why are you looking at me and the totem like that? Walk up with whoever is carrying the gnome and tap the target. What guild folk call a \"slam\".",
    "mission": "Slam the gnome into the totem",
    "ok": "A totem conquered! Tinkle? Can someone call an ambulance? Or an undertaker... And a trick: if one of your units starts its turn right next to a totem of yours, its special ability recharges. Capturing totems is good for that too."
   }
  },
  {
   "say": "Tu Obelisco guarda más trucos. Selecciónalo y abre Habilidades: tres ramas (Guerra, Protección y Supervivencia) con mejoras permanentes que se compran con Puntos de Gloria. Échale un vistazo y ciérrala con la X. No te pido que entiendas nada, de momento con que sepas que está ahí, es suficiente.",
   "mission": "Abre Habilidades y ciérrala",
   "ok": "Demasiado árbol de habilidades para tan poco bosque.",
   "mood": "normal",
   "en": {
    "say": "Your Obelisk hides more tricks. Select it and open Skills: three branches (War, Protection and Survival) with permanent upgrades bought with Glory Points. Take a look and close it with the X. I'm not asking you to understand anything, just knowing it's there is enough for now.",
    "mission": "Open Skills and close it",
    "ok": "Too much skill tree for so little forest."
   }
  },
  {
   "say": "Y por último, la Armería: aquí gastas esa madera, roca y metal en subir el Arma y la Armadura de todas tus unidades, nivel a nivel. Es el único sitio de este juego donde la madera sirve para algo bueno. Ábrela y ciérrala.",
   "mission": "Abre la Armería y ciérrala",
   "ok": "Ahora sabes dónde gastar los restos de la deforestación.",
   "mood": "normal",
   "en": {
    "say": "And finally, the Armory: here you spend that wood, rock and metal to upgrade the Weapon and Armor of all your units, level by level. It's the only place in this game where wood is good for something. Open it and close it.",
    "mission": "Open the Armory and close it",
    "ok": "Now you know where to spend the leftovers of deforestation."
   }
  },
  {
   "say": "Cuando tus unidades se queden sin acciones (o sin ganas), pulsa PASAR TURNO. Luego jugará el rival y luego vuelves tú… Y así sucesivamente. Es como la vida: esperas tu turno, esperas, esperas, estampas un gnomo contra el césped, vuelves a esperar...",
   "mission": "Pulsa PASAR TURNO",
   "ok": "Y el rival... no hizo nada. Era de esperar, esto es un tutorial.",
   "mood": "grunon",
   "en": {
    "say": "When your units run out of actions (or willpower), tap END TURN. Then the rival plays, then you again... And so on. It's like life: you wait for your turn, wait, wait, slam a gnome into the grass, wait again...",
    "mission": "Tap END TURN",
    "ok": "And the rival... did nothing. Figures, this is a tutorial."
   }
  },
  {
   "say": "Lo has conseguido. Ya sabes reclutar, mover, esconderte, coger gnomos, lanzarlos, estamparlos, atacar, talar, abrir cofres de reliquias, mejorar y conquistar. ¡Enhorabuena! Oficialmente ya eres todo un asesino de gnomos... aunque me parta lo poco que me queda de corazón o de lomo, según transcurra la partida. Y recuerda: si algún gnomo te mira raro, es que ya conoce tus intenciones.",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "You did it. You now know how to recruit, move, hide, grab gnomes, throw them, slam them, attack, chop, open relic chests, upgrade and conquer. Congratulations! You're officially a full-blown gnome killer... even if it breaks what's left of my heart or my back, depending on how the match goes. And remember: if a gnome gives you funny looks, he already knows your intentions.",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "mush": [
  {
   "say": "Bienvenido al Bosque MushBoom, antes llamado «Bosque de la Paz y la Armonía». Cambiaron el nombre el día que alguien descubrió que las setas de por aquí explotan. Desde entonces el turismo ha bajado bastante, y los gnomos, todavía más. Yo soy de los pocos que quedan: el último con ganas de hablar.",
   "button": "Qué simpático",
   "mood": "grunon",
   "en": {
    "say": "Welcome to the MushBoom Forest, formerly known as the «Forest of Peace and Harmony». They renamed it the day someone found out the mushrooms around here explode. Tourism has dropped quite a bit since then, and gnomes even more. I'm one of the few left: the last one in the mood to chat.",
    "button": "How charming"
   }
  },
  {
   "say": "Es un sitio precioso, si te gusta el olor a humo, a hongo chamuscado y a gnomo a la brasa. Dicen que, de vez en cuando, la tierra tiembla. No es un terremoto: es el hambre de un gigante que duerme bajo un altar. Hoy te enseñaré las tres cosas que hacen especial este bosque: las setas explosivas, el Altar de Sacrificios y el GnomOgro.",
   "button": "Estoy deseando",
   "mood": "normal",
   "en": {
    "say": "It's a gorgeous place, if you like the smell of smoke, scorched fungus and grilled gnome. They say the ground shakes every now and then. It's not an earthquake: it's the hunger of a giant sleeping under an altar. Today I'll show you the three things that make this forest special: explosive mushrooms, the Sacrifice Altar and the GnomOgre.",
    "button": "Can't wait"
   }
  },
  {
   "say": "Primera atracción: las setas explosivas. Aparecen sueltas por el bosque y se cogen igual que un gnomo, con la manita (coger no gasta acción). Pero ojo: en cuanto la llevas encima empieza una cuenta atrás, y al llegar a 0 explota, haciendo daño a quien la lleva y a todo lo que tenga alrededor. Te he dejado una cerquita de tu unidad. ¡Cógela!",
   "mission": "Coge la seta explosiva",
   "ok": "¡Ya la tienes! Fíjate en el número que lleva encima: son los turnos que le quedan antes de estallar. Sí, la has cogido tú. Yo no me hago responsable.",
   "mood": "normal",
   "en": {
    "say": "First attraction: explosive mushrooms. They show up loose around the forest and you pick them up just like a gnome, with the little hand (picking up costs no action). But careful: as soon as you carry one, a countdown starts, and at 0 it explodes, hurting whoever carries it and everything around. I've left one right next to your unit. Grab it!",
    "mission": "Pick up the explosive mushroom",
    "ok": "You've got it! Look at the number it carries: those are the turns left before it blows. Yes, you picked it up. I take no responsibility."
   }
  },
  {
   "say": "Ese número baja en uno cada vez que TÚ terminas tu turno. Si llega a 0, adiós seta y adiós portador. Pulsa PASAR TURNO y compruébalo: tranquilo, aún te queda margen. Mientras no te lo pienses demasiado...",
   "mission": "Pasa turno y mira la cuenta atrás",
   "ok": "Un turno menos para que estalle. Si fueras listo, ya estarías pensando en cómo deshacerte de ella. Tranquilo, que te lo cuento.",
   "mood": "grunon",
   "en": {
    "say": "That number drops by one every time YOU end your turn. At 0, goodbye mushroom and goodbye carrier. Press END TURN and see for yourself: don't worry, you still have some margin. As long as you don't think about it too much...",
    "mission": "End turn and watch the countdown",
    "ok": "One turn less before it blows. If you were smart, you'd already be thinking about how to get rid of it. Relax, I'll tell you how."
   }
  },
  {
   "say": "¿Ves ese altar tan acogedor? Es el Altar de Sacrificios y siempre tiene hambre: su barra, en vez de vaciarse, se llena con ofrendas. Una seta explosiva le da puntos y, además, se desactiva sin explotar. Basta con que tu unidad con la seta acabe junto al altar, o con que pulses su diana, para ofrecérsela.",
   "mission": "Ofrece la seta al altar",
   "ok": "Puntos para el altar y cero heridos. Es el trato más justo que ha hecho nadie en este bosque.",
   "mood": "normal",
   "en": {
    "say": "See that cozy altar? It's the Sacrifice Altar and it's always hungry: its bar, instead of emptying, fills up with offerings. An explosive mushroom gives it points and is also defused without exploding. It's enough for your unit carrying the mushroom to end up next to the altar, or to press its target icon, to offer it.",
    "mission": "Offer the mushroom to the altar",
    "ok": "Points for the altar and zero casualties. The fairest deal anyone has made in this forest."
   }
  },
  {
   "say": "Pero el altar es un glotón y también se alimenta de gnomos. Si estampas a un gnomo contra él (con la diana, como contra un tótem), la barra se llena con TODOS los puntos que lleve encima el gnomo: cuantos más golpes haya recibido, más ofrenda. Tinkle, ven aquí… No te asustes, esto va a ser rápido. Para ti, claro. Coge a Tinkle.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, ya sabes que te quiero. Lo suficiente como para que sufras pronto.",
   "mood": "grunon",
   "en": {
    "say": "But the altar is a glutton and it also feeds on gnomes. If you smash a gnome against it (with the target icon, like against a totem), the bar fills with ALL the points the gnome carries: the more hits it took, the bigger the offering. Tinkle, come here… Don't be scared, this will be quick. For you, I mean. Pick up Tinkle.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, you know I love you. Enough for you to suffer soon."
   }
  },
  {
   "say": "Tinkle se ha puesto muy nervioso y trae puntos de sobra. No me preguntes cómo: hay cosas que es mejor no saber. Sumados a los de la seta, dejan el altar lleno del todo. Selecciona a tu unidad y pulsa la diana del altar. Y ruega por su alma.",
   "mission": "Estampa a Tinkle contra el altar",
   "ok": "¡Altar lleno! Ha desaparecido en medio de un temblor. ¿Has oído eso? Sí, ese crujido. Corre. Bueno, corre tú, que yo ya soy mayor.",
   "mood": "normal",
   "en": {
    "say": "Tinkle has gotten very nervous and is carrying plenty of points. Don't ask me how: some things are better left unknown. Added to the mushroom's, they leave the altar completely full. Select your unit and press the altar's target icon. And pray for his soul.",
    "mission": "Smash Tinkle against the altar",
    "ok": "Altar full! It has vanished in a tremor. Did you hear that? Yes, that crunch. Run. Well, you run, I'm old."
   }
  },
  {
   "say": "Ese es el GnomOgro: un gigante que no obedece a nadie. Es del bando de quien llenó el altar (tú), pero va por su cuenta: al principio de CADA turno da un paso hacia el Obelisco rival y, si tiene a un enemigo al lado, lo mata de un golpe en vez de andar. Aguanta lo que le echen, y si llega a la base rival la destruye de un solo golpe y se acaba la partida. Pasa turno y míralo caminar.",
   "mission": "Pasa turno y mira al GnomOgro",
   "ok": "Un paso más cerca de la victoria. Y fíjate qué temblor al caminar: da gusto verlo, mientras no vaya a por ti.",
   "mood": "grunon",
   "en": {
    "say": "That's the GnomOgre: a giant who obeys no one. It belongs to whoever filled the altar (you), but it does its own thing: at the start of EVERY turn it takes a step toward the rival Obelisk and, if an enemy is next to it, it kills it in one blow instead of walking. It takes whatever you throw at it, and if it reaches the rival base it destroys it in a single hit and the game ends. End your turn and watch it walk.",
    "mission": "End turn and watch the GnomOgre",
    "ok": "One step closer to victory. And look at that tremor as it walks: a joy to watch, as long as it isn't coming for you."
   }
  },
  {
   "say": "Y eso es todo del Bosque MushBoom. Resumen: coge setas pero no te las quedes, llena el altar con setas y gnomos, y deja que el GnomOgro haga el trabajo sucio. Ojo: si el que llena el altar es el rival, el gigante irá a por TU Obelisco. Entonces ataca al gigante con todas tus unidades, o corre a llenar tú el altar antes. ¡Suerte, la vas a necesitar!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "And that's all for the MushBoom Forest. Summary: pick up mushrooms but don't keep them, fill the altar with mushrooms and gnomes, and let the GnomOgre do the dirty work. Careful: if the rival fills the altar, the giant will come for YOUR Obelisk. Then attack the giant with all your units, or run to fill the altar first. Good luck, you'll need it!",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "rock": [
  {
   "say": "Colinas Rock'n Troll. Hace siglos, unos trols dieron aquí un concierto de rock tan ruidoso que las colinas se echaron a temblar... y nunca pararon. Los trols se quedaron a vivir, para los coros. Nadie se atreve a decirles que ya no cantan nada bien.",
   "button": "Qué ambiente",
   "mood": "grunon",
   "en": {
    "say": "Rock'n Troll Hills. Centuries ago, some trolls gave a rock concert here so loud that the hills started to shake... and never stopped. The trolls stayed to live here, for the backing vocals. Nobody dares tell them they can't sing anymore.",
    "button": "What a vibe"
   }
  },
  {
   "say": "Aquí lo oirás todo: tambores que retumban, rocas que caen del cielo y un volcán de muy mal carácter, harto de tanto ruido. Yo, que tengo buen oído, prefiero no acercarme. Hoy te enseñaré las tres cosas que hacen especial este sitio: los Tambores de Guerra, los Fragmentos de roca y el Volcán.",
   "button": "A por ellos",
   "mood": "normal",
   "en": {
    "say": "You'll hear everything here: booming drums, rocks falling from the sky and a very ill-tempered volcano, fed up with all the noise. I have good hearing, so I prefer not to get close. Today I'll show you the three things that make this place special: the War Drums, the Rock Fragments and the Volcano.",
    "button": "Let's go"
   }
  },
  {
   "say": "Primero, los Tambores de Guerra. Si tienes MÁS unidades pegadas a un tambor que cualquier otro bando, al acabar tu turno llenas una porción de tu ruleta (la que flota sobre el tambor). Con empate o minoría, nada. Cuando tu ruleta llega al máximo, ¡llueven rocas sobre tus rivales! Acerca tu unidad al tambor.",
   "mission": "Acerca tu unidad al tambor",
   "ok": "Ahí está, bien pegadito. Si el rival trae a un colega, será empate y no puntuará nadie. Como en las mejores reuniones de familia.",
   "mood": "normal",
   "en": {
    "say": "First, the War Drums. If you have MORE units next to a drum than any other side, at the end of your turn you fill one slice of your wheel (the one floating above the drum). With a tie or a minority, nothing. When your wheel reaches its maximum, rocks rain down on your rivals! Bring your unit next to the drum.",
    "mission": "Bring your unit next to the drum",
    "ok": "There it is, nice and close. If the rival brings a buddy, it'll be a tie and nobody scores. Like at the best family gatherings."
   }
  },
  {
   "say": "Hay un truco para que los tambores suenen más deprisa: cada golpe que des a un gnomo estando pegado a un tambor suma una porción extra. Tinkle viene justo hacia aquí, con la ilusión de siempre. Cógelo.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, esta vez haz de baquetas. Mejor no te explico lo que significa.",
   "mood": "grunon",
   "en": {
    "say": "There's a trick to make the drums sound faster: every hit you give a gnome while next to a drum adds an extra slice. Tinkle is coming right here, with his usual enthusiasm. Pick him up.",
    "mission": "Grab Tinkle",
    "ok": "Tinkle, this time you're the drumsticks. I'd better not explain what that means."
   }
  },
  {
   "say": "Ahora golpéalo, con el puño, mientras sigues pegado al tambor. Cada golpe hace retumbar el cuero y deja pendiente una porción más para el final de tu turno.",
   "mission": "Golpea a Tinkle junto al tambor",
   "ok": "¡Rum-pum-pum! Y Tinkle ha puesto el compás. Qué talento desaprovechado.",
   "mood": "normal",
   "en": {
    "say": "Now hit him, with your fist, while you stay next to the drum. Each hit makes the drumskin boom and leaves one more slice pending for the end of your turn.",
    "mission": "Hit Tinkle next to the drum",
    "ok": "Rum-pum-pum! And Tinkle has set the beat. What wasted talent."
   }
  },
  {
   "say": "Para no hacerte esperar, he dejado tu ruleta casi llena: con la porción del tambor y la del golpe, al acabar el turno se completa. También he puesto a un rival ahí cerquita, para que vea el espectáculo de cerca. Pulsa PASAR TURNO.",
   "mission": "Pasa turno y mira la lluvia de rocas",
   "ok": "¡Lluvia de rocas! Cada lluvia pega más fuerte que la anterior. Y fíjate: los tambores, avergonzados, se han mudado a otro sitio.",
   "mood": "normal",
   "en": {
    "say": "So you don't have to wait, I've left your wheel almost full: with the drum's slice and the hit's slice, it completes at the end of the turn. I've also put a rival right nearby, so he can see the show up close. Press END TURN.",
    "mission": "End turn and watch the rock rain",
    "ok": "Rock rain! Every rain hits harder than the last. And look: the drums, embarrassed, have moved somewhere else."
   }
  },
  {
   "say": "Cada roca que cae se rompe y suelta Fragmentos. Se recogen al pisarlos: van a tu mochila y se apilan. Cualquier bando puede cogerlos, así que date prisa antes de que se los lleve el rival. Te he dejado unos cuantos cerca. Pisa uno.",
   "mission": "Recoge un fragmento",
   "ok": "Una piedra en la mochila. Como tu carrera, pero más útil.",
   "mood": "normal",
   "en": {
    "say": "Every rock that falls breaks and drops Fragments. You collect them by stepping on them: they go into your backpack and stack up. Any side can pick them up, so hurry before the rival takes them. I've left a few nearby. Step on one.",
    "mission": "Pick up a fragment",
    "ok": "A stone in the backpack. Like your career, but more useful."
   }
  },
  {
   "say": "Las piedras valen para tres cosas, y NUNCA contra unidades rivales: alimentar al volcán, apagar una casilla de lava y quitar un gnomo en llamas agarrado a una de tus unidades. Puedes lanzar todas las que tengas, sin límite por turno. Abre la mochila, pulsa el fragmento dos veces (una elige, otra lo usa) y apunta al volcán, el de ahí enfrente.",
   "mission": "Lanza el fragmento al volcán",
   "ok": "El volcán se ha encendido. Cuanto más lo alimentes, más cerca estará de entrar en erupción. No hace falta que lo mires con esa cara de interés.",
   "mood": "grunon",
   "en": {
    "say": "Stones are good for three things, and NEVER against enemy units: feeding the volcano, putting out a lava tile, and removing a burning gnome clinging to one of your units. You can throw as many as you have, no limit per turn. Open the backpack, press the fragment twice (once to pick, once to use it) and aim at the volcano, the one right there.",
    "mission": "Throw the fragment at the volcano",
    "ok": "The volcano has lit up. The more you feed it, the closer it gets to erupting. No need to look so interested."
   }
  },
  {
   "say": "El volcán también se alimenta de gnomos, estampados o lanzados: suman sus puntos. Cuando se llena entra en erupción y suelta un gnomo en llamas por cada unidad rival, que corre hasta ella y se le agarra. Al acabar tu turno el gnomo explota: daño y lava en las casillas de alrededor. Tinkle ya trae puntos de casa. Estámpalo contra el volcán. Y de paso, tienes a un rival justo para la ocasión.",
   "mission": "Estampa a Tinkle contra el volcán",
   "ok": "¡Erupción! Mira cómo corre ese gnomo en llamas hacia el pobre desgraciado. La vida del rival es dura.",
   "mood": "normal",
   "en": {
    "say": "The volcano also feeds on gnomes, smashed or thrown: they add their points. When it fills up it erupts and releases a burning gnome for every enemy unit, which runs to it and clings on. At the end of your turn the gnome explodes: damage and lava on the surrounding tiles. Tinkle already brings points from home. Smash him against the volcano. And by the way, there's a rival right there for the occasion.",
    "mission": "Smash Tinkle against the volcano",
    "ok": "Eruption! Look at that burning gnome run toward the poor wretch. A rival's life is hard."
   }
  },
  {
   "say": "Pasa turno: el gnomo en llamas explotará y dejará lava, que hace daño a quien la pise hasta que desaparece. Una piedra puede apagar una casilla antes, o librar a una de tus unidades del gnomo en llamas antes de que estalle.",
   "mission": "Pasa turno y mira la explosión",
   "ok": "Lava por todas partes. Hogar, dulce hogar... de los trols.",
   "mood": "grunon",
   "en": {
    "say": "End your turn: the burning gnome will explode and leave lava, which hurts anyone who steps on it until it disappears. A stone can put out a tile earlier, or free one of your units from the burning gnome before it blows.",
    "mission": "End turn and watch the explosion",
    "ok": "Lava everywhere. Home, sweet home... of the trolls."
   }
  },
  {
   "say": "Y eso es todo de las Colinas Rock'n Troll. Resumen: pega gnomos junto a los tambores para que llueva roca, recoge los fragmentos antes que el rival y úsalos con cabeza: al volcán, a la lava o contra un gnomo en llamas. Cuando alguien llene el volcán, prepárate: o corres, o te agarras a una piedra. ¡Suerte, la vas a necesitar!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "And that's all for the Rock'n Troll Hills. Summary: hit gnomes next to the drums to make rocks rain, collect the fragments before the rival does and use them wisely: on the volcano, on lava or against a burning gnome. When someone fills the volcano, get ready: either you run, or you grab a stone. Good luck, you'll need it!",
    "button": "FINISH TUTORIAL"
   }
  }
 ],
 "crane": [
  {
   "say": "Hurrycrane Village. Un poblado flotando sobre las nubes que lleva siglos esperando a que eclosione un huevo de grulla gigante. Todavía no ha pasado, pero los vecinos ya han apostado qué saldrá, cuánto pesará... y a quién le tocará limpiar el nido.",
   "button": "Qué emoción",
   "mood": "grunon",
   "en": {
    "say": "Hurrycrane Village. A village floating above the clouds that has spent centuries waiting for a giant crane egg to hatch. It hasn't happened yet, but the neighbours have already bet on what will come out, how much it will weigh... and who gets to clean the nest.",
    "button": "How exciting"
   }
  },
  {
   "say": "Aquí no hay setas ni volcanes: hay un huevo con muy mala leche y unos bumpers. Hoy jugaremos al pinball con el huevo, como en aquel deporte de balón explosivo: cada rebote lo CARGA (sin números: tú lo notarás en el destello, que va cambiando de color, y en que cada rebote suena más agudo). Sí, el huevo es la bola. Y los gnomos, la fuerza motriz.",
   "button": "A jugar",
   "mood": "normal",
   "en": {
    "say": "No mushrooms or volcanoes here: just an extremely cranky egg and some bumpers. Today we play egg pinball, like that explosive-ball sport: every bounce CHARGES it (no numbers: you'll notice it in the flash that keeps changing colour, and in each bounce sounding higher). Yes, the egg is the ball. And the gnomes are the engine.",
    "button": "Let's play"
   }
  },
  {
   "say": "Al huevo se le da con un gnomo, y adivina quién es el gnomo. Tinkle viene hacia aquí, con la ilusión de siempre. Cógelo.",
   "mission": "Coge a Tinkle",
   "ok": "Tinkle, hoy vuelas. Y mejor no preguntes dónde aterrizas.",
   "mood": "normal",
   "en": {
    "say": "You hit the egg with a gnome, and guess who the gnome is. Tinkle is coming over, with his usual enthusiasm. Pick him up.",
    "mission": "Pick up Tinkle",
    "ok": "Tinkle, today you fly. And better not ask where you land."
   }
  },
  {
   "say": "Pulsa el icono de lanzar y apunta al huevo: verás varias flechas, y alguna se ayuda sola hacia un bumper cercano para que no tengas que ser Robin Hood. El gnomo estampado empuja el huevo en la dirección elegida. Con el mando, elige la flecha con la cruceta.",
   "mission": "Lánzale a Tinkle contra el huevo",
   "ok": "¡Zas! El huevo sale despedido y Tinkle, tras caerse de culo, se levanta y se va corriendo. Todo un profesional.",
   "mood": "normal",
   "en": {
    "say": "Tap the throw icon and aim at the egg: you'll see several arrows, and one helps itself towards a nearby bumper so you don't need to be Robin Hood. The smashed gnome pushes the egg in the chosen direction. With a gamepad, pick the arrow with the D-pad.",
    "mission": "Throw Tinkle at the egg",
    "ok": "Zap! The egg flies off and Tinkle, after landing on his bottom, gets up and runs away. A true professional."
   }
  },
  {
   "say": "Ahora lo bueno: los bumpers. El huevo salta de un bumper a otro si están cerca y el camino está despejado (sin niebla), pero cada bumper solo rebota UNA vez por turno: nada de ping-pong. Cada rebote lo carga un nivel y hasta el borde del mapa cuenta. Te he puesto dos bumpers. Lanza otro gnomo y mira la carambola.",
   "mission": "Lanza otro gnomo y provoca una carambola",
   "ok": "¡Carambola! Y fíjate cómo suena cada golpe más agudo que el anterior. Como una discoteca, pero con más daño.",
   "mood": "grunon",
   "en": {
    "say": "Now the good part: bumpers. The egg jumps from one bumper to another if they're close and the path is clear (no fog), but each bumper only bounces ONCE per turn: no ping-pong. Every bounce charges it one level, and even the map edge counts. I've placed two bumpers. Throw another gnome and watch the carom.",
    "mission": "Throw another gnome and cause a carom",
    "ok": "Carom! And notice how every hit sounds higher than the last. Like a disco, but with more damage."
   }
  },
  {
   "say": "Los obeliscos y los tótems también hacen rebotar al huevo, pero ellos lo pagan: según la carga, el golpe quita 2, 5 o 10 de vida. Y ojo con la carga: cada turno sin rebotar le resta un nivel, así que no lo dejes enfriar. Desde el nivel 6 tiembla y se tiñe de rojo; con el 9 se le ven hasta las grietas.",
   "button": "Entendido",
   "mood": "normal",
   "en": {
    "say": "Obelisks and totems also bounce the egg, but they pay for it: depending on the charge, the hit takes 2, 5 or 10 health. And mind the charge: every turn without a bounce it loses one level, so don't let it cool down. From level 6 it trembles and turns red; at 9 you can even see the cracks.",
    "button": "Got it"
   }
  },
  {
   "say": "Si lo rebotas con la carga al máximo, EXPLOTA. Cada equipo recibe tanta Gloria como rebotes haya dado. Lo he dejado listo: casi al máximo y con tus rebotes de ventaja. Lanza el último gnomo y que sea lo que Dios quiera.",
   "mission": "Haz estallar el huevo",
   "ok": "¡BOOM! Plumas, luces y un huevo hecho añicos. Y mira quién viene a poner orden...",
   "mood": "grunon",
   "en": {
    "say": "If you bounce it at full charge, it EXPLODES. Each team receives as much Glory as bounces it made. I've left it ready: almost maxed and with your bounces in the lead. Throw the last gnome and let fate decide.",
    "mission": "Make the egg explode",
    "ok": "BOOM! Feathers, lights and a shattered egg. And look who's coming to restore order..."
   }
  },
  {
   "say": "La gruya aparece para equilibrar la partida: se posa en el obelisco del que más puntos ganó con el huevo y se queda dos turnos. Mientras tanto, ese obelisco no puede reclutar, ni mejorar habilidades, ni usar la herrería. Si quedas el último, te tocará a ti. Y como es un objeto del escenario, se vuelve transparente si te tapa.",
   "button": "Vaya con la gruya",
   "mood": "normal",
   "en": {
    "say": "The crane shows up to balance the game: it lands on the obelisk of whoever won the most points with the egg and stays two turns. Meanwhile, that obelisk can't recruit, upgrade abilities or use the armory. If you're last, it'll be your turn. And since it's a scenery object, it turns transparent when it covers you.",
    "button": "Wow, the crane"
   }
  },
  {
   "say": "¿Tu obelisco bloqueado? Solución clásica: lánzale un gnomo a la gruya. Se asusta, se contrae y vuela al siguiente obelisco (el del siguiente que más puntos ganó), y así hasta visitarlos todos. Entonces se va y el huevo vuelve a nacer en el centro. Dale un gnomazo.",
   "mission": "Espanta a la gruya con un gnomo",
   "ok": "¡Plumas por todas partes! Dos turnos en cada obelisco, a menos que alguien le dé un susto.",
   "mood": "grunon",
   "en": {
    "say": "Obelisk blocked? Classic fix: throw a gnome at the crane. It gets scared, flinches and flies to the next obelisk (whoever won the next most points), and so on until it has visited them all. Then it leaves and the egg is reborn in the centre. Give it a good gnome smash.",
    "mission": "Scare the crane away with a gnome",
    "ok": "Feathers everywhere! Two turns on each obelisk, unless somebody scares it."
   }
  },
  {
   "say": "Y eso es todo de Hurrycrane Village. Resumen: cada rebote carga el huevo; obeliscos y tótems pagan el golpe según la carga; con la carga al máximo, explota; entonces la gruya se posa donde más puntos se ganaron y bloquea ese obelisco hasta que se vaya. ¡Suerte, la vas a necesitar!",
   "button": "TERMINAR TUTORIAL",
   "mood": "aplaude",
   "en": {
    "say": "And that's all for Hurrycrane Village. Summary: every bounce charges the egg; obelisks and totems pay for the hit depending on the charge; at full charge it explodes; then the crane lands where the most points were won and blocks that obelisk until it leaves. Good luck, you'll need it!",
    "button": "FINISH TUTORIAL"
   }
  }
 ]
};
