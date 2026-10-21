/**
 * Óptimo exacto por fuerza bruta, para instancias de hasta ~8 clientes. Sirve
 * de referencia en las pruebas.
 *
 * 1. Enumera en profundidad todas las secuencias de clientes que salen del
 *    depósito, cortando apenas un prefijo es infactible (una violación de
 *    ventana o de capacidad no se arregla agregando clientes). Para cada
 *    conjunto de clientes guarda la ruta factible más corta que lo cubre.
 * 2. Programación dinámica sobre subconjuntos: la mejor partición de todos los
 *    clientes en rutas, con objetivo jerárquico (vehículos, luego distancia) y
 *    respetando el tope de vehículos.
 */
import type { Instancia } from "./instancia.js";
import { concatenar, factible, segmentoDeNodo, type Segmento } from "./segmento.js";
import type { Solucion } from "./verificador.js";

export function optimoExacto(inst: Instancia): { solucion: Solucion; vehiculos: number; distancia: number } | null {
  const n = inst.nodos.length - 1;
  if (n > 9) throw new Error(`fuerza bruta con ${n} clientes es demasiado`);
  const total = 1 << n;
  const mejorRuta = new Float64Array(total).fill(Infinity);
  const secuencia: (number[] | null)[] = new Array(total).fill(null);
  const deposito = segmentoDeNodo(inst, 0);

  const dfs = (seg: Segmento, mask: number, sec: number[]) => {
    for (let c = 1; c <= n; c++) {
      const bit = 1 << (c - 1);
      if (mask & bit) continue;
      const s = concatenar(inst, seg, segmentoDeNodo(inst, c));
      if (!factible(inst, s)) continue;
      const m = mask | bit;
      sec.push(c);
      const cerrada = concatenar(inst, s, deposito);
      if (factible(inst, cerrada) && cerrada.distancia < mejorRuta[m]!) {
        mejorRuta[m] = cerrada.distancia;
        secuencia[m] = [...sec];
      }
      dfs(s, m, sec);
      sec.pop();
    }
  };
  dfs(deposito, 0, []);

  // f[m] = (vehículos, distancia) óptimos para cubrir m.
  const veh = new Float64Array(total).fill(Infinity);
  const dist = new Float64Array(total).fill(Infinity);
  const eleccion = new Int32Array(total);
  veh[0] = 0;
  dist[0] = 0;
  for (let m = 1; m < total; m++) {
    const bajo = m & -m; // el cliente de menor índice va en alguna ruta: evita contar particiones repetidas
    for (let sub = m; sub > 0; sub = (sub - 1) & m) {
      if (!(sub & bajo) || mejorRuta[sub] === Infinity) continue;
      const resto = m ^ sub;
      const v = veh[resto]! + 1, dd = dist[resto]! + mejorRuta[sub]!;
      if (v < veh[m]! || (v === veh[m]! && dd < dist[m]! - 1e-12)) {
        veh[m] = v;
        dist[m] = dd;
        eleccion[m] = sub;
      }
    }
  }
  const lleno = total - 1;
  if (veh[lleno] === Infinity || veh[lleno]! > inst.maxVehiculos) return null;
  const rutas: number[][] = [];
  for (let m = lleno; m > 0; m ^= eleccion[m]!) rutas.push(secuencia[eleccion[m]!]!);
  return { solucion: { rutas }, vehiculos: veh[lleno]!, distancia: dist[lleno]! };
}
