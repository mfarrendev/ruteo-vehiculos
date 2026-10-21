/** Formato JSON de una solución, el que lee el visor de docs/visor.html. */
import type { Instancia } from "./instancia.js";
import { verificar, type Solucion } from "./verificador.js";

export interface SolucionJson {
  instancia: string;
  metodo: string;
  vehiculos: number;
  distancia: number;
  valida: boolean;
  errores: string[];
  rutas: number[][];
  nodos: Array<{ id: number; x: number; y: number; demanda: number; inicio: number; fin: number }>;
}

export function aJson(inst: Instancia, sol: Solucion, metodo: string): SolucionJson {
  const v = verificar(inst, sol);
  return {
    instancia: inst.nombre,
    metodo,
    vehiculos: v.vehiculos,
    distancia: Math.round(v.distancia * 100) / 100,
    valida: v.valida,
    errores: v.errores,
    rutas: sol.rutas.filter((r) => r.length > 0),
    nodos: inst.nodos.map(({ id, x, y, demanda, inicio, fin }) => ({ id, x, y, demanda, inicio, fin })),
  };
}
