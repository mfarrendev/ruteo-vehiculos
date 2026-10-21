/**
 * Ahorros de Clarke y Wright (1964), versión paralela, con la factibilidad de
 * ventanas y capacidad comprobada en cada fusión.
 *
 * Con ventanas de tiempo la orientación importa: fusionar "A y después B" puede
 * ser factible y "B y después A" no. Por eso cada par (i, j) se prueba en las
 * dos orientaciones: i al final de su ruta y j al comienzo de la suya, o al
 * revés. No se invierten rutas: invertir una ruta con ventanas casi nunca es
 * factible y el costo de probarlo no se paga.
 */
import type { Instancia } from "../instancia.js";
import { factible, segmentoDeSecuencia } from "../segmento.js";
import type { Solucion } from "../verificador.js";

export function ahorros(inst: Instancia): Solucion {
  const n = inst.nodos.length - 1;
  const D = inst.dist;
  // rutaDe[c] = índice de la ruta que contiene a c; las rutas guardan sus clientes.
  const rutas: (number[] | null)[] = [null];
  const rutaDe = new Int32Array(n + 1);
  for (let c = 1; c <= n; c++) {
    rutas.push([c]);
    rutaDe[c] = c;
  }
  const pares: Array<[number, number, number]> = [];
  for (let i = 1; i <= n; i++) {
    for (let j = i + 1; j <= n; j++) {
      pares.push([D[0]![i]! + D[0]![j]! - D[i]![j]!, i, j]);
    }
  }
  pares.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]);

  const intentar = (x: number, y: number): boolean => {
    // x al final de su ruta, y al comienzo de otra.
    const rx = rutaDe[x]!, ry = rutaDe[y]!;
    if (rx === ry) return false;
    const a = rutas[rx]!, b = rutas[ry]!;
    if (a[a.length - 1] !== x || b[0] !== y) return false;
    const unida = [...a, ...b];
    if (!factible(inst, segmentoDeSecuencia(inst, [0, ...unida, 0]))) return false;
    rutas[rx] = unida;
    rutas[ry] = null;
    for (const c of b) rutaDe[c] = rx;
    return true;
  };

  for (const [ahorro, i, j] of pares) {
    if (ahorro <= 0) break;
    if (!intentar(i, j)) intentar(j, i);
  }
  return { rutas: rutas.filter((r): r is number[] => r !== null) };
}
