// Bandos de la partida. "player" es el jugador humano; el resto son bandos
// de IA ("enemy", "enemy2", "enemy3"). Todos son hostiles entre sí.
const Teams = {
  all: ["player", "enemy"],
  raceIds: { player: null, enemy: null },
  variants: { player: 0, enemy: 0 }, // 0 = colores originales de la raza
  rivalCount: 1,

  // races: { team: raceId }. Un bando que repite raza de otro anterior recibe
  // una variante de color para distinguirlo.
  setup(rivals, races) {
    this.rivalCount = rivals;
    this.all = ["player"];
    for (let i = 1; i <= rivals; i++) this.all.push(i === 1 ? "enemy" : "enemy" + i);
    this.raceIds = {};
    this.variants = {};
    const seen = {};
    this.all.forEach((t) => {
      const r = races[t];
      this.raceIds[t] = r;
      this.variants[t] = seen[r] || 0;
      seen[r] = (seen[r] || 0) + 1;
    });
  },

  // Clases CSS de un elemento de bando: ["unit--enemy2", "unit--enemy"] para IA.
  cls(prefix, team) {
    const a = [prefix + "--" + team];
    if (team !== "player" && team !== "enemy") a.push(prefix + "--enemy");
    return a;
  },
  variantClass(team) { return this.variants[team] ? "team-variant-" + this.variants[team] : ""; },

  isAI(team) { return team !== "player"; },
  ai() { return this.all.filter((t) => t !== "player"); },
  keyed(init) {
    const o = {};
    this.all.forEach((t) => { o[t] = typeof init === "function" ? init(t) : init; });
    return o;
  },
  // Número legible del rival: enemy -> 1, enemy2 -> 2
  rivalIndex(team) { return team === "enemy" ? 1 : Number(team.replace("enemy", "")) || 1; },
};
