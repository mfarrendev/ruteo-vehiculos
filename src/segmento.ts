/**
 * Evaluación incremental de factibilidad de ventanas por concatenación de
 * segmentos (Vidal, Crainic, Gendreau y Prins, 2013, "A hybrid genetic
 * algorithm with adaptive diversity management...", sección de evaluación
 * de movimientos con ventanas de tiempo).
 *
 * Cada subsecuencia de una ruta se resume en un puñado de números:
 *   dur   duración mínima (viaje + servicio + espera inevitable),
 *   tw    violación de ventanas acumulada (0 si es factible),
 *   e, l  el instante más temprano y más tardío en que se puede empezar el
 *         primer servicio sin agregar espera ni violación evitables,
 *   carga y distancia.
 *
 * "l" es la generalización del tiempo de holgura hacia adelante (forward time
 * slack de Savelsbergh, 1992): cuánto se puede atrasar el comienzo del
 * segmento sin romper ninguna ventana posterior. Con prefijos y sufijos
 * precalculados para cada ruta, un movimiento que corta y pega rutas se evalúa
 * en O(1) (más el largo del trozo que se mueve), en vez de simular la ruta
 * completa.
 */
import type { Instancia } from "./instancia.js";

export interface Segmento {
  primero: number;
  ultimo: number;
  dur: number;
  tw: number;
  e: number;
  l: number;
  carga: number;
  distancia: number;
}

export function segmentoDeNodo(inst: Instancia, i: number): Segmento {
  const n = inst.nodos[i]!;
  return { primero: i, ultimo: i, dur: n.servicio, tw: 0, e: n.inicio, l: n.fin, carga: n.demanda, distancia: 0 };
}

export function concatenar(inst: Instancia, a: Segmento, b: Segmento): Segmento {
  const t = inst.dist[a.ultimo]![b.primero]!;
  const delta = a.dur - a.tw + t;
  const espera = Math.max(b.e - delta - a.l, 0);
  const viol = Math.max(a.e + delta - b.l, 0);
  return {
    primero: a.primero,
    ultimo: b.ultimo,
    dur: a.dur + b.dur + t + espera,
    tw: a.tw + b.tw + viol,
    e: Math.max(b.e - delta, a.e) - espera,
    l: Math.min(b.l - delta, a.l) + viol,
    carga: a.carga + b.carga,
    distancia: a.distancia + b.distancia + t,
  };
}

/** Segmento de una secuencia de nodos (puede incluir el depósito). */
export function segmentoDeSecuencia(inst: Instancia, nodos: readonly number[]): Segmento {
  if (nodos.length === 0) throw new Error("secuencia vacía");
  let s = segmentoDeNodo(inst, nodos[0]!);
  for (let k = 1; k < nodos.length; k++) s = concatenar(inst, s, segmentoDeNodo(inst, nodos[k]!));
  return s;
}

/** Concatena una lista de segmentos de izquierda a derecha. */
export function unir(inst: Instancia, ...partes: Segmento[]): Segmento {
  let s = partes[0]!;
  for (let k = 1; k < partes.length; k++) s = concatenar(inst, s, partes[k]!);
  return s;
}

const EPS = 1e-9;
export const factible = (inst: Instancia, s: Segmento): boolean => s.tw <= EPS && s.carga <= inst.capacidad + EPS;

/**
 * Prefijos y sufijos de una ruta completa [0, c1, ..., ck, 0].
 * pre[i] cubre las posiciones 0..i; suf[i] cubre i..fin.
 */
export interface RutaIndexada {
  nodos: number[];
  pre: Segmento[];
  suf: Segmento[];
}

export function indexarRuta(inst: Instancia, clientes: readonly number[]): RutaIndexada {
  const nodos = [0, ...clientes, 0];
  const pre: Segmento[] = new Array(nodos.length);
  const suf: Segmento[] = new Array(nodos.length);
  pre[0] = segmentoDeNodo(inst, 0);
  for (let i = 1; i < nodos.length; i++) pre[i] = concatenar(inst, pre[i - 1]!, segmentoDeNodo(inst, nodos[i]!));
  suf[nodos.length - 1] = segmentoDeNodo(inst, 0);
  for (let i = nodos.length - 2; i >= 0; i--) suf[i] = concatenar(inst, segmentoDeNodo(inst, nodos[i]!), suf[i + 1]!);
  return { nodos, pre, suf };
}
