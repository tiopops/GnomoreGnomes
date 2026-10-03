/* Gnomore Gnomes — traducción en tiempo de ejecución ES -> EN.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe traducir el
   texto que el juego pinta en pantalla cuando el idioma es inglés:
     - Diccionario ES -> EN (EN_DICT). Las claves con {0}, {1}... son plantillas
       (números, nombres...) y se resuelven como patrones.
     - I18N.tr(texto): traduce un texto suelto (lo usa el tutorial antes de
       "escribirlo" letra a letra).
     - Un MutationObserver traduce el texto y los atributos (title, aria-label,
       placeholder, alt) que aparezcan o cambien en la página, y los DEVUELVE al
       original español al volver a ESPAÑOL.
   El español sigue siendo el idioma por defecto y la fuente de verdad: los
   archivos del juego no cambian, solo se traduce lo que sale por pantalla.
   Para añadir un texto nuevo: añade su línea "español": "inglés" abajo. */

const EN_DICT = {
"Golem de Espinas": "Thorn Golem",
"Se cura hasta su vida máxima de base y se envuelve de espinas hasta su próximo turno: mientras dure, cualquiera que lo golpee se hace 1 punto de daño a sí mismo. Gasta 1 acción. Un solo uso por partida.": "Heals to its base max health and wraps itself in thorns until its next turn: while active, anyone who hits it takes 1 damage themselves. Costs 1 action. One use per match.",
"Visión Lejana": "Far Sight",
"Revela una zona cualquiera del mapa (3 casillas alrededor del punto elegido), esté donde esté. Tras activarla, el cursor se convierte en un ojo: el siguiente clic sobre el mapa la usa ahí mismo. Gasta 1 acción. Un solo uso por partida.": "Reveals any area of the map (3 tiles around the chosen point), wherever it is. Once activated, the cursor turns into an eye: your next click on the map uses it right there. Costs 1 action. One use per match.",
"Hongo Trampa": "Trap Mushroom",
"Coloca una seta-trampa invisible para el enemigo en una casilla adyacente libre. Si una unidad enemiga la pisa, explota: le quita 1 punto de vida y la deja inactiva hasta su siguiente turno. Gasta 1 acción. Un solo uso por partida.": "Places a mushroom trap, invisible to the enemy, on a free adjacent tile. If an enemy unit steps on it, it explodes: deals 1 damage and leaves the unit inactive until its next turn. Costs 1 action. One use per match.",
"Voluntad Quebrada": "Broken Will",
"Toma el control total de un personaje enemigo adyacente durante el resto de este turno: se puede mover, atacar, coger/golpear/pasar su gnomo o incluso usar su propia habilidad, como si fuera propio. Gasta 1 acción. Un solo uso por partida.": "Takes total control of an adjacent enemy unit for the rest of this turn: it can move, attack, grab/hit/pass its gnome, or even use its own skill, as if it were yours. Costs 1 action. One use per match.",
"Nudillos Rocosos": "Rocky Knuckles",
"Golpea y empuja 4 casillas en línea recta a un enemigo adyacente (se detiene en el primer obstáculo); el golpeado queda agotado el siguiente turno. Gasta 1 acción. Un solo uso por partida. PuñoRroca es tan bruto que, si no tiene un aliado (cualquiera) justo al lado nada más empezar a andar, da tumbos al azar en vez de ir donde se le indica.": "Hits an adjacent enemy and shoves it 4 tiles in a straight line (stops at the first obstacle); the victim is exhausted next turn. Costs 1 action. One use per match. PuñoRroca is so brutish that, if he has no ally (any ally) right next to him when he starts walking, he stumbles around at random instead of going where you tell him.",
"Resorte Goblin": "Goblin Spring",
"Agarra a un personaje adyacente (amigo o enemigo, incluso si lleva el gnomo cogido) y lo lanza a cualquier casilla libre dentro de su propia área de movimiento. Gasta 1 acción. Un solo uso por partida.": "Grabs an adjacent unit (friend or foe, even if it's carrying the gnome) and hurls it to any free tile within its own movement range. Costs 1 action. One use per match.",
"¡ESPINAS!": "THORNS!",
"Elige un punto del mapa para revelarlo": "Pick a point on the map to reveal it",
"¡VISIÓN!": "VISION!",
"¡BOOM!": "BOOM!",
"Elige a qué rival controlar": "Pick which rival to control",
"¡CONTROLADO!": "CONTROLLED!",
"Elige a qué rival golpear": "Pick which rival to hit",
"Elige a quién lanzar": "Pick who to throw",
"Elige dónde lanzarlo": "Pick where to throw them",
"ARMERÍA": "ARMORY",
"No tienes suficientes recursos": "Not enough resources",
"Señuelo Explosivo": "Explosive Decoy",
"La comida favorita de los gnomos. Colócala junto a uno de tus personajes: en dos turnos atraerá a un gnomo hambriento.": "The gnomes' favorite food. Place it next to one of your units: in two turns it will lure a hungry gnome.",
"Un brebaje revitalizante. Dáselo a un personaje aliado (pulsa sobre él en el tablero) para restaurar toda su vida hasta su máximo de base.": "A revitalizing brew. Give it to an allied unit (tap it on the board) to restore all its health up to its base max.",
"Un cepo goblin oxidado. Colócalo junto a uno de tus personajes: el enemigo que caiga en su casilla o pase por encima pierde el turno, suelta cualquier gnomo que llevara encima y recibe 1 punto de daño.": "A rusty goblin bear trap. Place it next to one of your units: any enemy who lands on its tile or walks over it loses their turn, drops any gnome they were carrying and takes 1 damage.",
"Un cohete goblin casero. Elige a un rival a la vista: el misil vuela teledirigido hasta él y le hace entre 1 y 3 puntos de daño en la explosión (1 es lo más común, 2 es menos común y 3 lo menos común).": "A homemade goblin rocket. Pick a rival in sight: the missile flies guided straight to them and deals 1 to 3 damage in the explosion (1 is the most common, 2 less common, 3 the least).",
"Un tótem tallado con un ojo tallado en su punta. Colócalo sobre una casilla libre: otorga visión permanente en un radio de 3 casillas. Tiene 1 punto de vida (cualquier golpe lo destruye) y, si se esconde dentro de un arbusto, se rompe en cuanto un rival entra en él.": "A carved totem with a carved eye on its tip. Place it on a free tile: grants permanent vision in a 3-tile radius. It has 1 health (any hit destroys it) and, if hidden inside a bush, it breaks the moment a rival steps into it.",
"Un muñeco de madera con forma de gnomo, cargado de pólvora. Colócalo sobre una casilla libre de terreno (nunca en un arbusto): tú lo ves como lo que es, pero el rival lo confunde con un gnomo suelto de verdad. En cuanto intente cogerlo... ¡PUM! Explota y le quita 2 puntos de vida.": "A wooden gnome-shaped doll stuffed with gunpowder. Place it on a free terrain tile (never in a bush): you see it for what it is, but the rival mistakes it for a real loose gnome. The moment they try to grab it... BOOM! It explodes and takes 2 health from them.",
"¡BEVIDA!": "BEVIDA!",
"¡ATRAPADO!": "TRAPPED!",
"el mismo sonido de lanzamiento del gnomo algo mas agudo": "the same gnome-throw sound, a bit higher-pitched",
"¡EMBOSCADA!": "AMBUSH!",
"Ver el origen de tus puntos de gloria": "See where your glory points come from",
"Puntos de Gloria": "Glory Points",
"Vas a ganar esto al empezar tu próximo turno:": "You will gain this at the start of your next turn:",
"Próximo turno": "Next turn",
"Elige a quién pasarle el gnomo": "Pick who to pass the gnome to",
"Golpear al gnomo": "Hit the gnome",
"Pasar el gnomo": "Pass the gnome",
"Arrastra para cambiar el tamaño": "Drag to resize",
"right — · bottom — · tamaño (compartido) —": "right — · bottom — · size (shared) —",
"Arrastra el gnomo para moverlo (por personaje y por pose). Arrastra el puntito de su esquina para cambiar su tamaño — este es el MISMO para todos los personajes y las dos poses, se ajusta mirando a cualquiera.": "Drag the gnome to move it (per unit and per pose). Drag the little dot on its corner to resize it — this is the SAME for all units and both poses, so adjust it while looking at any one of them.",
"right {0} · bottom {1}% · tamaño (compartido) {2}px": "right {0} · bottom {1}% · size (shared) {2}px",
"Copia este texto a mano (Ctrl+C):": "Copy this text by hand (Ctrl+C):",
"[Gnomore Gnomes] Error al crear la partida:": "[Gnomore Gnomes] Error creating the match:",
"No se ha podido crear la partida": "Could not create the match",
"Población": "Population",
"Armería": "Armory",
"Vida del Obelisco": "Obelisk Health",
"Unidades reclutadas": "Units recruited",
"Pases de gnomo logrados": "Gnome passes completed",
"¡VICTORIA!": "VICTORY!",
"Se acabaron los {0} turnos y todo sigue exactamente igualado.": "The {0} turns are up and everything is still exactly tied.",
"Se acabaron los {0} turnos — gana quien más resistió.": "The {0} turns are up — whoever held out the longest wins.",
"Has destruido el Obelisco Ancestral rival.": "You destroyed the rival Ancestral Obelisk.",
"Tu Obelisco Ancestral ha sido destruido.": "Your Ancestral Obelisk has been destroyed.",
"TÚ": "YOU",
"VOLVER AL MENÚ": "BACK TO MENU",
"Aguante {0} · Movimiento {1} · Fuerza {2} · Agilidad {3} · Percepción {4}": "Toughness {0} · Movement {1} · Strength {2} · Agility {3} · Perception {4}",
"Reclutar cuesta {0} puntos de gloria.": "Recruiting costs {0} glory points.",
"Población al límite": "Population at limit",
"No tienes suficientes Puntos de Gloria": "Not enough Glory Points",
"Elige una casilla para colocar tu nueva unidad": "Pick a tile to place your new unit",
"Próximamente": "Coming soon",
"¡ALERTA! ¡Se acerca una plaga Gnoma!": "ALERT! A Gnome plague is coming!",
"Los gnomos se están escondiendo…": "The gnomes are hiding…",
"Roca": "Rock",
"Pino": "Pine",
"Mena de Hierro": "Iron Ore",
"Madera": "Wood",
"Madera recogida de los pinos. No se usa por sí sola: se gasta como moneda para mejorar arma y armadura en la Armería.": "Wood gathered from pines. Useless on its own: it's spent as currency to upgrade weapon and armor at the Armory.",
"Roca recogida de las canteras. No se usa por sí sola: se gasta como moneda para mejorar arma y armadura en la Armería.": "Rock gathered from quarries. Useless on its own: it's spent as currency to upgrade weapon and armor at the Armory.",
"Mena de hierro, mucho más escasa que la madera o la roca. Solo hace falta para el nivel 3 de mejoras en la Armería.": "Iron ore, far scarcer than wood or rock. Only needed for level 3 upgrades at the Armory.",
"Save corrupta, se ignora.": "Corrupt save, ignoring it.",
"Este objeto cuesta {2} puntos de gloria.": "This item costs {2} glory points.",
"La mochila está llena": "The backpack is full",
"¡La Tienda Goblin ha repuesto existencias!": "The Goblin Shop has restocked!",
"GUERRA": "WAR",
"PROTECCIÓN": "PROTECTION",
"SUPERVIVENCIA": "SURVIVAL",
"Raíces": "Roots",
"Tus tótems y tu Obelisco Ancestral echan raíces: a los personajes enemigos les cuesta 1 punto de movimiento extra por cada paso que den entrando, saliendo o moviéndose por las casillas adyacentes a ellos.": "Your totems and your Ancestral Obelisk take root: enemy units pay 1 extra movement point for every step they take entering, leaving or moving through the tiles adjacent to them.",
"Piel de Roca": "Rock Skin",
"Si un ataque fuese a matar a uno de tus personajes y llevas al menos 1 Roca en la mochila, se consume esa Roca y el personaje se queda con 1 punto de vida. Cada personaje solo puede usarlo una vez por turno.": "If an attack would kill one of your units and you carry at least 1 Rock in your backpack, that Rock is consumed and the unit is left with 1 health. Each unit can only use this once per turn.",
"Codo con Codo": "Shoulder to Shoulder",
"Tus personajes ganan +1 de Aguante por cada aliado en una casilla adyacente, hasta un máximo de +{0} (+1 por nivel, hasta +3). El bonus desaparece en cuanto se separan.": "Your units gain +1 Toughness for each ally on an adjacent tile, up to a maximum of +{0} (+1 per level, up to +3). The bonus vanishes as soon as they separate.",
"Evasión": "Evasion",
"Tus personajes tienen un +{0}% de probabilidad de esquivar un ataque enemigo cuerpo a cuerpo (+10% por nivel, hasta +30%).": "Your units have a +{0}% chance to dodge an enemy melee attack (+10% per level, up to +30%).",
"Muralla": "Rampart",
"Aumenta la vida máxima de tu Obelisco Ancestral y de los tótems bajo tu control en un +{0}% (+10% por nivel, hasta +30%).": "Increases the max health of your Ancestral Obelisk and the totems under your control by +{0}% (+10% per level, up to +30%).",
"Armadura de Espinas": "Thorn Armor",
"Cada vez que un enemigo golpea cuerpo a cuerpo a uno de tus personajes, recibe 1 punto de daño.": "Every time an enemy hits one of your units in melee, it takes 1 damage.",
"Escudos en Alto": "Shields Up",
"Tus personajes ganan un escudo que anula el próximo ataque que reciban y después desaparece. Si empiezas tu turno con un personaje sin escudo en una casilla adyacente a uno de tus tótems o a tu Obelisco, el escudo se rearma.": "Your units gain a shield that cancels the next attack they receive, then disappears. If you start your turn with a shieldless unit on a tile adjacent to one of your totems or your Obelisk, the shield is rearmed.",
"Embestir": "Charge",
"Una vez por turno, uno de tus personajes puede moverse y atacar a la vez gastando una única acción en lugar de dos. Se aplica solo al acercarse a un enemigo, a un tótem o a un Obelisco para golpearlo.": "Once per turn, one of your units can move and attack at once for a single action instead of two. Only applies when closing in on an enemy, a totem or an Obelisk to hit it.",
"Camaradas": "Comrades",
"Tus ataques hacen +{0} de daño por cada aliado tuyo situado en una casilla adyacente al enemigo que vas a golpear (+1 por nivel, hasta +3 por aliado). El propio atacante no cuenta.": "Your attacks deal +{0} damage for each ally of yours standing on a tile adjacent to the enemy you're about to hit (+1 per level, up to +3 per ally). The attacker itself doesn't count.",
"Torretas": "Turrets",
"Al final de tu turno, cada tótem bajo tu control dispara una flecha a los enemigos situados en casillas adyacentes a él y les hace 1 punto de daño.": "At the end of your turn, each totem under your control fires an arrow at enemies on tiles adjacent to it, dealing 1 damage.",
"Sed de Sangre": "Bloodlust",
"Cada vez que un personaje mata a un enemigo, gana +1 de ataque durante su próximo turno. Se acumula hasta {0} {1} (+1 por nivel, hasta 3) y el personaje se va tiñendo de rojo. Un turno sin matar reinicia la sed de sangre.": "Every time a unit kills an enemy, it gains +1 attack during its next turn. Stacks up to {0} {1} (+1 per level, up to 3) and the unit gradually turns red. A turn without a kill resets the bloodlust.",
"Último Aliento": "Last Gasp",
"Un personaje tuyo que se ha quedado con 1 punto de vida por haber recibido daño gana +1 de ataque. No se aplica a los personajes que tienen 1 de vida como vida máxima.": "A unit of yours left at 1 health from taking damage gains +1 attack. Doesn't apply to units whose max health is 1.",
"Emboscada": "Ambush",
"Un personaje tuyo que ataca desde dentro de un arbusto (se haya movido hasta él o no) gana +1 de ataque en ese golpe.": "A unit of yours that attacks from inside a bush (whether or not it moved into it) gains +1 attack on that hit.",
"Punto Estratégico": "Strategic Point",
"Los tótems bajo tu control te permiten reclutar aliados como si fueran el Obelisco Ancestral: pulsa un tótem tuyo y aparecerá el icono de reclutar; el nuevo aliado aparece en una casilla adyacente al tótem. La población máxima sigue siendo la que marca el Obelisco.": "Totems under your control let you recruit allies as if they were the Ancestral Obelisk: tap one of your totems and the recruit icon appears; the new ally appears on a tile adjacent to the totem. Max population is still set by the Obelisk.",
"Centinela": "Sentinel",
"Todas tus unidades, tus tótems y tu Obelisco Ancestral aumentan en 1 su percepción: ven una casilla más lejos y revelan más mapa.": "All your units, your totems and your Ancestral Obelisk gain +1 perception: they see one tile further and reveal more of the map.",
"Refuerzos": "Reinforcements",
"Aumenta en +{0} la población máxima de tu ejército, es decir, cuántos personajes puedes tener a la vez (+1 por nivel, hasta +3).": "Increases your army's max population by +{0}, that is, how many units you can have at once (+1 per level, up to +3).",
"Anfibio": "Amphibious",
"Tus personajes pueden caminar sobre las casillas de agua como si fueran de tierra: podrán moverse por ellas y atravesarlas.": "Your units can walk on water tiles as if they were land: they can move onto them and cross them.",
"Abundancia": "Abundance",
"Cada tótem bajo tu control te da +{0} punto{1} de gloria extra al empezar tu turno (+1 por nivel, hasta +3 por tótem).": "Each totem under your control gives you +{0} extra glory point{1} at the start of your turn (+1 per level, up to +3 per totem).",
"Regateo": "Haggling",
"Todos los productos de la Tienda Goblin cuestan la mitad, redondeando hacia abajo (nunca menos de 1 punto de gloria).": "All Goblin Shop products cost half, rounded down (never less than 1 glory point).",
"Recolector": "Gatherer",
"Todas las fuentes de recursos te dan +{0} unidad{1} extra al recogerlas (+1 por nivel, hasta +3).": "All resource sources give you +{0} extra unit{1} when collected (+1 per level, up to +3).",
"Uno con la Tierra": "One with the Earth",
"Al comienzo de cada uno de tus turnos, todas tus unidades se curan 1 punto de vida por cada tótem bajo tu control (sin superar su vida máxima).": "At the start of each of your turns, all your units heal 1 health for each totem under your control (without exceeding their max health).",
"Bloqueada: has elegido {0}.": "Locked: you chose {0}.",
"Bloqueada: lleva {0} al máximo primero.": "Locked: max out {0} first.",
"¡Embestida!": "Charge!",
"¡Escudo!": "Shield!",
"¡Esquiva!": "Dodge!",
"¡Bloqueado!": "Blocked!",
"¡Piel de Roca!": "Rock Skin!",
"Selecciona una habilidad para ver su descripción.": "Select a skill to see its description.",
"Habilidad por definir — esta rama todavía está vacía.": "Skill TBD — this branch is still empty.",
"por nivel": "per level",
"Pasar turno": "End turn",
"Turno rival…": "Rival's turn…",
"¡Todos listos!": "All set!",
"Vaya, otro verdugo. Perdón, «jugador»: así os llamamos antes de que nos aplastéis. Soy {0}, llevo media vida dedicándome a ser vuestra pelota en este deporte de majaras. Siempre digo que de algo hay que vivir. Bueno, vivir, vivir... Te enseñaré lo básico para que, al menos, me aplastes con cierta elegancia.": "Well, well, another executioner. Sorry, \"player\": that's what we call you before you squash us. I'm {0}, and I've spent half my life as your ball in this lunatic sport. I always say a gnome's gotta make a living. Well, living, living... I'll teach you the basics so you can at least squash me with some elegance.",
"Vale, viejales": "Fine, oldie",
"Esa roca mugrienta de 2 metros es tu Obelisco Ancestral: hogar, fábrica de reclutas y retrete, todo en uno. Pulsa sobre él. No muerde (nosotros los gnomos sí, pero de eso hablaremos en otro momento).": "That filthy 2-meter rock is your Ancestral Obelisk: home, recruit factory and toilet, all in one. Tap it. It doesn't bite (we gnomes do, but that's a story for another time).",
"Pulsa tu Obelisco": "Tap your Obelisk",
"Muy bien. Has tocado una piedra. Han dado diplomas por menos.": "Very good. You touched a rock. They've handed out diplomas for less.",
"Ahora pulsa sobre el icono de Reclutar, el primero de los tres. El de la izquierda… ¿Sabes cuál te digo, no?": "Now tap the Recruit icon, the first of the three. The one on the left… You know which one I mean, right?",
"Pulsa el icono de Reclutar": "Tap the Recruit icon",
"Perfecto. Ya estás en la sala de entrenamiento. La idea era reunir a los mejores, pero se nos iba el presupuesto.": "Perfect. You're now in the training hall. The plan was to gather the best, but we ran out of budget.",
"Elige a TruenoEspora, el del sombrero de seta: no está nada mal, es bastante versátil y esconde una seta-trampa bajo la manga. Cada uno cuesta Puntos de Gloria, ese número amarillo y reluciente de arriba, lo único bonito de todo este asunto.": "Pick TruenoEspora, the one in the mushroom hat: not bad at all, pretty versatile, and he's hiding a trap mushroom up his sleeve. Each one costs Glory Points, that shiny yellow number up top, the only pretty thing about this whole affair.",
"Elige a TruenoEspora": "Pick TruenoEspora",
"Mira qué sonrisa, ya sabe a lo que ha venido. Una lástima que los míos no estén tan contentos.": "Look at that smile, he knows what he signed up for. Shame mine aren't so happy.",
"Ahora pulsa RECLUTAR. Un clic más y tendrás bajo tus órdenes a otro pobre diablo que firma sin haber leído la letra pequeña.": "Now tap RECRUIT. One more click and you'll have another poor devil under your command who signed without reading the fine print.",
"Pulsa RECLUTAR": "Tap RECRUIT",
"¡Estupendo! Veo que has encontrado el botón. No despediremos al diseñador de interfaces… de momento.": "Great! Looks like you found the button. We won't fire the interface designer… for now.",
"Las casillas destacadas te indican los sitios disponibles donde colocarlo junto al Obelisco. Elige una y tu unidad aparecerá ahí, como un champiñón, pero con peor carácter.": "The highlighted tiles show the available spots next to the Obelisk to place it. Pick one and your unit will appear there, like a button mushroom, but with a worse temper.",
"Elige una casilla para colocarlo": "Pick a tile to place it",
"¡Ya tienes un compañero leal! A ver si la lealtad le dura mucho cuando empiece a salpicar la sangre.": "You've got yourself a loyal companion! Let's see how long that loyalty lasts once the blood starts splattering.",
"Antes de seguir, un truco útil: mantén pulsada la cara de tu personaje, abajo a la izquierda, y verás todas sus estadísticas. Con las unidades enemigas funciona igual: selecciónalas y mira de qué pasta están hechas… antes de que te hagan pasta a ti.": "Before we go on, a handy trick: hold down your unit's face, bottom left, and you'll see all its stats. It works the same with enemy units: select them and see what they're made of… before they make mincemeat of you.",
"Mantén pulsada su cara (3 s)": "Hold its face (3 s)",
"Ahora sabes cuánto aguanta, cuánto pega y cuánto le queda. Información de oro, y gratis.": "Now you know how much it can take, how hard it hits and how much it has left. Golden info, and free.",
"Uno solo se aburre, y yo me aburro con él. Recluta otro igual: Obelisco, Reclutar, personaje, RECLUTAR y casilla. Necesitarás a alguien a quien lanzar cosas (sí, cosas: yo soy una de ellas).": "One alone gets bored, and I get bored with it. Recruit another one just like it: Obelisk, Recruit, unit, RECRUIT and tile. You'll need someone to throw things at (yes, things: I'm one of them).",
"Recluta un segundo personaje": "Recruit a second unit",
"Dos pardillos mejor que uno. Así la culpa y los remordimientos se repartirán.": "Two suckers are better than one. That way the guilt and remorse get split.",
"Para dar instrucciones a una unidad hay que seleccionarla: pulsa sobre uno de tus aliados. Con cariño, no vayas a clavarle esa flecha puntiaguda voladora en el ojo.": "To give orders to a unit, you have to select it: tap one of your allies. Gently, please, unless you want to put that pointy flying arrow through its eye.",
"Selecciona una unidad": "Select a unit",
"¡Eso es! Qué sensación de poder, ¿verdad? Pues no te acostumbres.": "That's it! What a rush of power, huh? Don't get used to it.",
"Esos círculos del suelo te indican las zonas a donde puede moverse. Pulsa el que parpadea y se moverá. Ojo: andar gasta una de sus 2 acciones por turno; aquí hasta caminar tiene precio, como en la vida.": "Those circles on the ground show where it can move. Tap the blinking one and off it goes. Heads up: walking costs one of its 2 actions per turn. Even walking has a price here, just like in life.",
"Mueve la unidad hasta la zona marcada.": "Move the unit to the marked spot.",
"¡Está andando! Un milagro de la ingeniería orgánica, y sin tropezarse. Bueno, casi.": "It's walking! A miracle of organic engineering, and without tripping. Well, almost.",
"Ese arbusto tan mono no es decoración: es un escondite. Métete dentro y el rival dejará de verte (tú sí te ves, qué detalle). Eso sí: si alguien entra en un arbusto donde ya hay alguien escondido, se llevará un golpe y perderá sus acciones. Esconderse: el arte de no estar donde te buscan.": "That cute bush isn't decoration: it's a hiding spot. Get inside and your rival stops seeing you (you can still see yourself, how thoughtful). But beware: if someone enters a bush where someone is already hiding, they take a hit and lose their actions. Hiding: the art of not being where they look for you.",
"Escóndete en el arbusto": "Hide in the bush",
"Invisible. Como mi cuenta bancaria.": "Invisible. Just like my bank account.",
"¿Ves ese gnomo de ahí? El que tiembla como un flan. Es Tinkle, mi primo segundo. Aquí lo llamamos «balón». Acércate y pulsa la manita para cogerlo. Si hace falta, tu personaje caminará solo hasta él.": "See that gnome over there? The one shaking like jelly. That's Tinkle, my second cousin. Around here we call him \"the ball\". Walk up and tap the little hand to grab him. If needed, your unit will walk over by itself.",
"Coge a Tinkle": "Grab Tinkle",
"Tinkle, perdóname. Eras tú o yo.": "Tinkle, forgive me. It was you or me.",
"Y ahora lo MÁS ingenioso del juego: ¡Golpéalo! Cada golpe le suma puntos (cuanta más fuerza, más puntos) y esos puntos serán el daño de tu “estampada”. Nuestro deporte nacional, ¡yupi! Sí, ya sé que suena a locura. De hecho lo es.": "And now the MOST ingenious part of the game: Hit him! Every hit adds points to him (the more strength, the more points), and those points become the damage of your \"slam\". Our national sport, yippee! Yes, I know it sounds insane. Because it is.",
"Golpea al gnomo (icono del puño)": "Hit the gnome (fist icon)",
"¡Puntos! Tinkle, de toda la familia, tú siempre fuiste quien mejor encajaba los golpes. Bueno, el tío Klink era mejor, pero el tío Klink solo es un recuerdo, un recuerdo disperso sobre el césped...": "Points! Tinkle, of the whole family, you were always the one who took a beating best. Well, Uncle Klink was better, but Uncle Klink is just a memory now, a memory scattered across the grass...",
"Noticia: pasarse el balón también da puntos, por si en algún momento te duelen los nudillos. Pulsa el icono de lanzar y luego selecciona a tu amigo. Quien lanza gasta acción; quien recibe, no. Es lo más parecido a la justicia que verás por aquí.": "News flash: passing the ball also earns points, in case your knuckles start to ache. Tap the throw icon and then select your friend. The thrower spends an action; the receiver doesn't. It's the closest thing to justice you'll see around here.",
"Lánzale el gnomo a otra unidad.": "Throw the gnome to another unit.",
"¡Buen lanzamiento! Tinkle, ¿todo bien? Se te ve mareado.": "Nice throw! Tinkle, are you okay? You look dizzy.",
"Mientras uno carga con el gnomo no puede atacar, así que el que tenga las manos libres que se encargue de ese que te mira raro. Tranquilo, no devolverá el golpe (ni siquiera sabe, al pobre lo han programado para que no lo haga). Selecciona a tu personaje libre y pulsa al enemigo.": "While someone is carrying the gnome they can't attack, so whoever has free hands can deal with the guy giving you funny looks. Relax, he won't hit back (poor thing was programmed not to). Select your free unit and tap the enemy.",
"Ataca al enemigo": "Attack the enemy",
"Muy bien. Ahora seguro que le duele algo, y mañana también.": "Very good. Now something definitely hurts, and tomorrow too.",
"¿Ves ese pino? Y las rocas, y la mena de hierro: también se golpean. Tienen 2 puntos de resistencia y, al romperse, sueltan un recurso que vuela solito hasta tu mochila (abajo a la izquierda). Selecciona a tu personaje libre y pulsa el pino. Ojalá salga todo bien, toquemos madera.": "See that pine? And the rocks, and the iron ore: you can hit those too. They have 2 points of toughness and, when they break, they drop a resource that flies by itself to your backpack (bottom left). Select your free unit and tap the pine. Hopefully it all goes well, knock on wood.",
"Tala el pino (2 golpes)": "Chop down the pine (2 hits)",
"¡Madera conseguida! Ya puedes fabricarme un ataúd... o una mejora de armadura, que queda más elegante. En la armería de tu obelisco tienes las mejoras de equipo.": "Wood acquired! Now you can build me a coffin... or an armor upgrade, which is classier. Gear upgrades are in your obelisk's armory.",
"No hay nada mejor que conquistar un tótem con un gnomo cargado de puntos. Tu personaje lo estampa contra él y le resta tanta vida como puntos lleve. Si se queda sin puntos, el tótem es tuyo y te da Puntos de Gloria cada turno. Acércate con quien lleva el gnomo y pulsa la diana. Lo que la gente del gremio conoce como “estampada”.": "There's nothing better than conquering a totem with a gnome loaded with points. Your unit slams him against it and takes off as much health as the points he carries. If it runs out of points, the totem is yours and gives you Glory Points every turn. Walk up with whoever is carrying the gnome and tap the target. What guild folk call a \"slam\".",
"Haz una “estampada” con el gnomo contra el tótem": "Slam the gnome into the totem",
"¡Un tótem conquistado! ¿Tinkle? ¿Alguien puede llamar a emergencias? O a una funeraria...": "A totem conquered! Tinkle? Can someone call an ambulance? Or an undertaker...",
"Tu Obelisco guarda más trucos. Selecciónalo y abre Habilidades: tres ramas (Guerra, Protección y Supervivencia) con mejoras permanentes que se compran con Puntos de Gloria. Échale un vistazo y ciérrala con la X. No te pido que entiendas nada, de momento con que sepas que está ahí, es suficiente.": "Your Obelisk hides more tricks. Select it and open Skills: three branches (War, Protection and Survival) with permanent upgrades bought with Glory Points. Take a look and close it with the X. I'm not asking you to understand anything, just knowing it's there is enough for now.",
"Abre Habilidades y ciérrala": "Open Skills and close it",
"Demasiado árbol de habilidades para tan poco bosque.": "Too much skill tree for so little forest.",
"Y por último, la Armería: aquí gastas esa madera, roca y metal en subir el Arma y la Armadura de todos tus personajes, nivel a nivel (el 1 cuesta una madera y una roca). Es el único sitio de este juego donde la madera sirve para algo bueno. Ábrela y ciérrala.": "And finally, the Armory: here you spend that wood, rock and metal to upgrade the Weapon and Armor of all your units, level by level (level 1 costs one wood and one rock). It's the only place in this game where wood is good for something. Open it and close it.",
"Abre la Armería y ciérrala": "Open the Armory and close it",
"Ahora sabes dónde gastar los restos de la deforestación.": "Now you know where to spend the leftovers of deforestation.",
"Cuando tus unidades se queden sin acciones (o sin ganas), pulsa PASAR TURNO. Luego jugará el rival y luego vuelves tú… Y así sucesivamente. Es como la vida: esperas tu turno, esperas, esperas, estampas un gnomo contra el césped, vuelves a esperar...": "When your units run out of actions (or willpower), tap END TURN. Then the rival plays, then you again... And so on. It's like life: you wait for your turn, wait, wait, slam a gnome into the grass, wait again...",
"Pulsa PASAR TURNO": "Tap END TURN",
"Y el rival... no hizo nada. Era de esperar, esto es un tutorial.": "And the rival... did nothing. Figures, this is a tutorial.",
"Lo has conseguido. Ya sabes reclutar, mover, esconderte, coger gnomos, lanzarlos, estamparlos, atacar, talar, mejorar y conquistar. ¡Enhorabuena! Oficialmente ya eres todo un asesino de gnomos... aunque me parta lo poco que me queda de corazón o de lomo, según transcurra la partida. Y recuerda: si algún gnomo te mira raro, es que ya conoce tus intenciones.": "You did it. You now know how to recruit, move, hide, grab gnomes, throw them, slam them, attack, chop, upgrade and conquer. Congratulations! You're officially a full-blown gnome killer... even if it breaks what's left of my heart or my back, depending on how the match goes. And remember: if a gnome gives you funny looks, he already knows your intentions.",
"TERMINAR TUTORIAL": "FINISH TUTORIAL",
"MISIÓN {0}": "MISSION {0}",
"¡Listo!": "Done!",
"¡Eso no ha sido ni un segundo! Mantén pulsada la cara hasta que el contador llegue a cero, sin soltar. Tranquilo, yo no tengo prisa: es lo único que me sobra.": "That wasn't even a second! Keep the face pressed until the counter hits zero, without letting go. Relax, I'm in no hurry: it's the only thing I have plenty of.",
"¿Seguro? Pulsa otra vez": "Sure? Tap again",
"Un golem de corteza y musgo que nunca ha tenido prisa por llegar a ningún sitio, pero tampoco por caer.": "A bark-and-moss golem who has never been in a hurry to get anywhere, but never in a hurry to fall either.",
"Se desliza entre los árboles más rápido de lo que nadie puede seguirle la pista.": "Glides through the trees faster than anyone can track.",
"Experimenta con esporas explosivas y, milagrosamente, casi nunca se hace daño a sí mismo.": "Experiments with explosive spores and, miraculously, almost never hurts himself.",
"El mejor brazo del Equipo MascaRrocas — nadie lanza un gnomo más lejos ni más certero.": "The best arm on Team MascaRrocas — nobody throws a gnome farther or more accurately.",
"Piensa cada jugada tres veces antes de moverse, lo cual explica por qué siempre llega tarde.": "Thinks every move through three times before acting, which explains why he's always late.",
"Sus puños son más duros que la piedra de la que sacó el nombre.": "His fists are harder than the stone he took his name from.",
"Mantén pulsado para ver las estadísticas del personaje": "Hold to see the unit's stats",
"¡GOLPE MORTAL!": "DEADLY BLOW!",
"¡Conquistado!": "Conquered!",
"Gnomo": "Gnome",
"Nueva Partida": "New Game",
"Reanudar Partida": "Resume Game",
"Multijugador (próximamente)": "Multiplayer (coming soon)",
"Prototipo en construcción": "Prototype under construction",
"Volver": "Back",
"Elige el modo de juego": "Choose game mode",
"Elige tu raza": "Choose your race",
"Elige el nivel": "Choose the level",
"Elige el número de rivales": "Choose the number of rivals",
"Ajustes": "Settings",
"AJUSTES": "SETTINGS",
"Efectos de sonido": "Sound effects",
"Música": "Music",
"(próximamente)": "(coming soon)",
"Mostrar equipos": "Show teams",
"Modo rendimiento": "Performance mode",
"Sombras": "Shadows",
"Animación de niebla": "Fog animation",
"Vegetación": "Vegetation",
"Resolución adaptativa": "Adaptive resolution",
"Idioma": "Language",
"Salir de la partida": "Leave game",
"Cuenta": "Account",
"Cerrar": "Close",
"Equipo GuardaBosques": "Team GuardaBosques",
"Habitantes del bosque y expertos en setas explosivas: GolemCorteza, SurcaBosques y TruenoEspora.": "Forest dwellers and experts in explosive mushrooms: GolemCorteza, SurcaBosques and TruenoEspora.",
"Rápidos y ágiles: se mueven más casillas por turno y suelen golpear antes que el rival.": "Fast and agile: they move more tiles per turn and usually strike before the rival.",
"Poco aguante: caen en pocos golpes, hay que jugar con cuidado y no exponerlos de más.": "Low toughness: they fall in a few hits, so play carefully and don't overexpose them.",
"Equipo MascaRrocas": "Team MascaRrocas",
"Trolls de las colinas rocosas, tan duros de roer como su música: LanzaGnomos, UrgaMentes y PuñoRroca.": "Trolls from the rocky hills, as hard to crack as their music: LanzaGnomos, UrgaMentes and PuñoRroca.",
"Duros como la roca: aguantan mucho castigo y golpean con fuerza cuerpo a cuerpo.": "Hard as rock: they take a lot of punishment and hit hard in melee.",
"Más lentos: tardan más turnos en alcanzar la línea de combate.": "Slower: they take more turns to reach the front line.",
"Caza gnomos, cárgalos y machácalos en la base rival.": "Hunt gnomes, load them up and smash them at the enemy base.",
"Bosque MushBoom": "MushBoom Forest",
"Un bosque de ríos y lagos donde cualquier seta puede ser una bomba.": "A forest of rivers and lakes where any mushroom can be a bomb.",
"Setas explosivas: aparecen por el mapa de vez en cuando. Si recoges una, explota a los 3 turnos: 5 de daño al portador y a todo lo adyacente (unidades, tótems y Obeliscos, de cualquier bando).": "Explosive mushrooms: they appear on the map every now and then. If you pick one up, it explodes after 3 turns: 5 damage to the carrier and everything adjacent (units, totems and Obelisks, of any side).",
"Altar de Sacrificios: cada jugador tiene su propia barra de ofrendas. Entrega una seta o un gnomo junto al altar como ofrenda (una seta rellena 10 puntos); el primero en llenarla invoca al GnomOgro.": "Altar of Sacrifice: each player has their own offering bar. Deliver a mushroom or a gnome next to the altar as an offering (one mushroom fills 10 points); the first to fill it summons the GnomOgre.",
"GnomOgro: 30 de vida y 10 de ataque. Avanza hacia la base rival y la destruye si nadie lo detiene.": "GnomOgre: 30 health and 10 attack. It marches toward the enemy base and destroys it if nobody stops it.",
"Colinas Rock'n Troll": "Rock'n Troll Hills",
"Colinas rocosas con mecánicas propias, aún por revelar. Llegarán más adelante en el desarrollo.": "Rocky hills with their own mechanics, yet to be revealed. They'll arrive later in development.",
"Reclutar": "Recruit",
"Habilidades": "Skills",
"+2 / turno": "+2 / turn",
"Mochila": "Backpack",
"Turno 1 / 60": "Turn 1 / 60",
"RECLUTAR": "RECRUIT",
"HABILIDADES": "SKILLS",
"MEJORAR": "UPGRADE",
"ARMA": "WEAPON",
"Nivel 0/3": "Level 0/3",
"ARMADURA": "ARMOR",
"MOCHILA": "BACKPACK",
"Base de cada turno": "Base per turn",
"Sin bajas conseguidas este turno": "No kills this turn",
"Sin tótems conquistados": "No totems conquered",
"ENTRAR": "ENTER",
"REGISTRARSE": "SIGN UP",
"Correo o nombre de usuario": "Email or username",
"tu@correo.com o tu nombre": "you@email.com or your name",
"Contraseña": "Password",
"TIENDA GOBLIN": "GOBLIN SHOP",
"COMPRAR": "BUY",
"Este objeto cuesta 3 puntos de gloria.": "This item costs 3 glory points.",
"Este objeto cuesta 4 puntos de gloria.": "This item costs 4 glory points.",
"Este objeto cuesta 6 puntos de gloria.": "This item costs 6 glory points.",
"Totems capturados": "Totems captured",
"Bajas sufridas": "Casualties suffered",
"DERROTA": "DEFEAT",
"Se acabaron los 60 turnos — gana quien más resistió.": "The 60 turns are over — whoever endured the most wins.",
"EMPATE": "DRAW",
"Se acabaron los 60 turnos y todo sigue exactamente igualado.": "The 60 turns are over and everything is still exactly even.",
"Fuerza": "Strength",
"Aguante": "Toughness",
"Movimiento": "Movement",
"Agilidad": "Agility",
"Percepción": "Perception",
"Arma": "Weapon",
"Armadura": "Armor",
"Nivel {0}/{1}": "Level {0}/{1}",
"Habilidad especial": "Special skill",
"Turno {0} / {1}": "Turn {0} / {1}",
"+{0} / turno": "+{0} / turn",
"Vida": "Health",
"Ataque": "Attack",
"Daño": "Damage",
"Recursos": "Resources",
"Coste": "Cost",
"Nivel": "Level",
"Máximo": "Max",
"Aceptar": "Accept",
"Cancelar": "Cancel",
"Elige": "Choose",
"Equipo {0}": "Team {0}",
"{0} rivales": "{0} rivals",
"Nivel {0}": "Level {0}",
"Nivel máximo": "Max level",
"Gnomos": "Gnomes",
"— coste": "— cost",
"Recompensa": "Reward",
"Completada": "Completed",
"Continuar ▸": "Continue ▸",
"Sigue pulsando": "Keep holding",
"Demasiado pronto": "Too soon",
"Saltar tutorial": "Skip tutorial",
"Coste:": "Cost:",
"Coste: {0}": "Cost: {0}",
"Coste {0}": "Cost {0}"
};

(function () {
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const exact = new Map();
  const patterns = [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  Object.keys(EN_DICT).forEach((k) => {
    const en = EN_DICT[k];
    if (/\{\d+\}/.test(k)) {
      const order = [];
      const src = esc(norm(k)).replace(/\\\{(\d+)\\\}/g, (m, n) => {
        order.push(+n);
        return "(.+?)";
      });
      patterns.push({ re: new RegExp("^" + src + "$"), order, en, len: k.length });
    } else exact.set(norm(k), en);
  });
  patterns.sort((a, b) => b.len - a.len);

  function tr(text) {
    if (!text || typeof text !== "string") return text;
    const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = norm(m[2]);
    if (!core) return text;
    let out = exact.get(core);
    if (out === undefined) {
      for (const p of patterns) {
        const r = p.re.exec(core);
        if (!r) continue;
        out = p.en.replace(/\{(\d+)\}/g, (x, n) => {
          const idx = p.order.indexOf(+n);
          const v = idx >= 0 ? r[idx + 1] : "";
          return tr(v);
        });
        break;
      }
    }
    if (out === undefined) {
      // Listas de nombres unidas con " o " / " y " (p. ej. requisitos de habilidades).
      for (const [sep, en] of [[" o ", " or "], [" y ", " and "]]) {
        if (!core.includes(sep)) continue;
        const parts = core.split(sep).map((x) => tr(x));
        if (parts.every((x, i) => x !== core.split(sep)[i])) {
          out = parts.join(en);
          break;
        }
      }
    }
    return out === undefined ? text : m[1] + out + m[3];
  }

  const ATTRS = ["title", "aria-label", "placeholder", "alt"];
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);
  const textMem = new WeakMap(); // nodo -> { orig, out }
  const attrMem = new WeakMap(); // elemento -> { attr: { orig, out } }
  let observer = null;
  const isEn = () => I18N.currentLang === "en";

  function doText(node) {
    const v = node.nodeValue;
    const rec = textMem.get(node);
    if (rec && v === rec.out) return;
    const out = tr(v);
    if (out !== v) {
      textMem.set(node, { orig: v, out });
      node.nodeValue = out;
    }
  }
  function doAttrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a);
      const mem = attrMem.get(el) || {};
      if (mem[a] && v === mem[a].out) continue;
      const out = tr(v);
      if (out !== v) {
        mem[a] = { orig: v, out };
        attrMem.set(el, mem);
        el.setAttribute(a, out);
      }
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 || SKIP.has(root.tagName)) return;
    doAttrs(root);
    for (let n = root.firstChild; n; n = n.nextSibling) walk(n);
  }
  function restore(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      const rec = textMem.get(root);
      if (rec && root.nodeValue === rec.out) root.nodeValue = rec.orig;
      textMem.delete(root);
      return;
    }
    if (root.nodeType !== 1) return;
    const mem = attrMem.get(root);
    if (mem) {
      for (const a in mem) if (root.getAttribute(a) === mem[a].out) root.setAttribute(a, mem[a].orig);
      attrMem.delete(root);
    }
    for (let n = root.firstChild; n; n = n.nextSibling) restore(n);
  }

  function start() {
    if (observer) return;
    walk(document.body);
    observer = new MutationObserver((muts) => {
      observer.disconnect();
      muts.forEach((m) => {
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doAttrs(m.target);
        else m.addedNodes.forEach(walk);
      });
      connect();
    });
    connect();
  }
  function connect() {
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function stop() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    restore(document.body);
  }
  function sync() {
    if (isEn()) {
      if (observer) walk(document.body);
      else start();
    } else stop();
  }

  I18N.tr = (t) => (isEn() ? tr(t) : t);
  document.addEventListener("gg:langchange", () => setTimeout(sync, 0));
  document.addEventListener("DOMContentLoaded", sync);
})();
