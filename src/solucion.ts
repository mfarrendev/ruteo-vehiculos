/** Utilidades sobre soluciones que usa el solver (no el verificador). */
import type { Instancia } from "./instancia.js";
import { factible, segmentoDeSecuencia } from "./segmento.js";
import type { Solucion } from "./verificador.js";

export type { Solucion };

export function distanciaRuta(inst: Instancia, clientes: readonly number[]): number {
  if (clientes.length === 0) return 0;
  return segmentoDeSecuencia(inst, [0, ...clientes, 0]).distancia;
}

export function rutaFactible(inst: Instancia, clientes: readonly number[]): boolean {
  return clientes.length === 0 || factible(inst, segmentoDeSecuencia(inst, [0, ...clientes, 0]));
}

export const distanciaTotal = (inst: Instancia, s: Solucion): number =>
  s.rutas.reduce((acc, r) => acc + distanciaRuta(inst, r), 0);

export const vehiculos = (s: Solucion): number => s.rutas.filter((r) => r.length > 0).length;

/**
 * Objetivo jerárquico, el de la literatura de Solomon: primero minimizar
 * vehículos, después distancia. Se codifica como un solo número con un peso
 * grande por vehículo, mayor que cualquier distancia posible de la instancia.
 */
export function pesoVehiculo(inst: Instancia): number {
  let max = 0;
  for (const fila of inst.dist) for (const v of fila) max = Math.max(max, v);
  return Math.max(1, 2 * max * inst.nodos.length);
}

export const costo = (inst: Instancia, s: Solucion, peso = pesoVehiculo(inst)): number =>
  vehiculos(s) * peso + distanciaTotal(inst, s);

export const limpiar = (s: Solucion): Solucion => ({ rutas: s.rutas.filter((r) => r.length > 0).map((r) => [...r]) });
