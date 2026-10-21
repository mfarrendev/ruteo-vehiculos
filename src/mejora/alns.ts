/**
 * Búsqueda adaptativa de vecindarios grandes (ALNS, Ropke y Pisinger, 2006).
 *
 * En cada iteración se destruye parte de la solución con un operador de
 * destrucción y se repara con uno de reparación, elegidos por ruleta con pesos
 * que se adaptan según lo que cada uno viene logrando. La nueva solución se
 * acepta con un criterio de recocido simulado. Cuando aparece una mejor
 * solución global se le pasa la búsqueda local completa.
 *
 * Destrucción: aleatoria, peor costo (con sesgo aleatorio), relacionada (Shaw:
 * cercanía en el plano y en la ventana) y ruta completa (la más corta o una al
 * azar; es la que empuja a bajar vehículos).
 * Reparación: inserción más barata (greedy) y arrepentimiento-2 (regret-2).
 */
import { crearAleatorio, type Aleatorio } from "../aleatorio.js";
import type { Instancia } from "../instancia.js";
import { factible, indexarRuta, segmentoDeNodo, unir, type RutaIndexada } from "../segmento.js";
import { costo, pesoVehiculo } from "../solucion.js";
import type { Solucion } from "../verificador.js";
import { busquedaLocal } from "./busqueda-local.js";

export interface OpcionesAlns {
  iteraciones?: number;
  semilla?: number;
  /** Fracción mínima y máxima de clientes que se sacan por iteración. */
  destruirMin?: number;
  destruirMax?: number;
  /** Corte por tiempo en milisegundos (además de las iteraciones). */
  tiempoMaxMs?: number;
  /** Llamado con (iteración, mejor costo) cada vez que mejora el global. */
  alMejorar?: (iteracion: number, sol: Solucion) => void;
}

type Destructor = (inst: Instancia, rutas: number[][], q: number, rnd: Aleatorio) => number[];
type Reparador = (inst: Instancia, rutas: number[][], sueltos: number[], rnd: Aleatorio) => number[][];

const sacar = (rutas: number[][], ids: Set<number>): number[][] =>
  rutas.map((r) => r.filter((c) => !ids.has(c))).filter((r) => r.length > 0);

const destruirAleatorio: Destructor = (_inst, rutas, q, rnd) => rnd.barajar(rutas.flat()).slice(0, q);

const destruirPeor: Destructor = (inst, rutas, q, rnd) => {
  const D = inst.dist;
  const ahorro: Array<[number, number]> = [];
  for (const r of rutas) {
    r.forEach((c, k) => {
      const a = k === 0 ? 0 : r[k - 1]!, b = k === r.length - 1 ? 0 : r[k + 1]!;
      ahorro.push([D[a]![c]! + D[c]![b]! - D[a]![b]!, c]);
    });
  }
  ahorro.sort((x, y) => y[0] - x[0]);
  const elegidos = new Set<number>();
  while (elegidos.size < q && ahorro.length > 0) {
    // Sesgo aleatorio (p = 3): favorece los primeros sin elegirlos siempre.
    const k = Math.floor(Math.pow(rnd.real(), 3) * ahorro.length);
    elegidos.add(ahorro.splice(k, 1)[0]![1]);
  }
  return [...elegidos];
};

const destruirRelacionado: Destructor = (inst, rutas, q, rnd) => {
  const todos = rutas.flat();
  const semilla = rnd.elegir(todos);
  const s = inst.nodos[semilla]!;
  const relacion = (c: number) => inst.dist[semilla]![c]! + 0.5 * Math.abs(inst.nodos[c]!.inicio - s.inicio);
  return todos
    .map((c) => [relacion(c) * (1 + 0.2 * rnd.real()), c] as const)
    .sort((a, b) => a[0] - b[0])
    .slice(0, q)
    .map(([, c]) => c);
};

const destruirRuta: Destructor = (_inst, rutas, q, rnd) => {
  const orden = [...rutas].sort((a, b) => a.length - b.length);
  const r = rnd.real() < 0.5 ? orden[0]! : rnd.elegir(rutas);
  // Saca la ruta entera y, si es corta, completa q al azar.
  const fuera = new Set(r);
  for (const c of rnd.barajar(rutas.flat())) if (fuera.size < q) fuera.add(c);
  return [...fuera];
};

/** Costo de la mejor inserción de u en cada ruta (Infinity si no cabe). */
function mejorEnRuta(inst: Instancia, r: RutaIndexada, u: number): { delta: number; pos: number } {
  const su = segmentoDeNodo(inst, u);
  const base = r.pre[r.nodos.length - 1]!.distancia;
  let delta = Infinity, pos = -1;
  for (let k = 0; k < r.nodos.length - 1; k++) {
    const s = unir(inst, r.pre[k]!, su, r.suf[k + 1]!);
    if (factible(inst, s) && s.distancia - base < delta) {
      delta = s.distancia - base;
      pos = k;
    }
  }
  return { delta, pos };
}

function reparar(regret: boolean): Reparador {
  return (inst, rutasIn, sueltosIn) => {
    const peso = pesoVehiculo(inst);
    const rutas = rutasIn.map((r) => indexarRuta(inst, r));
    const sueltos = [...sueltosIn];
    // tabla[u][k]: mejor inserción de u en la ruta k.
    const tabla = new Map<number, Array<{ delta: number; pos: number }>>();
    for (const u of sueltos) tabla.set(u, rutas.map((r) => mejorEnRuta(inst, r, u)));

    while (sueltos.length > 0) {
      let elegido = -1, ruta = -1, mejorPuntaje = -Infinity;
      for (const u of sueltos) {
        const fila = tabla.get(u)!;
        const nueva = 2 * inst.dist[0]![u]! + peso;
        let m1 = nueva, m2 = Infinity, k1 = -1;
        fila.forEach((x, k) => {
          if (x.delta < m1) { m2 = m1; m1 = x.delta; k1 = k; }
          else if (x.delta < m2) m2 = x.delta;
        });
        if (m2 === Infinity) m2 = nueva;
        // greedy: el más barato primero; regret: el que más pierde si espera.
        const puntaje = regret ? m2 - m1 : -m1;
        if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; elegido = u; ruta = k1; }
      }
      sueltos.splice(sueltos.indexOf(elegido), 1);
      const filaElegido = tabla.get(elegido)!;
      tabla.delete(elegido);
      if (ruta < 0) {
        rutas.push(indexarRuta(inst, [elegido]));
        ruta = rutas.length - 1;
        for (const u of sueltos) tabla.get(u)!.push(mejorEnRuta(inst, rutas[ruta]!, u));
      } else {
        const r = rutas[ruta]!;
        const pos = filaElegido[ruta]!.pos;
        const c = r.nodos.slice(1, -1);
        c.splice(pos, 0, elegido);
        rutas[ruta] = indexarRuta(inst, c);
        for (const u of sueltos) tabla.get(u)![ruta] = mejorEnRuta(inst, rutas[ruta]!, u);
      }
    }
    return rutas.map((r) => r.nodos.slice(1, -1));
  };
}

const DESTRUCTORES: Array<[string, Destructor]> = [
  ["aleatorio", destruirAleatorio],
  ["peor", destruirPeor],
  ["relacionado", destruirRelacionado],
  ["ruta", destruirRuta],
];
const REPARADORES: Array<[string, Reparador]> = [
  ["greedy", reparar(false)],
  ["regret-2", reparar(true)],
];

function ruleta(pesos: number[], rnd: Aleatorio): number {
  const total = pesos.reduce((a, b) => a + b, 0);
  let x = rnd.real() * total;
  for (let k = 0; k < pesos.length; k++) {
    x -= pesos[k]!;
    if (x <= 0) return k;
  }
  return pesos.length - 1;
}

export interface ResultadoAlns {
  solucion: Solucion;
  iteraciones: number;
  /** Veces que cada operador produjo un nuevo mejor global. */
  mejoras: Record<string, number>;
}

export function alns(inst: Instancia, inicial: Solucion, op: OpcionesAlns = {}): ResultadoAlns {
  const rnd = crearAleatorio(op.semilla ?? 1);
  const iteraciones = op.iteraciones ?? 2000;
  const n = inst.nodos.length - 1;
  const qMin = Math.max(1, Math.round((op.destruirMin ?? 0.1) * n));
  const qMax = Math.max(qMin, Math.round((op.destruirMax ?? 0.35) * n));
  const inicio = Date.now();

  let actual = busquedaLocal(inst, inicial);
  let mejor = actual;
  let cActual = costo(inst, actual), cMejor = cActual;
  const peso = pesoVehiculo(inst);
  // Temperatura: empezar aceptando con prob. 0,5 una solución 5 % más larga
  // en distancia y enfriar hasta la centésima parte al final.
  const distInicial = cActual - peso * actual.rutas.length;
  const t0 = (0.05 * Math.max(distInicial, 1)) / Math.LN2;
  const tFin = t0 / 100;
  const enfriar = Math.pow(tFin / t0, 1 / Math.max(1, iteraciones));
  let temp = t0;

  const pd = DESTRUCTORES.map(() => 1), pr = REPARADORES.map(() => 1);
  const sd = DESTRUCTORES.map(() => 0), sr = REPARADORES.map(() => 0);
  const ud = DESTRUCTORES.map(() => 0), ur = REPARADORES.map(() => 0);
  const mejoras: Record<string, number> = {};
  const vistos = new Set<string>();

  let it = 0;
  for (; it < iteraciones; it++) {
    if (op.tiempoMaxMs !== undefined && Date.now() - inicio > op.tiempoMaxMs) break;
    const kd = ruleta(pd, rnd), kr = ruleta(pr, rnd);
    const q = rnd.entero(qMin, qMax);
    const fuera = DESTRUCTORES[kd]![1](inst, actual.rutas, q, rnd);
    const parcial = sacar(actual.rutas, new Set(fuera));
    let candidata: Solucion = { rutas: REPARADORES[kr]![1](inst, parcial, rnd.barajar(fuera), rnd) };
    let c = costo(inst, candidata, peso);

    let puntaje = 0;
    if (c < cMejor - 1e-7) {
      candidata = busquedaLocal(inst, candidata);
      c = costo(inst, candidata, peso);
      mejor = candidata; cMejor = c;
      actual = candidata; cActual = c;
      puntaje = 33;
      const nombre = `${DESTRUCTORES[kd]![0]}+${REPARADORES[kr]![0]}`;
      mejoras[nombre] = (mejoras[nombre] ?? 0) + 1;
      op.alMejorar?.(it, mejor);
    } else if (c < cActual - 1e-7 || rnd.real() < Math.exp(-(c - cActual) / temp)) {
      const huella = candidata.rutas.map((r) => r.join(",")).sort().join("|");
      puntaje = c < cActual ? 9 : vistos.has(huella) ? 0 : 13;
      vistos.add(huella);
      actual = candidata; cActual = c;
    }
    sd[kd]! += puntaje; ud[kd]!++;
    sr[kr]! += puntaje; ur[kr]!++;
    temp *= enfriar;

    // Cada 100 iteraciones se recalculan los pesos (reacción 0,1).
    if ((it + 1) % 100 === 0) {
      const ajustar = (p: number[], s: number[], u: number[]) => {
        for (let k = 0; k < p.length; k++) {
          if (u[k]! > 0) p[k] = Math.max(0.05, 0.9 * p[k]! + 0.1 * (s[k]! / u[k]!));
          s[k] = 0; u[k] = 0;
        }
      };
      ajustar(pd, sd, ud);
      ajustar(pr, sr, ur);
    }
  }
  return { solucion: mejor, iteraciones: it, mejoras };
}
