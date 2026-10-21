/**
 * Búsqueda local de primera mejora sobre cinco vecindarios:
 *
 *  intra-ruta
 *   - 2-opt:   invierte un tramo de la ruta;
 *   - Or-opt:  mueve un tramo de 1 a 3 clientes a otra posición de la ruta.
 *  entre rutas
 *   - relocate: mueve un tramo de 1 a 3 clientes de una ruta a otra;
 *   - swap / cross-exchange: intercambia tramos de 1 a 3 clientes entre dos
 *     rutas (swap es el caso 1 por 1);
 *   - 2-opt*:  intercambia las colas de dos rutas.
 *
 * Los movimientos entre rutas se evalúan en O(1) más el largo del tramo,
 * concatenando prefijos y sufijos precalculados (segmento.ts). Los de una
 * sola ruta se evalúan simulando la ruta nueva: las rutas son cortas y el
 * código queda más simple de auditar.
 *
 * El objetivo es jerárquico (vehículos, luego distancia): un movimiento que
 * vacía una ruta gana el peso de un vehículo. Solo se aplican movimientos
 * factibles que bajan el costo estrictamente, así que la búsqueda nunca
 * empeora ni rompe la factibilidad de una solución factible.
 */
import type { Instancia } from "../instancia.js";
import { factible, indexarRuta, segmentoDeSecuencia, unir, type RutaIndexada, type Segmento } from "../segmento.js";
import { pesoVehiculo } from "../solucion.js";
import type { Solucion } from "../verificador.js";

export type Operador = "2-opt" | "or-opt" | "relocate" | "cross" | "2-opt*";
export const OPERADORES: readonly Operador[] = ["2-opt", "or-opt", "relocate", "cross", "2-opt*"];

export interface OpcionesBusqueda {
  operadores?: readonly Operador[];
  /** Largo máximo de los tramos en Or-opt, relocate y cross. */
  tramoMax?: number;
}

const MEJORA = 1e-7;

export function busquedaLocal(inst: Instancia, sol: Solucion, op: OpcionesBusqueda = {}): Solucion {
  const ops = new Set(op.operadores ?? OPERADORES);
  const tramoMax = op.tramoMax ?? 3;
  const peso = pesoVehiculo(inst);
  let rutas: RutaIndexada[] = sol.rutas.filter((r) => r.length > 0).map((r) => indexarRuta(inst, r));

  const clientes = (r: RutaIndexada) => r.nodos.slice(1, -1);
  const reemplazar = (k: number, nuevos: number[]) => {
    rutas[k] = indexarRuta(inst, nuevos);
  };
  const distRuta = (r: RutaIndexada) => r.pre[r.nodos.length - 1]!.distancia;
  const tramo = (r: RutaIndexada, desde: number, largo: number): Segmento | null =>
    largo === 0 ? null : segmentoDeSecuencia(inst, r.nodos.slice(desde, desde + largo));
  const juntar = (...ss: Array<Segmento | null>) => unir(inst, ...ss.filter((s): s is Segmento => s !== null));

  /** Intra-ruta: prueba candidatos simulando la ruta completa. */
  const intra = (k: number): boolean => {
    const r = rutas[k]!;
    const c = clientes(r);
    const actual = distRuta(r);
    const probar = (nueva: number[]): boolean => {
      const s = segmentoDeSecuencia(inst, [0, ...nueva, 0]);
      if (factible(inst, s) && s.distancia < actual - MEJORA) {
        reemplazar(k, nueva);
        return true;
      }
      return false;
    };
    if (ops.has("2-opt")) {
      for (let i = 0; i < c.length - 1; i++) {
        for (let j = i + 1; j < c.length; j++) {
          if (probar([...c.slice(0, i), ...c.slice(i, j + 1).reverse(), ...c.slice(j + 1)])) return true;
        }
      }
    }
    if (ops.has("or-opt")) {
      for (let largo = 1; largo <= Math.min(tramoMax, c.length - 1); largo++) {
        for (let i = 0; i + largo <= c.length; i++) {
          const t = c.slice(i, i + largo);
          const resto = [...c.slice(0, i), ...c.slice(i + largo)];
          for (let p = 0; p <= resto.length; p++) {
            if (p === i) continue;
            if (probar([...resto.slice(0, p), ...t, ...resto.slice(p)])) return true;
          }
        }
      }
    }
    return false;
  };

  /**
   * Entre rutas a y b: saca un tramo de largo la que empieza en la posición i
   * de a y otro de largo lb en la posición j de b, y los cruza. Con lb = 0 es
   * relocate (el tramo de a se inserta antes de la posición j de b); con
   * la = lb = 1, swap; en general, cross-exchange.
   */
  const entre = (ka: number, kb: number): boolean => {
    const a = rutas[ka]!, b = rutas[kb]!;
    const na = a.nodos.length, nb = b.nodos.length; // incluyen los dos depósitos
    const base = distRuta(a) + distRuta(b);
    const combinaciones: Array<[number, number]> = [];
    for (let la = 0; la <= tramoMax; la++) {
      for (let lb = 0; lb <= tramoMax; lb++) {
        if (la === 0 && lb === 0) continue;
        const esRelocate = la === 0 || lb === 0;
        if (esRelocate ? !ops.has("relocate") : !ops.has("cross")) continue;
        combinaciones.push([la, lb]);
      }
    }
    for (const [la, lb] of combinaciones) {
      // i recorre 1..na-1-la (con la = 0, i es el punto de inserción y puede ser na-1).
      for (let i = 1; i + la <= na - 1; i++) {
        const ta = tramo(a, i, la);
        for (let j = 1; j + lb <= nb - 1; j++) {
          const tb = tramo(b, j, lb);
          const nuevaA = juntar(a.pre[i - 1]!, tb, a.suf[i + la]!);
          if (!factible(inst, nuevaA)) continue;
          const nuevaB = juntar(b.pre[j - 1]!, ta, b.suf[j + lb]!);
          if (!factible(inst, nuevaB)) continue;
          const vacias = (na - 2 - la + lb === 0 ? 1 : 0) + (nb - 2 - lb + la === 0 ? 1 : 0);
          const delta = nuevaA.distancia + nuevaB.distancia - base - vacias * peso;
          if (delta < -MEJORA) {
            const ca = clientes(a), cb = clientes(b);
            const sa = ca.slice(i - 1, i - 1 + la), sb = cb.slice(j - 1, j - 1 + lb);
            reemplazar(ka, [...ca.slice(0, i - 1), ...sb, ...ca.slice(i - 1 + la)]);
            reemplazar(kb, [...cb.slice(0, j - 1), ...sa, ...cb.slice(j - 1 + lb)]);
            return true;
          }
        }
      }
    }
    if (ops.has("2-opt*")) {
      for (let i = 0; i <= na - 2; i++) {
        for (let j = 0; j <= nb - 2; j++) {
          if ((i === 0 && j === 0) || (i === na - 2 && j === nb - 2)) continue;
          const nuevaA = unir(inst, a.pre[i]!, b.suf[j + 1]!);
          if (!factible(inst, nuevaA)) continue;
          const nuevaB = unir(inst, b.pre[j]!, a.suf[i + 1]!);
          if (!factible(inst, nuevaB)) continue;
          const vacias = (i + (nb - 2 - j) === 0 ? 1 : 0) + (j + (na - 2 - i) === 0 ? 1 : 0);
          const delta = nuevaA.distancia + nuevaB.distancia - base - vacias * peso;
          if (delta < -MEJORA) {
            const ca = clientes(a), cb = clientes(b);
            reemplazar(ka, [...ca.slice(0, i), ...cb.slice(j)]);
            reemplazar(kb, [...cb.slice(0, j), ...ca.slice(i)]);
            return true;
          }
        }
      }
    }
    return false;
  };

  for (let mejoro = true; mejoro; ) {
    mejoro = false;
    for (let k = 0; k < rutas.length; k++) while (intra(k)) mejoro = true;
    for (let ka = 0; ka < rutas.length; ka++) {
      for (let kb = 0; kb < rutas.length; kb++) {
        if (ka === kb) continue;
        if (entre(ka, kb)) {
          mejoro = true;
          rutas = rutas.filter((r) => r.nodos.length > 2);
          ka = Math.min(ka, rutas.length - 1);
          kb = -1;
        }
      }
    }
  }
  return { rutas: rutas.filter((r) => r.nodos.length > 2).map(clientes) };
}
