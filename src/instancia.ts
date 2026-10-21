/**
 * Modelo de una instancia CVRPTW. El nodo 0 es el depósito; los clientes son
 * 1..n. Las distancias son euclidianas en punto flotante, sin redondear: es la
 * convención más usada en la literatura reciente sobre Solomon (la de los
 * mejores conocidos jerárquicos), pero no la única; ver README.
 */
export interface Nodo {
  id: number;
  x: number;
  y: number;
  demanda: number;
  /** Inicio de la ventana de tiempo (READY TIME). */
  inicio: number;
  /** Fin de la ventana: el servicio debe EMPEZAR a más tardar aquí (DUE DATE). */
  fin: number;
  servicio: number;
}

export interface Instancia {
  nombre: string;
  capacidad: number;
  /** Tope de vehículos disponibles (en Solomon, VEHICLE NUMBER). */
  maxVehiculos: number;
  /** nodos[0] es el depósito. */
  nodos: Nodo[];
  /** Matriz de distancias (= tiempos de viaje), fila por nodo. */
  dist: Float64Array[];
}

export function crearInstancia(
  nombre: string,
  capacidad: number,
  maxVehiculos: number,
  nodos: Nodo[],
): Instancia {
  if (nodos.length === 0) throw new Error("la instancia necesita al menos el depósito");
  nodos.forEach((n, i) => {
    if (n.id !== i) throw new Error(`el nodo en la posición ${i} tiene id ${n.id}: se esperan ids 0..n consecutivos`);
  });
  const dist = nodos.map((a) => {
    const fila = new Float64Array(nodos.length);
    nodos.forEach((b, j) => {
      fila[j] = Math.hypot(a.x - b.x, a.y - b.y);
    });
    return fila;
  });
  return { nombre, capacidad, maxVehiculos, nodos, dist };
}

export const numClientes = (inst: Instancia): number => inst.nodos.length - 1;

export function nodo(inst: Instancia, i: number): Nodo {
  const n = inst.nodos[i];
  if (n === undefined) throw new Error(`nodo ${i} no existe`);
  return n;
}

export const d = (inst: Instancia, i: number, j: number): number => inst.dist[i]![j]!;
