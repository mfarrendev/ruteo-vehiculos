/** Punto de entrada del solver: construcción, búsqueda local y ALNS. */
import { ahorros } from "./construccion/ahorros.js";
import { insercionI1Mejor } from "./construccion/insercion.js";
import type { Instancia } from "./instancia.js";
import { alns, type OpcionesAlns } from "./mejora/alns.js";
import { busquedaLocal } from "./mejora/busqueda-local.js";
import { costo } from "./solucion.js";
import type { Solucion } from "./verificador.js";

export type Metodo = "ahorros" | "insercion" | "local" | "alns";

export interface OpcionesSolver extends OpcionesAlns {
  metodo?: Metodo;
}

export function resolver(inst: Instancia, op: OpcionesSolver = {}): Solucion {
  const metodo = op.metodo ?? "alns";
  if (metodo === "ahorros") return ahorros(inst);
  if (metodo === "insercion") return insercionI1Mejor(inst);
  const candidatas = [busquedaLocal(inst, ahorros(inst)), busquedaLocal(inst, insercionI1Mejor(inst))];
  const inicial = candidatas.reduce((a, b) => (costo(inst, b) < costo(inst, a) ? b : a));
  if (metodo === "local") return inicial;
  return alns(inst, inicial, op).solucion;
}
