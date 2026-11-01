/* Gnomore Gnomes — Gnomoteca: el libro del saber del juego.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Recordar qué ha visto el jugador (localStorage) y apuntarlo cuando algo aparece en pantalla durante una partida.
     - Reunir las fichas de unidades, equipos, escenarios, recursos, edificios y objetos a partir de los datos del propio
       juego (UNIT_TYPES, RACES, LEVELS...), así que lo que cambie en esos archivos se refleja aquí solo.
     - Pintar el libro (pantalla #screen-gnomoteca, abierta desde el botón del menú principal).
   Lo que aún no se ha visto sale como "???", con la descripción en blanco y el sprite convertido en una sombra oscura de un
   solo color; en cuanto se ve en partida, se desvela. Todo el texto es español literal: el traductor del juego
   (js/translate.js, EN_DICT) se ocupa del inglés. Estética: la misma "irregular" de todo el juego. */

const GNOMOTECA_KEY = "gnomoregnomes_gnomoteca";
const GNOMOTECA_ACH_KEY = "gnomoregnomes_gnomoteca_ach_";
const GNOMOTECA_XP_ENTRY = 10; // XP por cada entrada descubierta (se cobra una sola vez)

// Logros (coleccionables): icono Phosphor, explicación, XP que dan y cómo se mide el progreso.
//   kind: seen (entradas vistas) · all (todo el libro) · cat (una categoría completa) · st (contador de partidas)
//         lv (escenarios jugados) · tut (tutoriales hechos) · tut1 (un tutorial concreto, arg = id) · streak (racha de días) · level (nivel de cuenta)
const GNOMOTECA_ACH = [
{
"id": "c1",
"icon": "magnifying-glass",
"kind": "seen",
"arg": null,
"goal": 1,
"xp": 10,
"name": "Primer vistazo",
"desc": "Descubre tu primera entrada de la Gnomoteca: basta con ver algo nuevo en una partida, sea una unidad, un recurso o un edificio, y mi libro lo apunta solo. Cuesta lo mismo que respirar, pero no te acostumbres."
},
{
"id": "c10",
"icon": "binoculars",
"kind": "seen",
"arg": null,
"goal": 10,
"xp": 25,
"name": "Ojo de lince",
"desc": "Llega a 10 entradas descubiertas viendo cosas nuevas en tus partidas. No es difícil: solo hace falta tener ojos y un mínimo de curiosidad, dos cosas que de momento te he visto usar a ratos."
},
{
"id": "c25",
"icon": "books",
"kind": "seen",
"arg": null,
"goal": 25,
"xp": 50,
"name": "Rata de biblioteca",
"desc": "Alcanza las 25 entradas descubiertas. Para eso tendrás que jugar en escenarios distintos y mirar a tu alrededor; quedarte en tu base admirando el obelisco no cuenta, por mucho que lo adores."
},
{
"id": "c50",
"icon": "scroll",
"kind": "seen",
"arg": null,
"goal": 50,
"xp": 100,
"name": "Cronista del caos",
"desc": "Descubre 50 entradas. Sí, es muchísimo; el libro tiene páginas de sobra y yo, paciencia, ninguna. Prueba razas, escenarios y objetos distintos y vete apuntando."
},
{
"id": "call",
"icon": "seal-check",
"kind": "all",
"arg": null,
"goal": 0,
"xp": 300,
"name": "Gnomoteca completa",
"desc": "Descubre TODAS las entradas de la Gnomoteca, de la primera a la última. Es la tarea más larga del juego y la única que me impresionaría un poco. Un poco."
},
{
"id": "cu",
"icon": "users-three",
"kind": "cat",
"arg": "unidades",
"goal": 0,
"xp": 60,
"name": "Pasar lista",
"desc": "Descubre todas las unidades del libro: las tuyas, las del rival y hasta las que preferirías no haber visto. Hay que cruzártelas en partida; leer sus fichas desde el sofá no vale."
},
{
"id": "cr",
"icon": "tree",
"kind": "cat",
"arg": "recursos",
"goal": 0,
"xp": 30,
"name": "Saqueador profesional",
"desc": "Descubre todos los recursos: árboles, rocas, metal y compañía. Tienes que verlos con tus propios ojos, así que sal a explorar en vez de esperar a que lleguen solos a tu puerta."
},
{
"id": "ce",
"icon": "castle-turret",
"kind": "cat",
"arg": "edificios",
"goal": 0,
"xp": 40,
"name": "Arquitecto de ruinas",
"desc": "Descubre todos los edificios: obeliscos, tótems, tiendas y demás ruinas. Algunos solo aparecen en ciertos escenarios, así que te toca viajar, que para eso tienes piernas."
},
{
"id": "co",
"icon": "backpack",
"kind": "cat",
"arg": "objetos",
"goal": 0,
"xp": 50,
"name": "Mochila de coleccionista",
"desc": "Descubre todos los objetos del libro: cada uno se apunta al verlo o encontrarlo en una partida. Abre cofres y visita la Tienda Goblin, que algo tendrá a la venta, aunque sea mala leche."
},
{
"id": "ct",
"icon": "flag-banner",
"kind": "cat",
"arg": "equipos",
"goal": 0,
"xp": 40,
"name": "Fichaje de lujo",
"desc": "Descubre todos los equipos: para verlos en acción tendrás que jugar con ellos o plantarles cara en partida. Uno a uno, que nadie va a presentarse solo y menos con educación."
},
{
"id": "cl",
"icon": "map-trifold",
"kind": "cat",
"arg": "escenarios",
"goal": 0,
"xp": 40,
"name": "Turista del caos",
"desc": "Descubre todos los escenarios: hay que pisar cada mapa en una partida, aunque sea para perder estrepitosamente. Llévate la cámara y, si puedes, el sentido de la orientación."
},
{
"id": "g1",
"icon": "game-controller",
"kind": "st",
"arg": "games",
"goal": 1,
"xp": 15,
"name": "Bautizo de barro",
"desc": "Termina tu primera partida, ganes o pierdas, que eso es lo de menos. Lo importante es llegar hasta el final y no abandonar a medias como quien deja una novela mala."
},
{
"id": "g10",
"icon": "hourglass",
"kind": "st",
"arg": "games",
"goal": 10,
"xp": 40,
"name": "Vicio confirmado",
"desc": "Termina 10 partidas. Ganando, perdiendo o dando pena: todas cuentan igual para este logro. Solo hay que acabarlas y no dejarme a mí con la mesa puesta."
},
{
"id": "g50",
"icon": "fire",
"kind": "st",
"arg": "games",
"goal": 50,
"xp": 100,
"name": "Esto ya es un estilo de vida",
"desc": "Termina 50 partidas en total. A estas alturas ya no es afición, es una rutina, y yo soy tu testigo involuntario. Se van sumando entre sesiones, así que tranquilo."
},
{
"id": "w1",
"icon": "trophy",
"kind": "st",
"arg": "wins",
"goal": 1,
"xp": 25,
"name": "Esto no estaba previsto",
"desc": "Gana tu primera partida: destruye el obelisco rival o acaba por delante cuando se agoten los turnos. Alguien tenía que ganar alguna vez, estadísticamente hablando."
},
{
"id": "w10",
"icon": "medal",
"kind": "st",
"arg": "wins",
"goal": 10,
"xp": 75,
"name": "Racha de suerte",
"desc": "Gana 10 partidas en total. No hace falta que sean seguidas; bastante milagro es que lleguen a diez. Cada victoria suma, venga de donde venga."
},
{
"id": "w50",
"icon": "crown",
"kind": "st",
"arg": "wins",
"goal": 50,
"xp": 200,
"name": "Leyenda de barrio",
"desc": "Gana 50 partidas. A partir de aquí la gente empezará a evitar tu obelisco, así que prepárate para la soledad del campeón. Yo ya estoy acostumbrado."
},
{
"id": "k25",
"icon": "sword",
"kind": "st",
"arg": "kills",
"goal": 25,
"xp": 40,
"name": "Ni un gnomo a salvo",
"desc": "Acaba con 25 unidades rivales sumando todas tus partidas. Pegar, lanzar, estrellar… el método me da igual; el recuento, en cambio, lo llevo yo con mucho cariño."
},
{
"id": "k100",
"icon": "skull",
"kind": "st",
"arg": "kills",
"goal": 100,
"xp": 100,
"name": "Carnicería con estilo",
"desc": "Acaba con 100 unidades rivales en total. Se va acumulando de partida en partida, así que no hace falta hacerlo todo en un único día de furia, aunque se agradece."
},
{
"id": "t20",
"icon": "flag-banner",
"kind": "st",
"arg": "totems",
"goal": 20,
"xp": 40,
"name": "Coleccionista de tótems",
"desc": "Conquista 20 tótems en total: destruye uno neutral o rival y hazlo tuyo. Cada uno cuenta, aunque luego te lo roben, y se apunta al terminar la partida."
},
{
"id": "o1",
"icon": "users",
"kind": "st",
"arg": "online",
"goal": 1,
"xp": 40,
"name": "Hablando se entiende la gente",
"desc": "Termina una partida online contra otras personas. Con gente de verdad, que se ríe de ti en tiempo real y sin ningún respeto por tu dignidad."
},
{
"id": "ow1",
"icon": "globe",
"kind": "st",
"arg": "onlineWins",
"goal": 1,
"xp": 80,
"name": "Gana a un humano",
"desc": "Gana una partida online contra otro jugador humano. Las personas reales no se dejan ganar, y las que se dejan suelen ser familia, así que no cuentan como mérito."
},
{
"id": "mw1",
"icon": "skull",
"kind": "st",
"arg": "multiWin",
"goal": 1,
"xp": 60,
"name": "Uno contra todos",
"desc": "Gana una partida contra dos o más rivales a la vez. Tienes que sobrevivir a todos, no solo a uno, y conservar la calma. Un reto que mi paciencia no aguantaría."
},
{
"id": "lv",
"icon": "compass",
"kind": "lv",
"arg": null,
"goal": 0,
"xp": 70,
"name": "Trotamundos",
"desc": "Juega al menos una partida en cada escenario disponible, uno por uno. El truco está en no elegir siempre el mismo mapa por comodidad, que te veo venir."
},
{
"id": "tut_basic",
"icon": "student",
"kind": "tut1",
"arg": "basic",
"goal": 1,
"xp": 20,
"name": "Primeros tropiezos",
"desc": "Termina el tutorial «Primeros pasos» hasta el final, el de reclutar, mover, coger gnomos y pegar. Lo encuentras en Tutorial, en el menú principal. Es lo básico, y aun así ya te he visto fallar."
},
{
"id": "tut_mush",
"icon": "tree",
"kind": "tut1",
"arg": "mush",
"goal": 1,
"xp": 20,
"name": "Setas con mala idea",
"desc": "Completa el tutorial del Bosque MushBoom: setas explosivas, Altar de Sacrificios y GnomOgro. Lo encuentras en Tutorial, en el menú principal. Nadie ha salido de allí con las cejas intactas."
},
{
"id": "tut_rock",
"icon": "mountains",
"kind": "tut1",
"arg": "rock",
"goal": 1,
"xp": 20,
"name": "Piedra, papel y troll",
"desc": "Completa el tutorial de las Colinas Rock'n Troll: Tambores de Guerra, fragmentos y Volcán. Lo encuentras en Tutorial, en el menú principal. Hay mucho ruido, pero tú aguanta hasta el final."
},
{
"id": "tut_crane",
"icon": "egg",
"kind": "tut1",
"arg": "crane",
"goal": 1,
"xp": 20,
"name": "Huevo, rebote y a correr",
"desc": "Completa el tutorial del Poblado HurryCrane: Huevo de Grulla, bumpers y la Grulla. Lo encuentras en Tutorial, en el menú principal. Cuida del huevo, que luego pide cuentas."
},
{
"id": "tut_wall",
"icon": "castle-turret",
"kind": "tut1",
"arg": "wall",
"goal": 1,
"xp": 20,
"name": "Allanamiento de morada",
"desc": "Completa el tutorial de la Fortaleza WallForge: guardias, cámara sellada y Reliquia Paranoica. Lo encuentras en Tutorial, en el menú principal. Ojo: ahí hasta las paredes llevan armadura."
},
{
"id": "tut",
"icon": "graduation-cap",
"kind": "tut",
"arg": null,
"goal": 5,
"xp": 60,
"name": "Alumno de Nizak",
"desc": "Completa los 5 tutoriales hasta el final: Primeros pasos, Mushboom, Rock'n Troll, Hurrycrane y WallForge. Los doy yo, así que no te saltes ninguno que me ofendo."
},
{
"id": "s3",
"icon": "calendar-check",
"kind": "streak",
"arg": null,
"goal": 3,
"xp": 30,
"name": "Constancia de gnomo",
"desc": "Entra a jugar 3 días seguidos, sin saltarte ninguno. La constancia es la mitad del arte; la otra mitad no la tengo clara, pero seguro que implica café."
},
{
"id": "s7",
"icon": "calendar-check",
"kind": "streak",
"arg": null,
"goal": 7,
"xp": 80,
"name": "Obsesión saludable",
"desc": "Entra a jugar 7 días seguidos: una semana entera sin fallar. Es la prueba definitiva de que esto ya es algo más que un vicio y menos que un trabajo."
},
{
"id": "n5",
"icon": "arrow-fat-up",
"kind": "level",
"arg": null,
"goal": 5,
"xp": 50,
"name": "Subiendo escalones",
"desc": "Alcanza el nivel 5 de jugador. La experiencia se gana jugando partidas, descubriendo entradas del libro y desbloqueando logros como este. Todo suma, hasta lo que haces sin querer."
},
{
"id": "n10",
"icon": "diamond",
"kind": "level",
"arg": null,
"goal": 10,
"xp": 120,
"name": "Veterano",
"desc": "Alcanza el nivel 10. Para llegar necesitarás bastante experiencia: juega, descubre, desbloquea logros… y ya de paso hazme caso alguna vez, que te iría mejor."
},
{
"id": "n20",
"icon": "star",
"kind": "level",
"arg": null,
"goal": 20,
"xp": 250,
"name": "Gnomo de leyenda",
"desc": "Alcanza el nivel 20: el más alto de los logros de nivel. Solo llegará quien no tenga vida social, o sea, tú y yo. Hay que pasar por muchas partidas, aviso."
}
];

// Descripciones con el tono de Nizak (por id de entrada) y virtudes/debilidades de los equipos.
const GNOMOTECA_DESC = {
"o:oraculo_vigilante": "Carta del Oráculo. Disipa la niebla de todo el mapa durante 3 segundos y luego todo vuelve a cubrirse, como si nada. No va a la mochila, pero tampoco se queja. Tres segundos para espiar lo que no deberías.",
"o:oraculo_maldicion": "Carta del Oráculo. Si das la vuelta a una de estas, el Oráculo se bloquea unos turnos y las cartas se queman. Nadie la quiere, pero tampoco te preguntan si la quieres. Yo ya te avisé.",
"u:nizak": "El que te explica todo, aunque nadie se lo haya pedido. Escribe los textos del juego, cuenta los chistes malos y lleva la Gnomoteca como si fuera suya, que lo es. No se le puede pegar, no se le puede lanzar y créeme que lo he intentado.",
"o:seta_trampa": "La planta el SurcaBosques y se camufla de maravilla, sobre todo para sus propios compañeros. Quien la pisa descubre por qué se llama trampa. Nadie la ha visto venir, ni siquiera quien la puso.",
"b:muro": "El PortaMuros lo planta delante de sí por si acaso. Y el «por si acaso» suele caer encima de alguien. Es más resistente que la media y más ruidoso que la media.",
"o:pagina": "Se esparcen por todo el mapa cuando se libera la Reliquia. Quien lleve la Reliquia y pise una suma puntos que luego cobrará junto a su obelisco. Nadie sabe qué pone, y es mejor así.",
"b:cofre": "Hay uno por jugador, escondido en un rincón apartado. Un toque y se abre, y de dentro sale una reliquia para la mochila. Nunca falla: siempre llega justo cuando ya no te queda sitio en ella.",
"r:agua": "Mojada y poco recomendable para quien no sepa nadar. Ni las unidades ni los gnomos aprecian el chapuzón, pero siempre queda bien en el paisaje. Y alguna vez se le ha tirado algo a propósito.",
"r:lava": "Aparece cuando el volcán se enfada, y se enfada a menudo. Le da igual de qué equipo seas: todo lo que toca queda en una versión más oscura de sí mismo.",
"u:gnomo_fuego": "Cuando el volcán erupciona, suelta uno por cada unidad rival y todos salen corriendo hacia ellas. No dice nada, seguramente porque está ocupado ardiendo. Nunca se le pregunta si estaba de acuerdo.",
"o:madera": "La suelta un árbol tras dos golpes. Vale para subir cosas en el obelisco y para mirarla con orgullo. Hay gente que dice haber visto un árbol llorando, pero seguro que era resina.",
"o:piedra": "La suelta una roca tras dos golpes. Ni siente, ni padece, ni protesta: el material perfecto, y también el que más pesa en la mochila.",
"o:metal": "La suelta la mena de hierro, escasa a propósito para que te pelees por ella. Imprescindible para subir la armería al máximo y para hacerte el interesante.",
"o:setarcoiris": "Una seta a la que no se le puede negar nada: si se la dejas junto a una unidad, en dos turnos aparece un gnomo con hambre. La comida favorita de los gnomos, y de los que los lanzan.",
"o:bevida": "Un brebaje revitalizante del que nadie quiere conocer los ingredientes. Se lo das a una unidad aliada y recupera toda su vida. Tiene efectos secundarios, pero no los hemos probado.",
"o:atrapapinreles": "Un cepo goblin oxidado de los de toda la vida. Quien pisa su casilla pierde el turno y suelta lo que lleve. Se vende solo, porque nadie puede jurar que no lo pisará.",
"o:katapum": "Un cohete goblin casero y teledirigido, hasta cierto punto. Elige a un rival a la vista y vuela hacia él. Al explotar tira un dado, y el resultado depende de tu suerte, que ya conocemos.",
"o:totemvision": "Un tótem tallado con un ojo en la punta que ve más que tú. Colócalo en una casilla libre y da visión permanente alrededor. Lo único que no ve es que le estés dando órdenes.",
"o:senuelo": "Un muñeco de madera con forma de gnomo, cargado de pólvora. Tú lo ves como lo que es; el rival, como un gnomo suelto de lo más tentador. Quien se acerca, vuela.",
"o:oraculo_renacido": "Carta del Oráculo. Cuando una de tus unidades muere, ganas tantos puntos de Gloria como costó reclutarla. Beneficio pasivo, siempre activo. Morir sale rentable, al fin.",
"o:oraculo_afortunado": "Carta del Oráculo. Recibes 1 punto de Gloria por turno por cada tótem que controlen tus rivales. Cuanto peor te vaya, mejor te va.",
"o:oraculo_eterno": "Carta del Oráculo. Cuando una de tus unidades golpea a un gnomo, gana 1 punto de vida por golpe hasta su máximo. Pegar a gnomos es la mejor terapia.",
"b:volcan": "Se alimenta con gnomos sacrificados y piedras lanzadas. Apagado, es decoración; encendido, es un problema; en erupción, es un problema con gnomos en llamas corriendo hacia tus unidades. Nadie ha reclamado nunca el seguro.",
"b:tambor": "Un tambor neutral que da puntos a quien tenga más unidades pegadas a él al acabar el turno. Cada golpe a un gnomo junto al tambor también suma. Tocarlo no hace falta; con rodearlo basta, que para eso están los trolls.",
"b:bumper": "Un pinball con ínfulas de edificio. Cuando el huevo lo golpea rebota y sube el combo, y cada carambola suena más aguda que la anterior. Solo rebota una vez por turno, que tampoco hay que abusar.",
"u:grulla": "Aparece cuando el huevo explota y se posa en el obelisco del que más puntos sacó. Mientras esté ahí, nada de reclutar ni mejorar. Si le lanzas un gnomo se asusta y se va a molestar a otro. Muy profesional.",
"o:huevo": "Lánzale un gnomo y sale disparado en esa dirección, rebotando en bumpers, tótems y obeliscos. Cada rebote lo carga más, hasta que explota y reparte puntos. Nadie sabe qué hay dentro, pero tiene prisa por salir.",
"o:fragmento": "Astilla de roca que sueltan los Tambores de Guerra. Por ahora no sirve para nada, pero se apila en la mochila con una dignidad admirable.",
"o:seta": "Aparece suelta por el bosque de vez en cuando. Se coge, se lleva a la espalda y se lanza. Tiene mecha. No la sueltes de cualquier manera, a menos que odies a alguien.",
"r:arbusto": "Si te metes dentro, desapareces del radar y puedes dar la sorpresa a quien pase cerca. Los hay cerca de tótems y tiendas, que casualidad. Que nadie se fíe de un arbusto.",
"r:hierbajos": "Matojos de hierba y florecillas sin ninguna utilidad. No se pegan, no se cogen, no se lanzan. Aun así, el escenario sería más triste sin ellos y yo también.",
"u:gnomo": "Pequeño, barbudo y de una utilidad inmensa como proyectil. Nunca ha pedido que lo lancen, pero tampoco ha dicho que no. Cada golpe lo deja más cargado de puntos y más mareado de vida.",
"u:guardia": "Paranoico profesional, con armadura hasta en los pensamientos. Vigila la cámara sellada y persigue sin descanso a quien lleve la Reliquia, sea del equipo que sea. Lo único que lo detiene es un gnomo en la cara.",
"r:roca": "Una roca. Con dos golpes se rompe y suelta piedra para la mochila. Ni siente, ni padece, ni protesta: el recurso ideal.",
"r:pino": "Un árbol de los de toda la vida. Con dos golpes cae y suelta madera para la mochila. Tardó siglos en crecer y tú tardarás dos turnos en arreglarlo.",
"r:mena": "Mena de hierro, escasa a propósito para que te pelees por ella. Con dos golpes suelta metal, imprescindible para subir la armería al máximo.",
"b:obelisco_mushboom_forest": "Tronco hueco, setas de adorno y una base más acogedora de lo que merece. Desde aquí los GuardaBosques reclutan, aprenden trucos y hacen la contabilidad de bajas. Si cae, la partida también.",
"b:obelisco_colinas_rockntroll": "Roca sobre roca y mucho ruido de fondo. Aquí los MascaRrocas reclutan, mejoran su armería y planean a gritos su próxima salvajada. Si cae, se acabó el concierto.",
"b:obelisco_equipo_surcanubes": "Una base con aires de aeropuerto y papeleo de aerolínea. Los SurcaNubes reclutan, mejoran y despegan desde aquí, siempre con el seguro de vida sin firmar. Si cae, se pierde la partida y el equipaje.",
"b:obelisco_equipo_enmurallado": "Un obelisco reforjado a martillazos, con más muralla que gusto. Los Reforjados reclutan, mejoran y se esconden detrás. Si cae, la muralla ya no sirve para nada.",
"b:totem": "Capturarlo da Puntos de Gloria cada turno. Se defiende a flechazos y los ataques normales le hacen cosquillas. Cae simpático a todo el mundo, hasta que se lo quedan.",
"b:altar": "Aquí se ofrecen gnomos para ganar Gloria al instante. Nadie pregunta a los gnomos si están de acuerdo.",
"b:tienda": "Un goblin con muy mala leche y precios discretos. Repone el género cada cierto número de turnos y no da las gracias jamás.",
"b:oraculo": "Ocho cartas boca abajo, las mismas para todos. Pagas para girar dos y, si coinciden, te llevas el premio. Si no, te llevas la lección.",
"b:camara": "Una cámara sellada con cadenas en el centro del mapa. Las cadenas ceden cuando le estampas un gnomo cargado. Sí, un gnomo. Sí, es lo que parece.",
"o:trotamontes": "Botas pensadas para escalar montañas y no mirar atrás. Quien las calza llega siempre antes... y con ampollas.",
"o:acariciagnomos": "Un puño americano con pinchos dorados, ideal para acariciar gnomos a fondo. Ellos no lo piden; tú lo disfrutas igualmente.",
"o:ferognomas": "Perfume de feromonas de barba gnoma. Huele fatal, pero los gnomos acuden a ti como polillas a una lámpara con patas.",
"o:gnomeveo": "Gafas con nariz y bigote incluidos. Mirar al sol te quema la sombra; mirar gnomos, por suerte, no. Un disfraz totalmente innecesario y totalmente imprescindible.",
"o:gnomeda": "Oro puro de Rock'n Troll estampado contra un gnomo, sin querer. El gnomo no lo vio venir y tú tampoco, pero la paga llega puntual.",
"o:reliquia_paranoica": "Nadie sabe qué es ni para qué sirve, pero todos matarían por ella. Quien la lleva deja ondas en los pies y lo ve media isla. Muy discreta.",
"t:mushboom_forest": "Gente de bosque, pegada a las setas explosivas y a sus propios dedos (de momento). Son tres: GolemCorteza, SurcaBosques y TruenoEspora.",
"t:colinas_rockntroll": "Trolls de las colinas rocosas, tan duros de roer como su música: LanzaGnomos, UrgaMentes y PuñoRroca. Sutileza, la justa: ninguna.",
"t:equipo_surcanubes": "Gente de las nubes y de manos ligeras: ManosLargas, AlaFugaz y NidoBot. Si echas algo en falta, probablemente lo tienen ellos.",
"t:equipo_enmurallado": "Soldados de la gran muralla, tan bien guardados como bien armados: MagoNífico, TrazaFlechas y PortaMuros. Se han leído el manual de guerra entero, y lo han subrayado.",
"l:mushboom_forest": "Un bosque de ríos y lagos donde cualquier seta puede ser una bomba. Dar un paseo es una decisión arriesgada.",
"l:colinas_rockntroll": "Colinas rocosas con tambores que hacen llover piedras y un volcán en el centro con muy mal carácter.",
"l:hurrycrane_village": "Un poblado sobre las nubes, azotado por vientos que no descansan, con un huevo que rebota y una grulla con poca paciencia.",
"l:wallforge": "Una fortaleza flotante de muros, torres y paranoia, donde una reliquia cautiva suelta páginas por todo el mapa. Recógelas y llévalas a tu obelisco antes de que alguien te las quite, que lo harán."
};
const GNOMOTECA_EXTRA = {
"t:mushboom_forest": [
"Los más ágiles con el gnomo: SurcaBosques y TruenoEspora lo pasan casi siempre. Ven más lejos y llevan herramientas de zona: visión lejana y setas trampa. GolemCorteza es el tanque: se cura del todo y devuelve el daño con sus espinas. Un bosque entero que quiere hacerte daño.",
"Plantilla de cristal: SurcaBosques tiene 1 de vida y GolemCorteza solo avanza 2 casillas y casi nunca acierta al pasar el gnomo. Cada habilidad se usa una vez hasta volver junto a un tótem propio."
],
"t:colinas_rockntroll": [
"Controlan el campo a la fuerza: PuñoRroca empuja 4 casillas (y ahoga en el agua), LanzaGnomos lanza a cualquier unidad por el mapa y UrgaMentes toma el mando de un rival durante un turno. PuñoRroca es un muro de 4 de vida y 3 de fuerza.",
"Todo pasa por estar pegados al objetivo: sus habilidades necesitan una unidad adyacente. PuñoRroca da tumbos al azar si no empieza a andar con un aliado al lado, y LanzaGnomos y UrgaMentes aguantan poco (2 de vida). Mucha pose y poca salud."
],
"t:equipo_surcanubes": [
"Los más rápidos (ManosLargas llega a 4 casillas) y con más vida en conjunto: NidoBot tiene 5. Sus trucos cambian la partida: roban mochilas, caen del cielo hasta a 7 casillas y NidoBot explota en área hasta 3 casillas. Ya se verá si a tu favor.",
"Sus trucos se pagan con sangre: AlaFugaz se hace 1-3 de daño al aterrizar y NidoBot hasta 5 si incuba 3 turnos. ManosLargas tiene 1 de vida, pegan flojo y ven poco (percepción 1-2). Mucho truco y poca resistencia."
],
"t:equipo_enmurallado": [
"Dominan la información y el espacio: TrazaFlechas marca a un rival a 3 casillas y ve lo que ve él hasta que muere, MagoNífico se cambia de sitio con cualquier rival que veas y PortaMuros aplasta y deja inactivo al que tenga al lado. Ven muy lejos (percepción 4) y PortaMuros es un muro de 4 de vida y 3 de fuerza.",
"Frágiles y de poco pegar: MagoNífico y TrazaFlechas solo aguantan 1 golpe y PortaMuros avanza despacio (2 casillas). Sus trucos solo se usan una vez hasta recargar en un tótem, y el cambiazo se deshace al acabar el turno. Mucha estrategia, poco aguante."
]
};

const Gnomoteca = {
  seen: new Set(),
  cat: "unidades",
  sel: 0,
  _watchT: 0,
  _ready: false,
  _uid: null,
  _uid: null,
  _cloud: false,   // true cuando ya se leyó la nube (hasta entonces no se cobra XP ni se desbloquea nada)
  _dirty: false,   // hay algo nuevo que subir
  _pushT: 0,
  ach: new Set(),  // logros desbloqueados
  st: {},          // contadores de logros (partidas, victorias...) y "dx" = entradas ya cobradas
  _sig: "",
  _toastQ: [],
  _toastBusy: false,

  CATS: [
    { id: "unidades", label: "Unidades" },
    { id: "recursos", label: "Recursos" },
    { id: "edificios", label: "Edificios" },
    { id: "objetos", label: "Objetos" },
    { id: "equipos", label: "Equipos" },
    { id: "escenarios", label: "Escenarios" },
    { id: "logros", label: "Logros" },
  ],

  init() {
    try {
      const raw = localStorage.getItem(GNOMOTECA_KEY);
      if (raw) JSON.parse(raw).forEach((id) => this.seen.add(id));
    } catch (e) {}
    const btn = document.getElementById("btn-gnomoteca");
    if (btn) btn.addEventListener("click", () => this.open());
    this._startWatching();
    this._hookProgress();
    // Nube (Firestore gnomoteca/{uid}): UN documento con todo (ids vistos, logros y contadores). Una lectura al iniciar
    // sesión y escrituras solo cuando hay algo nuevo: agrupadas (90 s después del último cambio) o al salir de la pestaña.
    document.addEventListener("gg:authchange", (e) => this._onAuth(e.detail && e.detail.user));
    document.addEventListener("visibilitychange", () => { if (document.hidden) this._push(); });
    window.addEventListener("pagehide", () => this._push());
  },

  get _db() { return typeof Account !== "undefined" ? Account._db : null; },

  _loadLocalAch() {
    this.ach = new Set();
    this.st = {};
    try {
      const o = JSON.parse(localStorage.getItem(GNOMOTECA_ACH_KEY + this._uid) || "null");
      if (o) { (o.a || []).forEach((id) => this.ach.add(id)); Object.assign(this.st, o.st || {}); }
    } catch (e) {}
  },
  _saveLocal() {
    try { localStorage.setItem(GNOMOTECA_KEY, JSON.stringify([...this.seen])); } catch (e) {}
    if (this._uid) { try { localStorage.setItem(GNOMOTECA_ACH_KEY + this._uid, JSON.stringify({ a: [...this.ach], st: this.st })); } catch (e) {} }
  },
  _touch() {
    this._dirty = true;
    this._saveLocal();
    if (this._uid) { clearTimeout(this._pushT); this._pushT = setTimeout(() => this._push(), 90000); }
  },

  async _onAuth(user) {
    this._uid = user ? user.uid : null;
    this._cloud = false;
    this._sig = "";
    clearTimeout(this._pushT);
    this.ach = new Set();
    this.st = {};
    const db = this._db, uid = this._uid;
    if (!uid) return;
    this._loadLocalAch();
    if (!db) { this._cloud = true; return this._afterCloud(); }
    try {
      const snap = await db.collection("gnomoteca").doc(uid).get();
      if (uid !== this._uid) return;
      let need = false;
      if (snap.exists) {
        const d = snap.data();
        const ids = typeof d.ids === "string" && d.ids ? d.ids.split(",") : [];
        const rem = new Set(ids);
        ids.forEach((id) => { if (id) this.seen.add(id); });
        if (this.seen.size > rem.size) need = true; // lo que solo tenía este navegador, sube
        const ra = typeof d.a === "string" && d.a ? d.a.split(",") : [];
        const remA = new Set(ra);
        ra.forEach((id) => this.ach.add(id));
        if (this.ach.size > remA.size) need = true;
        const rs = d.st && typeof d.st === "object" ? d.st : {};
        Object.keys(rs).forEach((k) => { const v = +rs[k] || 0; if ((this.st[k] || 0) < v) this.st[k] = v; });
        Object.keys(this.st).forEach((k) => { if ((+rs[k] || 0) < this.st[k]) need = true; });
      } else need = this.seen.size > 0 || this.ach.size > 0 || Object.keys(this.st).length > 0;
      this._dirty = need;
      this._saveLocal();
      this._cloud = true;
      if (need) this._touch();
      this._afterCloud();
    } catch (e) { console.warn("gnomoteca:", e && e.code); }
  },
  _afterCloud() {
    // Progress carga su documento a la vez: se reintenta unos instantes hasta que esté listo.
    [800, 2500, 6000, 12000].forEach((t) => setTimeout(() => this._check(), t));
    if (this._ready && document.getElementById("screen-gnomoteca").classList.contains("screen--active")) this._render();
  },

  async _push() {
    clearTimeout(this._pushT);
    const db = this._db, uid = this._uid;
    if (!db || !uid || !this._cloud || !this._dirty) return;
    this._dirty = false;
    try {
      await db.collection("gnomoteca").doc(uid).set({ v: 1, ids: [...this.seen].join(","), a: [...this.ach].join(","), st: this.st });
    } catch (e) { this._dirty = true; console.warn("gnomoteca:", e && e.code); }
  },

  // ---------- Descubrimiento ----------
  discover(id) {
    if (!id || this.seen.has(id)) return false;
    this.seen.add(id);
    this._touch();
    return true;
  },

  // ---------- Logros ----------
  _hookProgress() {
    if (typeof Progress === "undefined" || Progress._gnomoHooked) return;
    Progress._gnomoHooked = true;
    const orig = Progress.onMatch, self = this;
    Progress.onMatch = function (m) {
      const r = orig.apply(this, arguments);
      try { if (r) self._onMatch(m || {}); } catch (e) {}
      return r;
    };
  },
  _onMatch(m) {
    const st = this.st, win = m.result === "win";
    const add = (k, n) => { if (n > 0) st[k] = (st[k] || 0) + n; };
    add("games", 1);
    add("wins", win ? 1 : 0);
    add("kills", m.kills || 0);
    add("totems", m.totems || 0);
    add("online", m.online ? 1 : 0);
    add("onlineWins", m.online && win ? 1 : 0);
    add("multiWin", win && (m.rivals || 1) >= 2 ? 1 : 0);
    if (m.level) st["lv:" + m.level] = 1;
    this._touch();
    this._sig = "";
    this._check();
  },

  // Entradas del libro (todas las categorías de contenido) y cuántas llevas vistas.
  _bookCount(cat) {
    const cats = cat ? [cat] : this.CATS.filter((c) => c.id !== "logros").map((c) => c.id);
    let n = 0, tot = 0;
    cats.forEach((c) => this.entries(c).forEach((e) => { tot++; if (this.seen.has(e.id)) n++; }));
    return { n, tot };
  },
  _prog(a) {
    const g = a.goal;
    switch (a.kind) {
      case "seen": return { cur: Math.min(g, this._bookCount().n), goal: g };
      case "all": { const b = this._bookCount(); return { cur: b.n, goal: b.tot }; }
      case "cat": { const b = this._bookCount(a.arg); return { cur: b.n, goal: b.tot }; }
      case "st": return { cur: Math.min(g, this.st[a.arg] || 0), goal: g };
      case "lv": {
        const tot = (typeof LEVELS !== "undefined" ? LEVELS : []).filter((l) => l.available !== false).length || 4;
        return { cur: Math.min(tot, Object.keys(this.st).filter((k) => k.indexOf("lv:") === 0).length), goal: tot };
      }
      case "tut": {
        const T = typeof Tutorial !== "undefined" && Tutorial.isDone ? Tutorial : null;
        return { cur: T ? ["basic", "mush", "rock", "crane", "wall"].filter((id) => T.isDone(id)).length : 0, goal: g };
      }
      case "tut1": return { cur: typeof Tutorial !== "undefined" && Tutorial.isDone && Tutorial.isDone(a.arg) ? 1 : 0, goal: 1 };
      case "streak": return { cur: Math.min(g, typeof Progress !== "undefined" && Progress._s ? Progress.s.streak || 0 : 0), goal: g };
      case "level": return { cur: Math.min(g, typeof Progress !== "undefined" && Progress._s ? Progress.level : 0), goal: g };
    }
    return { cur: 0, goal: g || 1 };
  },
  // Cobra XP por entradas nuevas y desbloquea logros. Solo con sesión iniciada y la nube ya leída.
  _check() {
    if (!this._uid || !this._cloud || typeof Progress === "undefined" || !Progress._loaded || Progress._uid !== this._uid) return;
    let tut = 0;
    try { tut = typeof Tutorial !== "undefined" && Tutorial.isDone ? ["basic", "mush", "rock", "crane", "wall"].filter((id) => Tutorial.isDone(id)).length : 0; } catch (e) {}
    const sig = this.seen.size + "|" + JSON.stringify(this.st) + "|" + this.ach.size + "|" + Progress.level + "|" + (Progress.s.streak || 0) + "|" + tut;
    if (sig === this._sig) return;
    this._sig = sig;
    const owed = this.seen.size - (this.st.dx || 0);
    if (owed > 0 && Progress.addXp(owed * GNOMOTECA_XP_ENTRY)) {
      this.st.dx = this.seen.size;
      this._touch();
      this._toast({ icon: "book-open-text", xp: owed * GNOMOTECA_XP_ENTRY });
    }
    GNOMOTECA_ACH.forEach((a) => {
      if (this.ach.has(a.id)) return;
      const p = this._prog(a);
      if (p.goal > 0 && p.cur >= p.goal && Progress.addXp(a.xp)) {
        this.ach.add(a.id);
        this._touch();
        this._toast({ icon: a.icon, name: a.name, xp: a.xp, gold: true });
      }
    });
    this._sig = "";
  },

  // Aviso compacto arriba: icono, nombre del logro y XP. Se encolan para no pisarse.
  _toast(o) {
    this._toastQ.push(o);
    if (!this._toastBusy) this._nextToast();
  },
  _nextToast() {
    const o = this._toastQ.shift();
    if (!o) { this._toastBusy = false; return; }
    this._toastBusy = true;
    const el = document.createElement("div");
    el.className = "gnomo-toast" + (o.gold ? " gnomo-toast--gold" : "");
    el.innerHTML = `<i class="ph-bold ph-${this._esc(o.icon)} gnomo-toast__ico"></i><span class="gnomo-toast__tx"><small>${o.gold ? "Logro desbloqueado" : "Gnomoteca"}</small>${o.name ? `<strong>${this._esc(o.name)}</strong>` : ""}</span><em class="gnomo-toast__xp"><b>+${o.xp}</b> XP</em>`;
    document.body.appendChild(el);
    try { if (typeof SFX !== "undefined" && SFX.enabled) (SFX.missionDone || SFX.click).call(SFX); } catch (e) {}
    const done = () => { el.remove(); setTimeout(() => this._nextToast(), 250); };
    if (!el.animate) return setTimeout(done, 3600);
    el.animate([
      { transform: "translate(-50%,-140%) rotate(-3deg) scale(.9)", opacity: 0 },
      { transform: "translate(-50%,8%) rotate(1.5deg) scale(1.06,.94)", opacity: 1, offset: .5 },
      { transform: "translate(-50%,0) rotate(-0.8deg) scale(.98,1.03)", offset: .75 },
      { transform: "translate(-50%,0) rotate(-0.6deg) scale(1)" },
    ], { duration: 480, easing: "ease-out", fill: "forwards" }).onfinish = () => {
      setTimeout(() => {
        el.animate([{ transform: "translate(-50%,0) rotate(-0.6deg)", opacity: 1 }, { transform: "translate(-50%,-140%) rotate(2deg)", opacity: 0 }], { duration: 320, easing: "ease-in", fill: "forwards" }).onfinish = done;
      }, 3200);
    };
  },

  // Mientras hay una partida en pantalla, cada 1,5 s se apunta lo que se ve (nada de trabajo por fotograma).
  _startWatching() {
    if (this._watchT) return;
    this._watchT = setInterval(() => {
      const board = document.getElementById("screen-board");
      if (!board || !board.classList.contains("screen--active") || document.hidden) return;
      this._scanBoard();
    }, 1500);
  },

  _visible(el) {
    return !!el && !el.closest(".unit--fog-hidden");
  },

  _scanBoard() {
    // Escenario y equipo elegidos, y las mecánicas propias del escenario.
    if (typeof LevelAssets !== "undefined" && LevelAssets.current) { this.discover("l:" + LevelAssets.current); }
    if (typeof Tutorial !== "undefined" && Tutorial.active) this.discover("u:nizak");
    if (typeof matchDraft !== "undefined" && matchDraft.raceId) this.discover("t:" + matchDraft.raceId);
    // Unidades (de cualquier bando) mientras no estén en la niebla.
    if (typeof Units !== "undefined" && Units.list) {
      Units.list.forEach((u) => {
        if (!u.el || !this._visible(u.el)) return;
        this.discover("u:" + u.typeId);
        const t = typeof UNIT_TYPES !== "undefined" ? UNIT_TYPES[u.typeId] : null;
        if (t && t.raceId) this.discover("t:" + t.raceId);
      });
    }
    if (typeof Gnome !== "undefined" && Gnome.list && Gnome.list.some((g) => g.el && this._visible(g.el))) this.discover("u:gnomo");
    // Recursos de escenario.
    if (typeof Resources !== "undefined" && Resources.list) {
      Resources.list.forEach((n) => { if (n.el && this._visible(n.el)) this.discover("r:" + n.kind); });
    }
    // Edificios y estructuras.
    const q = (sel, id) => { const e = document.querySelector(sel); if (e && this._visible(e)) this.discover(id); };
    if (typeof Obelisks !== "undefined" && Obelisks.list && typeof Teams !== "undefined") {
      Obelisks.list.forEach((o) => { const rid = Teams.raceIds && Teams.raceIds[o.team]; if (rid && o.el && this._visible(o.el)) this.discover("b:obelisco_" + rid); });
    }
    if (typeof matchDraft !== "undefined" && matchDraft.raceId) this.discover("b:obelisco_" + matchDraft.raceId);
    q(".village__sprite", "b:totem");
    q(".altar__sprite", "b:altar");
    q(".shop__sprite:not(.oracle__sprite)", "b:tienda");
    q(".oracle__sprite", "b:oraculo");
    q(".reliquia-altar", "b:camara");
    q(".reliquia-guard", "u:guardia");
    const qa = (sel, id) => { if ([...document.querySelectorAll(sel)].some((e) => this._visible(e))) this.discover(id); };
    qa(".volcano__sprite", "b:volcan");
    qa(".drum__sprite", "b:tambor"); // los tambores sueltan fragmentos de roca
    qa(".drum__sprite", "o:fragmento");
    qa(".bumper__sprite", "b:bumper");
    qa(".crane", "u:grulla");
    qa(".egg", "o:huevo");
    qa(".mushroom-loose", "o:seta");
    qa(".bush__sprite", "r:arbusto");
    qa(".hierbajo__sprite", "r:hierbajos");
    qa(".ability-mine", "o:seta_trampa");
    qa(".ew-shield", "b:muro");
    qa(".reliquia-page", "o:pagina");
    if (typeof Volcano !== "undefined" && Volcano.lava && Volcano.lava.some((l) => l.el && this._visible(l.el))) this.discover("r:lava");
    if (typeof Volcano !== "undefined" && Volcano.burners && Volcano.burners.length) this.discover("u:gnomo_fuego");
    if (typeof LevelAssets !== "undefined" && LevelAssets.current) this.discover("r:agua");
    if (typeof Resources !== "undefined" && Resources.list) {
      Resources.list.forEach((n) => {
        if (!n.el || !this._visible(n.el)) return;
        if (n.kind === "cofre") this.discover("b:cofre");
        const rid = { pino: "o:madera", roca: "o:piedra", mena: "o:metal" }[n.kind];
        if (rid) this.discover(rid);
      });
    }
    if (typeof Backpack !== "undefined" && Backpack.inventory) Backpack.inventory.forEach((it) => this.discover("o:" + it.itemId));
    // Objetos: reliquias de la mochila y la Reliquia Paranoica.
    if (typeof Relics !== "undefined" && Relics.byTeam && Relics.byTeam.player) Relics.byTeam.player.forEach((r) => this.discover("o:" + r.relicId));
    if (typeof Reliquia !== "undefined" && Reliquia.relic && Reliquia.relic.state && Reliquia.relic.state !== "altar") this.discover("o:reliquia_paranoica");    this._check();
  },

  // ---------- Datos ----------
  _race(raceId) {
    return typeof RACES !== "undefined" ? RACES.find((r) => r.id === raceId) : null;
  },
  _tr(key) {
    return typeof I18N !== "undefined" ? I18N.t(key) : key;
  },

  // Un Obelisco por equipo: se descubre al verlo con la visión de una unidad o al elegir ese equipo.
  _obeliscos() {
    const files = { mushboom_forest: "mushboom_forest", colinas_rockntroll: "colinas_rockntroll", equipo_surcanubes: "surcanubes", equipo_enmurallado: "enmurallado" };
    const pre = typeof I18N !== "undefined" && I18N.tr ? I18N.tr("Obelisco") : "Obelisco";
    return (typeof RACES !== "undefined" ? RACES : []).filter((r) => files[r.id]).map((r) => ({
      id: "b:obelisco_" + r.id, name: pre + " " + this._tr(r.nameKey).replace(/^(Equipo|Team)\s+/, ""), type: "Estructura · base",
      img: "assets/edificios/obelisco_" + files[r.id] + "_midres.png",
      desc: "Tu base. Desde él reclutas unidades, eliges habilidades y mejoras en la armería. Si cae, pierdes la partida.",
      chips: ["Si cae, pierdes", "Recluta y mejora"],
    }));
  },

  entries(cat) {
    const out = [];
    if (cat === "unidades") {
      out.push({
        id: "u:gnomo", name: "Gnomo", type: "Unidad básica", img: "assets/equipos/MushboomForest/gnomo_idle.png",
        desc: "Pequeño, barbudo y sorprendentemente útil como proyectil. Se lanza contra recursos, guardias y páginas, y se carga de puntos al golpear.",
        chips: ["Se puede lanzar", "Una unidad solo carga un gnomo"],
      });
      if (typeof UNIT_TYPES !== "undefined") {
        const maxOf = (k) => Math.max(5, ...Object.values(UNIT_TYPES).map((t) => t[k] || 0));
        Object.keys(UNIT_TYPES).forEach((id) => {
          const t = UNIT_TYPES[id];
          const race = this._race(t.raceId);
          const ab = typeof ABILITIES !== "undefined" ? ABILITIES[id] : null;
          out.push({
            id: "u:" + id, name: t.name, type: race ? this._tr(race.nameKey) : "Unidad", img: t.spriteUrl,
            desc: typeof UNIT_DESCRIPTIONS !== "undefined" ? UNIT_DESCRIPTIONS[id] || "" : "",
            stats: [["Aguante", t.aguante, maxOf("aguante")], ["Movimiento", t.movimiento, maxOf("movimiento")], ["Fuerza", t.fuerza, maxOf("fuerza")], ["Agilidad", t.agilidad, maxOf("agilidad")], ["Percepción", t.percepcion, maxOf("percepcion")]],
            extra: ab ? [[ab.name, ab.description]] : [],
          });
        });
      }
      out.push({
        id: "u:guardia", name: "Guardia de la Reliquia", type: "Neutral · Fortaleza WallForge", img: "assets/niveles/wallforge/guardia.png",
        desc: "Paranoico profesional. Vigila la cámara sellada y persigue sin descanso a quien lleve la Reliquia, sea del equipo que sea.",
        chips: ["Inmortal", "Solo se marea con un gnomo lanzado"],
      });
      out.push({ id: "u:grulla", name: "La Grulla", type: "Neutral · HurryCrane", img: "assets/niveles/hurrycrane/grulla_posada.png", desc: "Aparece cuando el huevo explota y se posa en el obelisco del que más puntos sacó. Mientras esté ahí, nada de reclutar ni mejorar. Si le lanzas un gnomo se asusta y se va a molestar a otro. Muy profesional.", chips: ["Bloquea un obelisco", "Se asusta si le lanzas un gnomo"] });
      out.push({ id: "u:gnomo_fuego", name: "Gnomo en llamas", type: "Neutral · Rock'n Troll", img: "assets/niveles/rockntroll/gnomo_fuego_corre.png", desc: "Cuando el volcán erupciona, suelta uno por cada unidad rival y todos salen corriendo hacia ellas. No dice nada, seguramente porque está ocupado ardiendo. Nunca se le pregunta si estaba de acuerdo.", chips: ["Sale con la erupción", "Corre hacia las unidades rivales"] });
      out.push({ id: "u:nizak", name: "Nizak", type: "Narrador · Tutoriales", img: "assets/tutorial/nizak_normal.png", desc: "El que te explica todo, aunque nadie se lo haya pedido. Escribe los textos del juego, cuenta los chistes malos y lleva la Gnomoteca como si fuera suya, que lo es. No se le puede pegar, no se le puede lanzar y créeme que lo he intentado.", chips: ["No combate", "Da los tutoriales"] });
    } else if (cat === "recursos") {
      const R = typeof RESOURCE_NODE_TYPES !== "undefined" ? RESOURCE_NODE_TYPES : {};
      const txt = {
        roca: "Fuente de roca. Con dos golpes se rompe y suelta roca para la mochila.",
        pino: "Árbol de madera. Con dos golpes cae y suelta madera para la mochila.",
        mena: "Mena de metal, escasa a propósito. Con dos golpes suelta metal, necesario para subir la armería al máximo.",
      };
      Object.keys(R).forEach((k) => out.push({
        id: "r:" + k, name: k === "pino" ? "Árbol" : k === "mena" ? "Mena de Hierro" : "Roca", type: "Recurso · neutral",
        img: R[k].spriteUrl.replace(/\.png$/, "_midres.png"), desc: txt[k] || "", chips: ["Bloquea el paso", "Se rompe con dos golpes"],
      }));
      out.push({ id: "r:arbusto", name: "Arbusto", type: "Escenario · escondite", img: "assets/iconos/arbusto.png", desc: "Si te metes dentro, desapareces del radar y puedes dar la sorpresa a quien pase cerca. Los hay cerca de tótems y tiendas, que casualidad. Que nadie se fíe de un arbusto.", chips: ["Esconde unidades", "Bloquea la vista"] });
      out.push({ id: "r:hierbajos", name: "Hierbajos", type: "Escenario · decoración", img: "assets/escenario/hierbajos.png", desc: "Matojos de hierba y florecillas sin ninguna utilidad. No se pegan, no se cogen, no se lanzan. Aun así, el escenario sería más triste sin ellos y yo también.", chips: ["Solo decoración"] });
      out.push({ id: "r:agua", name: "Agua", type: "Terreno", img: "assets/losetas/agua_02.png", desc: "Mojada y poco recomendable para quien no sepa nadar. Ni las unidades ni los gnomos aprecian el chapuzón, pero siempre queda bien en el paisaje. Y alguna vez se le ha tirado algo a propósito.", chips: ["No se puede pisar", "Sacrificio de gnomos"] });
      out.push({ id: "r:lava", name: "Lava", type: "Terreno · Rock'n Troll", img: "assets/niveles/rockntroll/lava_1.png", desc: "Aparece cuando el volcán se enfada, y se enfada a menudo. Le da igual de qué equipo seas: todo lo que toca queda en una versión más oscura de sí mismo.", chips: ["Sale con la erupción", "Quema"] });
    } else if (cat === "edificios") {
      out.push(
        ...this._obeliscos(),
        { id: "b:totem", name: "Tótem", type: "Estructura · capturable", img: "assets/iconos/poblado_neutral_midres.png", desc: "Capturarlo da Puntos de Gloria cada turno. Se defiende con flechas y no sufre daño de ataques normales.", chips: ["Da Gloria", "Capturable"] },
        { id: "b:altar", name: "Altar de Sacrificios", type: "Estructura · MushBoom", img: "assets/edificios/altar_sacrificios_lleno_midres.png", desc: "Aquí se ofrecen gnomos para ganar Gloria al instante.", chips: ["Sacrificio"] },
        { id: "b:tienda", name: "Tienda Goblin", type: "Estructura · comercio", img: "assets/edificios/tienda_goblin_midres.png", desc: "Un goblin con muy mala leche y buenos precios. Se repone cada cierto número de turnos.", chips: ["Compra con Gloria"] },
        { id: "b:oraculo", name: "Oráculo", type: "Estructura · cartas", img: "assets/edificios/oraculo_midres.png", desc: "Ocho cartas boca abajo, las mismas para todos. Paga para girar dos; si coinciden, ganas su beneficio.", chips: ["Cartas", "Coste creciente"] },
        { id: "b:camara", name: "Cámara de la Reliquia", type: "Estructura · WallForge", img: "assets/niveles/wallforge/altar_sellado.png", desc: "Cámara sellada con cadenas en el centro del mapa. Las cadenas ceden cuando se lanza contra ella un gnomo cargado.", chips: ["Centro del mapa", "Se resella al devolver la Reliquia"] },
      );
      out.push({ id: "b:volcan", name: "Volcán", type: "Estructura · Rock'n Troll", img: "assets/niveles/rockntroll/volcan_encendido.png", desc: "Se alimenta con gnomos sacrificados y piedras lanzadas. Apagado, es decoración; encendido, es un problema; en erupción, es un problema con gnomos en llamas corriendo hacia tus unidades. Nadie ha reclamado nunca el seguro.", chips: ["Centro del mapa", "Se carga hasta 20"] });
      out.push({ id: "b:tambor", name: "Tambor de Guerra", type: "Estructura · Rock'n Troll", img: "assets/niveles/rockntroll/tambor.png", desc: "Un tambor neutral que da puntos a quien tenga más unidades pegadas a él al acabar el turno. Cada golpe a un gnomo junto al tambor también suma. Tocarlo no hace falta; con rodearlo basta, que para eso están los trolls.", chips: ["Neutral", "Gana quien tenga más unidades al lado"] });
      out.push({ id: "b:bumper", name: "Bumper", type: "Estructura · HurryCrane", img: "assets/niveles/hurrycrane/bumper.png", desc: "Un pinball con ínfulas de edificio. Cuando el huevo lo golpea rebota y sube el combo, y cada carambola suena más aguda que la anterior. Solo rebota una vez por turno, que tampoco hay que abusar.", chips: ["Bloquea el paso", "Rebota el huevo"] });
      out.push({ id: "b:muro", name: "Muro aplastante", type: "Habilidad · Reforjados", img: "assets/equipos/EquipoEnmurallado/escudo_muro.png", desc: "El PortaMuros lo planta delante de sí por si acaso. Y el «por si acaso» suele caer encima de alguien. Es más resistente que la media y más ruidoso que la media.", chips: ["Bloquea el paso", "Aplasta a quien pille debajo"] });
      out.push({ id: "b:cofre", name: "Cofre de Reliquias", type: "Estructura · neutral", img: "assets/iconos/cofre_cerrado.png", desc: "Hay uno por jugador, escondido en un rincón apartado. Un toque y se abre, y de dentro sale una reliquia para la mochila. Nunca falla: siempre llega justo cuando ya no te queda sitio en ella.", chips: ["Un toque lo abre", "Suelta una reliquia"] });
    } else if (cat === "objetos") {
      const RT = typeof RELIC_TYPES !== "undefined" ? RELIC_TYPES : {};
      Object.keys(RT).forEach((id) => out.push({ id: "o:" + id, name: RT[id].name, type: "Reliquia de la mochila", img: RT[id].iconUrl, desc: RT[id].description, chips: ["Aguanta " + RT[id].durability + " bajas"] }));
      out.push({ id: "o:reliquia_paranoica", name: "Reliquia Paranoica", type: "Objeto único · WallForge", img: "assets/niveles/wallforge/reliquia.png", desc: "Quien la lleva deja ondas en los pies y todos lo ven, a él y lo que ve. Gana puntos con las páginas y los cobra al llegar junto a su obelisco.", chips: ["Visible para todos", "Si el portador cae, queda en el suelo"] });
      out.push({ id: "o:huevo", name: "Huevo de Grulla", type: "Objeto único · HurryCrane", img: "assets/niveles/hurrycrane/huevo.png", desc: "Lánzale un gnomo y sale disparado en esa dirección, rebotando en bumpers, tótems y obeliscos. Cada rebote lo carga más, hasta que explota y reparte puntos. Nadie sabe qué hay dentro, pero tiene prisa por salir.", chips: ["Rebota por el mapa", "Explota al nivel 10"] });
      out.push({ id: "o:fragmento", name: "Fragmento de roca", type: "Recurso · Rock'n Troll", img: "assets/niveles/rockntroll/fragmento.png", desc: "Astilla de roca que sueltan los Tambores de Guerra. Por ahora no sirve para nada, pero se apila en la mochila con una dignidad admirable.", chips: ["Se apila en la mochila"] });
      out.push({ id: "o:seta", name: "Seta explosiva", type: "Objeto · MushBoom", img: "assets/iconos/seta_suelta.png", desc: "Aparece suelta por el bosque de vez en cuando. Se coge, se lleva a la espalda y se lanza. Tiene mecha. No la sueltes de cualquier manera, a menos que odies a alguien.", chips: ["Se coge como un gnomo", "Explota"] });
      out.push({ id: "o:seta_trampa", name: "Seta trampa", type: "Habilidad · SurcaBosques", img: "assets/iconos/seta_trampa.png", desc: "La planta el SurcaBosques y se camufla de maravilla, sobre todo para sus propios compañeros. Quien la pisa descubre por qué se llama trampa. Nadie la ha visto venir, ni siquiera quien la puso.", chips: ["Se planta en una casilla", "Explota al pisarla"] });
      out.push({ id: "o:pagina", name: "Página de la Reliquia", type: "Objeto · WallForge", img: "assets/niveles/wallforge/pagina.png", desc: "Se esparcen por todo el mapa cuando se libera la Reliquia. Quien lleve la Reliquia y pise una suma puntos que luego cobrará junto a su obelisco. Nadie sabe qué pone, y es mejor así.", chips: ["Pisarla da puntos al portador", "Salen al abrir la cámara"] });
      out.push({ id: "o:madera", name: "Madera", type: "Recurso de la mochila", img: "assets/iconos/recurso_madera.png", desc: "La suelta un árbol tras dos golpes. Vale para subir cosas en el obelisco y para mirarla con orgullo. Hay gente que dice haber visto un árbol llorando, pero seguro que era resina.", chips: ["Se apila en la mochila"] });
      out.push({ id: "o:piedra", name: "Piedra", type: "Recurso de la mochila", img: "assets/iconos/recurso_roca.png", desc: "La suelta una roca tras dos golpes. Ni siente, ni padece, ni protesta: el material perfecto, y también el que más pesa en la mochila.", chips: ["Se apila en la mochila"] });
      out.push({ id: "o:metal", name: "Metal", type: "Recurso de la mochila", img: "assets/iconos/recurso_metal.png", desc: "La suelta la mena de hierro, escasa a propósito para que te pelees por ella. Imprescindible para subir la armería al máximo y para hacerte el interesante.", chips: ["Se apila en la mochila"] });
      out.push({ id: "o:setarcoiris", name: "Setarcoiris", type: "Objeto de la mochila", img: "assets/iconos/setarcoiris.png", desc: "Una seta a la que no se le puede negar nada: si se la dejas junto a una unidad, en dos turnos aparece un gnomo con hambre. La comida favorita de los gnomos, y de los que los lanzan.", chips: ["Se coloca en una casilla", "Atrae a un gnomo"] });
      out.push({ id: "o:bevida", name: "BebeVida", type: "Objeto de la mochila", img: "assets/iconos/bevida.png", desc: "Un brebaje revitalizante del que nadie quiere conocer los ingredientes. Se lo das a una unidad aliada y recupera toda su vida. Tiene efectos secundarios, pero no los hemos probado.", chips: ["Cura a una unidad aliada"] });
      out.push({ id: "o:atrapapinreles", name: "AtrapaPinreles", type: "Objeto de la mochila", img: "assets/iconos/atrapapinreles.png", desc: "Un cepo goblin oxidado de los de toda la vida. Quien pisa su casilla pierde el turno y suelta lo que lleve. Se vende solo, porque nadie puede jurar que no lo pisará.", chips: ["Se coloca junto a una unidad", "El enemigo pierde el turno"] });
      out.push({ id: "o:katapum", name: "KataPum!", type: "Objeto de la mochila", img: "assets/iconos/katapum.png", desc: "Un cohete goblin casero y teledirigido, hasta cierto punto. Elige a un rival a la vista y vuela hacia él. Al explotar tira un dado, y el resultado depende de tu suerte, que ya conocemos.", chips: ["Elige a un rival a la vista", "Explota con dado"] });
      out.push({ id: "o:totemvision", name: "TotemVision", type: "Objeto de la mochila", img: "assets/iconos/totemvision.png", desc: "Un tótem tallado con un ojo en la punta que ve más que tú. Colócalo en una casilla libre y da visión permanente alrededor. Lo único que no ve es que le estés dando órdenes.", chips: ["Visión en un radio de 3", "Se coloca en una casilla"] });
      out.push({ id: "o:senuelo", name: "Señuelo Explosivo", type: "Objeto de la mochila", img: "assets/iconos/senuelo_clavado.png", desc: "Un muñeco de madera con forma de gnomo, cargado de pólvora. Tú lo ves como lo que es; el rival, como un gnomo suelto de lo más tentador. Quien se acerca, vuela.", chips: ["Se coloca en una casilla", "Explota al acercarse"] });
      out.push({ id: "o:oraculo_renacido", name: "El Renacido", type: "Carta del Oráculo", img: "assets/oraculo/carta_renacido.webp", desc: "Carta del Oráculo. Cuando una de tus unidades muere, ganas tantos puntos de Gloria como costó reclutarla. Beneficio pasivo, siempre activo. Morir sale rentable, al fin.", chips: ["Pasiva", "Gloria al morir una unidad"] });
      out.push({ id: "o:oraculo_afortunado", name: "El Afortunado", type: "Carta del Oráculo", img: "assets/oraculo/carta_afortunado.webp", desc: "Carta del Oráculo. Recibes 1 punto de Gloria por turno por cada tótem que controlen tus rivales. Cuanto peor te vaya, mejor te va.", chips: ["Pasiva", "Gloria por tótems rivales"] });
      out.push({ id: "o:oraculo_eterno", name: "El Eterno", type: "Carta del Oráculo", img: "assets/oraculo/carta_eterno.webp", desc: "Carta del Oráculo. Cuando una de tus unidades golpea a un gnomo, gana 1 punto de vida por golpe hasta su máximo. Pegar a gnomos es la mejor terapia.", chips: ["Pasiva", "Cura al golpear gnomos"] });
      out.push({ id: "o:oraculo_vigilante", name: "El Vigilante", type: "Carta del Oráculo", img: "assets/oraculo/carta_vigilante.webp", desc: "Disipa la niebla de todo el mapa durante 3 segundos; después todo vuelve a cubrirse.", chips: ["Disipa la niebla 3 segundos", "Se activa al cerrar el Oráculo"] });
      out.push({ id: "o:oraculo_maldicion", name: "La Maldición", type: "Carta del Oráculo", img: "assets/oraculo/carta_maldicion.webp", desc: "Bloquea el Oráculo unos turnos y quema las cartas afectadas.", chips: ["Bloquea el Oráculo unos turnos", "Quema cartas"] });
    } else if (cat === "equipos") {
      (typeof RACES !== "undefined" ? RACES : []).forEach((r) => out.push({
        id: "t:" + r.id, name: this._tr(r.nameKey), type: "Equipo", img: r.iconImg, desc: this._tr(r.flavorKey),
        extra: [["Virtudes", this._tr(r.virtuesKey)], ["Debilidades", this._tr(r.weaknessesKey)]],
      }));
    } else if (cat === "escenarios") {
      (typeof LEVELS !== "undefined" ? LEVELS : []).filter((l) => l.available !== false).forEach((l) => out.push({
        id: "l:" + l.id, name: this._tr(l.nameKey), type: "Escenario", img: l.islandImg, desc: this._tr(l.flavorKey),
        chips: (l.featureKeys || []).map((k) => this._tr(k)),
      }));
    } else if (cat === "logros") {
      GNOMOTECA_ACH.forEach((a) => {
        const p = this._prog(a);
        out.push({ id: "a:" + a.id, ach: true, icon: a.icon, name: a.name, type: "Logro", desc: a.desc, xp: a.xp, cur: p.cur, goal: p.goal, done: this.ach.has(a.id) });
      });
    }
    // Todas las descripciones con el tono de Nizak. Lo que era una regla seca (objetos) se conserva como "Efecto".
    out.forEach((e) => {
      const d = GNOMOTECA_DESC[e.id];
      const rule = e.id.indexOf("o:") === 0 && typeof ITEM_DESCRIPTIONS !== "undefined" ? ITEM_DESCRIPTIONS[e.id.slice(2)] : null;
      if (rule) e.desc = rule; // la regla seca va a "Efecto"; la descripción larga es la de Nizak
      if (d) {
        if (e.id.indexOf("o:") === 0 && e.desc && e.desc !== d) e.extra = [["Efecto", e.desc]].concat(e.extra || []);
        e.desc = d;
      }
      const x = GNOMOTECA_EXTRA[e.id];
      if (x) e.extra = [["Virtudes", x[0]], ["Debilidades", x[1]]];
    });
    return out;
  },

  // ---------- Interfaz ----------
  open() {
    this._build();
    this.cat = "unidades";
    this.sel = 0;
    this._check();
    this._render(false);
    if (typeof goToScreen === "function") goToScreen("screen-gnomoteca");
  },

  _build() {
    const root = document.getElementById("gnomoteca-root");
    if (!root || this._ready) return;
    this._ready = true;
    root.innerHTML = `
      <div class="gnomo-stage">
        <div class="gnomo-tabs" id="gt-tabs"></div>
        <div class="gnomo-ribbon dl"></div>
        <div class="gnomo-title dl"><span>Gnomoteca</span></div>
        <div class="gnomo-book dl">
          <div class="gnomo-pages">
            <section class="gnomo-pg gnomo-pg--l dl"><h3 class="gnomo-h" id="gt-cat"></h3><div class="gnomo-total" id="gt-total" hidden></div><div class="gnomo-list" id="gt-list"></div><span class="gnomo-pn gnomo-pn--l" id="gt-pl"></span></section>
            <section class="gnomo-pg gnomo-pg--r dl" id="gt-right"><h3 class="gnomo-h" id="gt-name"></h3>
              <div class="gnomo-plate dl"><span class="gnomo-tag" id="gt-tag"></span><img id="gt-img" alt="" draggable="false" /><i id="gt-ico" class="gnomo-bigico" hidden></i></div>
              <div class="gnomo-scroll"><div class="gnomo-achrow" id="gt-achrow" hidden><div class="gnomo-abox dl" id="gt-abox"><i id="gt-aico" class="ph-bold"></i></div><div class="gnomo-achtxt"><span class="gnomo-tag" id="gt-atag"></span><p class="gnomo-desc" id="gt-adesc"></p></div></div><p class="gnomo-desc" id="gt-desc"></p><div id="gt-stats"></div><div id="gt-extra"></div><div class="gnomo-chips" id="gt-chips"></div></div>
              <span class="gnomo-pn gnomo-pn--r" id="gt-pr"></span></section>
          </div>
        </div>
      </div>`;
    const back = document.querySelector("#screen-gnomoteca .back-btn");
    // Clic fuera del libro (ni libro, ni pestañas, ni título, ni el propio botón): se cierra, igual que Volver.
    const scr = document.getElementById("screen-gnomoteca");
    // Se decide al PULSAR (no al soltar): al hacer clic en una pestaña o ficha el libro se repinta y el elemento
    // pulsado ya no existe cuando llega el "click", así que mirar entonces cerraría el libro por error.
    let outDown = false;
    const inside = (t) => !!(t && t.closest && t.closest(".gnomo-stage, .back-btn, button, a, input, select, textarea, [role=button]"));
    if (scr) {
      scr.addEventListener("pointerdown", (e) => { outDown = !inside(e.target); });
      scr.addEventListener("click", (e) => {
        const wasOut = outDown && !inside(e.target) && e.target.isConnected;
        outDown = false;
        if (wasOut && back) back.click();
      });
    }
    if (back) { back.addEventListener("click", () => this._snd()); back.addEventListener("mouseenter", () => this._hov()); }
    ["#gt-tabs", "#gt-list"].forEach((sel) => root.querySelector(sel).addEventListener("mouseover", (e) => {
      const t = e.target.closest(".gnomo-tab, .gnomo-it");
      if (t && !t.contains(e.relatedTarget)) this._hov();
    }));
    root.querySelector("#gt-tabs").addEventListener("click", (e) => {
      const t = e.target.closest(".gnomo-tab");
      if (t) { this.cat = t.dataset.c; this.sel = 0; this._render(true); }
    });
    root.querySelector("#gt-list").addEventListener("click", (e) => {
      const it = e.target.closest(".gnomo-it");
      if (it) { this.sel = +it.dataset.k; this._render(true); }
    });
    root.querySelector("#gt-list").addEventListener("keydown", (e) => {
      const it = e.target.closest(".gnomo-it");
      if (it && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); this.sel = +it.dataset.k; this._render(true); }
    });
    // Teclado: ◂ ▸ cambian de categoría, ▴ ▾ de entrada (mientras el libro está abierto).
    document.addEventListener("keydown", (e) => {
      const scr = document.getElementById("screen-gnomoteca");
      if (!scr || !scr.classList.contains("screen--active")) return;
      const ci = this.CATS.findIndex((c) => c.id === this.cat), n = this.entries(this.cat).length;
      if (e.key === "ArrowLeft") { this.cat = this.CATS[(ci + this.CATS.length - 1) % this.CATS.length].id; this.sel = 0; this._render(true); }
      else if (e.key === "ArrowRight") { this.cat = this.CATS[(ci + 1) % this.CATS.length].id; this.sel = 0; this._render(true); }
      else if (e.key === "ArrowUp") { this.sel = Math.max(0, this.sel - 1); this._render(true); }
      else if (e.key === "ArrowDown") { this.sel = Math.min(n - 1, this.sel + 1); this._render(true); }
    });
  },

  _snd() { try { if (typeof SFX !== "undefined" && SFX.enabled) SFX.click(); } catch (e) {} },
  _hov() { try { if (typeof SFX !== "undefined" && SFX.enabled) SFX.hover(); } catch (e) {} },

  _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },

  // ¿Categoría completa? Logros: todos desbloqueados; el resto: todas las entradas vistas.
  _complete(cat) {
    const list = this.entries(cat);
    if (!list.length) return false;
    return cat === "logros" ? list.every((e) => e.done) : list.every((e) => this.seen.has(e.id));
  },

  _render(flip) {
    const $ = (id) => document.getElementById(id);
    if (!$("gt-tabs")) return;
    const list = this.entries(this.cat);
    if (this.sel >= list.length) this.sel = 0;
    const isAch = this.cat === "logros";
    // Página completa (todo descubierto / todos los logros) = dorada; mientras no lo esté, morada como las demás.
    const done = {};
    this.CATS.forEach((c) => { done[c.id] = this._complete(c.id); });
    const book = document.querySelector("#screen-gnomoteca .gnomo-book");
    if (book) book.classList.toggle("gnomo-book--gold", !!done[this.cat]);
    $("gt-tabs").innerHTML = this.CATS.map((c) => `<button type="button" class="gnomo-tab dl ${done[c.id] ? "gnomo-tab--gold" : ""} ${c.id === this.cat ? "gnomo-tab--active" : ""}" data-c="${c.id}">${c.label}</button>`).join("");
    $("gt-cat").textContent = this.CATS.find((c) => c.id === this.cat).label;
    // Barra de lo conseguido respecto al total (logros desbloqueados, o entradas descubiertas de la categoría).
    const tot = $("gt-total");
    const got = isAch ? list.filter((e) => e.done).length : list.filter((e) => this.seen.has(e.id)).length;
    tot.hidden = false;
    tot.innerHTML = `<div class="gnomo-bar gnomo-bar--gold"><i style="width:${list.length ? Math.round((got / list.length) * 100) : 0}%"></i></div><b>${got} / ${list.length}</b>`;
    $("gt-list").classList.toggle("gnomo-list--ach", isAch);
    $("gt-list").innerHTML = list.map((e, k) => {
      if (e.ach) {
        return `<div class="gnomo-it gnomo-it--ach dl ${k === this.sel ? "gnomo-it--on" : ""} ${e.done ? "gnomo-it--got" : "gnomo-it--off"}" data-k="${k}" role="button" tabindex="0"><i class="ph-bold ph-${this._esc(e.icon)} gnomo-ico"></i><span>${this._esc(e.name)}</span><em class="gnomo-xp"><b>+${e.xp}</b> XP</em></div>`;
      }
      const lock = !this.seen.has(e.id);
      return `<div class="gnomo-it dl ${k === this.sel ? "gnomo-it--on" : ""} ${lock ? "gnomo-it--lock" : ""}" data-k="${k}" role="button" tabindex="0"><img src="${this._esc(e.img)}" alt="" draggable="false"><span>${lock ? "???" : this._esc(e.name)}</span><em class="gnomo-xp ${lock ? "" : "gnomo-xp--got"}"><b>+${GNOMOTECA_XP_ENTRY}</b> XP</em></div>`;
    }).join("");
    const e = list[this.sel];
    if (!e) return;
    const plate = document.querySelector("#gt-right .gnomo-plate");
    if (e.ach) {
      // Logro: sin el recuadro grande; un recuadro pequeño con el icono y, a su derecha, cómo se consigue.
      plate.hidden = true;
      $("gt-achrow").hidden = false;
      $("gt-abox").className = "gnomo-abox dl" + (e.done ? "" : " gnomo-abox--off");
      $("gt-aico").className = `ph-bold ph-${e.icon}`;
      $("gt-name").textContent = e.name;
      $("gt-atag").textContent = "Cómo se consigue";
      $("gt-adesc").textContent = e.desc;
      $("gt-desc").hidden = true;
      const pct = e.goal ? Math.min(100, Math.round((e.cur / e.goal) * 100)) : 0;
      $("gt-stats").innerHTML = `<div class="gnomo-st gnomo-st--p"><span>Progreso</span><div class="gnomo-bar gnomo-bar--gold"><i style="width:${pct}%"></i></div><b>${e.cur} / ${e.goal}</b></div>`;
      $("gt-extra").innerHTML = "";
      $("gt-chips").innerHTML = `<span class="gnomo-chip gnomo-chip--gold"><b>+${e.xp}</b> XP</span><span class="gnomo-chip ${e.done ? "gnomo-chip--ok" : ""}">${e.done ? "Desbloqueado" : "Bloqueado"}</span>`;
    } else {
      plate.hidden = false;
      $("gt-achrow").hidden = true;
      $("gt-desc").hidden = false;
      plate.classList.remove("gnomo-plate--gold", "gnomo-plate--off");
      $("gt-ico").hidden = true;
      $("gt-img").hidden = false;
      const lock = !this.seen.has(e.id);
      $("gt-name").textContent = lock ? "???" : e.name;
      $("gt-tag").textContent = lock ? "" : e.type || "";
      $("gt-tag").style.display = lock ? "none" : "";
      $("gt-img").src = e.img;
      $("gt-img").classList.toggle("gnomo-shadow", lock);
      $("gt-desc").textContent = lock ? "" : e.desc || "";
      $("gt-stats").innerHTML = lock || !e.stats ? "" : e.stats.map((s) => `<div class="gnomo-st"><span>${s[0]}</span><div class="gnomo-bar"><i style="width:${Math.min(100, Math.round((s[1] / s[2]) * 100))}%"></i></div><b>${s[1]}</b></div>`).join("");
      $("gt-extra").innerHTML = lock || !e.extra ? "" : e.extra.filter((x) => x[1]).map((x) => `<div class="gnomo-ex"><b>${this._esc(x[0])}</b><p>${this._esc(x[1])}</p></div>`).join("");
      const xpChip = `<span class="gnomo-chip gnomo-chip--gold ${lock ? "gnomo-chip--off" : ""}"><b>+${GNOMOTECA_XP_ENTRY}</b> XP</span>`;
      $("gt-chips").innerHTML = xpChip + (lock || !e.chips ? "" : e.chips.map((c) => `<span class="gnomo-chip ${c.length > 38 ? "gnomo-chip--long" : ""}">${this._esc(c)}</span>`).join(""));
    }
    const ci = this.CATS.findIndex((c) => c.id === this.cat);
    $("gt-pl").textContent = ci * 2 + 1;
    $("gt-pr").textContent = ci * 2 + 2;
    if (flip) this._snd();
    if (flip && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      // Efecto de goma (el del demo): el sprite se estira y se aplasta al caer, y el texto sube con un pequeño rebote.
      const img = e.ach ? $("gt-abox") : $("gt-img"), sc = document.querySelector("#gt-right .gnomo-scroll");
      if (img && img.animate) img.animate([
        { transform: "scale(.8,1.18)", offset: 0 }, { transform: "scale(1.1,.9)", offset: .4 },
        { transform: "scale(.97,1.04)", offset: .7 }, { transform: "scale(1)", offset: 1 },
      ], { duration: 380, easing: "ease-out" });
      if (sc && sc.animate) sc.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
    }
  },
};

document.addEventListener("DOMContentLoaded", () => Gnomoteca.init());
