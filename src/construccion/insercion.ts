/**
 * Heurística de inserción secuencial I1 de Solomon (1987).
 *
 * Abre una ruta con una semilla (el cliente sin rutear más lejano del
 * depósito) y le inserta clientes uno a uno hasta que ninguno cabe; entonces
 * abre otra. Para cada cliente u se busca la mejor posición (i, j) según
 *   c1 = α1·(d_iu + d_uj − μ·d_ij) + α2·(b_j' − b_j)
 * donde b_j' − b_j es cuánto se atrasa el servicio de j (el "push forward"),
 * y entre los clientes se elige el que maximiza c2 = λ·d_0u − c1.
 *
 * La factibilidad de cada inserción se decide con los segmentos de prefijo y
 * sufijo de la ruta (ver segmento.ts): el atraso cabe si no supera la holgura
 * hacia adelante del resto de la ruta, sin volver a simularla.
 *
 * Solomon probó varias combinaciones de parámetros y se quedó con la mejor por
 * instancia; aquí se hace lo mismo con una grilla chica (PARAMETROS_I1).
 */
import type { Instancia } from "../instancia.js";
import { factible, indexarRuta, segmentoDeNodo, unir, type RutaIndexada } from "../segmento.js";
import { costo } from "../solucion.js";
import type { Solucion } from "../verificador.js";

export interface ParametrosI1 {
  mu: number;
  lambda: number;
  alfa1: number;
}

export const PARAMETROS_I1: ParametrosI1[] = [
  { mu: 1, lambda: 1, alfa1: 1 },
  { mu: 1, lambda: 2, alfa1: 1 },
  { mu: 1, lambda: 1, alfa1: 0.5 },
  { mu: 1, lambda: 2, alfa1: 0.5 },
  { mu: 1, lambda: 1, alfa1: 0 },
];

/** Hora de inicio de servicio en cada posición de la ruta. */
function horarios(inst: Instancia, nodos: number[]): number[] {
  const b = [inst.nodos[0]!.inicio];
  for (let k = 1; k < nodos.length; k++) {
    const p = nodos[k - 1]!, q = nodos[k]!;
    b.push(Math.max(inst.nodos[q]!.inicio, b[k - 1]! + inst.nodos[p]!.servicio + inst.dist[p]![q]!));
  }
  return b;
}

export function insercionI1(inst: Instancia, p: ParametrosI1 = PARAMETROS_I1[0]!): Solucion {
  const n = inst.nodos.length - 1;
  const D = inst.dist;
  const alfa2 = 1 - p.alfa1;
  const sinRutear = new Set<number>(Array.from({ length: n }, (_, i) => i + 1));
  const rutas: number[][] = [];

  while (sinRutear.size > 0) {
    let semilla = -1;
    for (const u of sinRutear) if (semilla < 0 || D[0]![u]! > D[0]![semilla]!) semilla = u;
    let ruta: number[] = [semilla];
    sinRutear.delete(semilla);

    for (;;) {
      const r: RutaIndexada = indexarRuta(inst, ruta);
      const b = horarios(inst, r.nodos);
      let mejorU = -1, mejorPos = -1, mejorC2 = -Infinity;
      for (const u of sinRutear) {
        const su = segmentoDeNodo(inst, u);
        let c1u = Infinity, posU = -1;
        for (let k = 0; k < r.nodos.length - 1; k++) {
          const i = r.nodos[k]!, j = r.nodos[k + 1]!;
          if (!factible(inst, unir(inst, r.pre[k]!, su, r.suf[k + 1]!))) continue;
          const c11 = D[i]![u]! + D[u]![j]! - p.mu * D[i]![j]!;
          const bu = Math.max(inst.nodos[u]!.inicio, b[k]! + inst.nodos[i]!.servicio + D[i]![u]!);
          const bj = Math.max(inst.nodos[j]!.inicio, bu + inst.nodos[u]!.servicio + D[u]![j]!);
          const c1 = p.alfa1 * c11 + alfa2 * (bj - b[k + 1]!);
          if (c1 < c1u) { c1u = c1; posU = k; }
        }
        if (posU < 0) continue;
        const c2 = p.lambda * D[0]![u]! - c1u;
        if (c2 > mejorC2) { mejorC2 = c2; mejorU = u; mejorPos = posU; }
      }
      if (mejorU < 0) break;
      ruta = [...ruta.slice(0, mejorPos), mejorU, ...ruta.slice(mejorPos)];
      sinRutear.delete(mejorU);
    }
    rutas.push(ruta);
  }
  return { rutas };
}

/** Corre I1 con cada juego de parámetros y devuelve la mejor solución. */
export function insercionI1Mejor(inst: Instancia, grilla: ParametrosI1[] = PARAMETROS_I1): Solucion {
  let mejor: Solucion | null = null;
  for (const p of grilla) {
    const s = insercionI1(inst, p);
    if (mejor === null || costo(inst, s) < costo(inst, mejor)) mejor = s;
  }
  return mejor!;
}
