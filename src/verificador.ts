/**
 * Verificador independiente de soluciones.
 *
 * Deliberadamente NO comparte código con el solver: no usa la matriz de
 * distancias de la instancia ni la evaluación por segmentos. Recalcula todo
 * desde las coordenadas simulando cada ruta paso a paso. Si el solver tiene un
 * error en su aritmética incremental, este módulo no lo hereda; por eso todas
 * las pruebas pasan sus resultados por aquí.
 */
import type { Instancia } from "./instancia.js";

export interface Solucion {
  /** Cada ruta es la secuencia de clientes, SIN el depósito en los extremos. */
  rutas: number[][];
}

export interface Verificacion {
  valida: boolean;
  errores: string[];
  distancia: number;
  vehiculos: number;
}

const EPS = 1e-6;

export function verificar(inst: Instancia, sol: Solucion): Verificacion {
  const errores: string[] = [];
  const n = inst.nodos.length - 1;
  const visitas = new Array<number>(n + 1).fill(0);
  const dep = inst.nodos[0]!;
  const viaje = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  let distancia = 0;
  let vehiculos = 0;

  sol.rutas.forEach((ruta, r) => {
    if (ruta.length === 0) return; // una ruta vacía no usa vehículo
    vehiculos++;
    let carga = 0;
    let t = dep.inicio;
    let previo = dep;
    for (const id of ruta) {
      if (!Number.isInteger(id) || id < 1 || id > n) {
        errores.push(`ruta ${r}: cliente inexistente ${id}`);
        return;
      }
      const c = inst.nodos[id]!;
      visitas[id]!++;
      const tramo = viaje(previo, c);
      distancia += tramo;
      t = Math.max(t + tramo, c.inicio);
      if (t > c.fin + EPS) errores.push(`ruta ${r}: llega al cliente ${id} en ${t.toFixed(2)}, después de su fin ${c.fin}`);
      t += c.servicio;
      carga += c.demanda;
      previo = c;
    }
    const vuelta = viaje(previo, dep);
    distancia += vuelta;
    t += vuelta;
    if (t > dep.fin + EPS) errores.push(`ruta ${r}: vuelve al depósito en ${t.toFixed(2)}, después de ${dep.fin}`);
    if (carga > inst.capacidad + EPS) errores.push(`ruta ${r}: carga ${carga} supera la capacidad ${inst.capacidad}`);
  });

  for (let id = 1; id <= n; id++) {
    if (visitas[id] === 0) errores.push(`cliente ${id} sin visitar`);
    else if (visitas[id]! > 1) errores.push(`cliente ${id} visitado ${visitas[id]} veces`);
  }
  if (vehiculos > inst.maxVehiculos) errores.push(`usa ${vehiculos} vehículos y hay ${inst.maxVehiculos}`);
  return { valida: errores.length === 0, errores, distancia, vehiculos };
}
