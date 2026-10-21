/**
 * Generador de instancias al estilo de las tres familias de Solomon:
 *  - "R":  clientes uniformes en el cuadrado [0,100]²;
 *  - "C":  clientes agrupados en cúmulos;
 *  - "RC": mitad y mitad.
 *
 * No reproduce las instancias oficiales (no es el procedimiento de Solomon):
 * sirve para tener datos reproducibles con semilla, sin redistribuir archivos
 * de terceros. Las ventanas se construyen alrededor del instante en que un
 * vehículo que sale directo del depósito llegaría al cliente, así que cada
 * cliente es servible con una ruta propia: la instancia siempre es factible
 * si hay vehículos suficientes.
 */
import { crearAleatorio } from "./aleatorio.js";
import { crearInstancia, type Instancia, type Nodo } from "./instancia.js";

export type Familia = "R" | "C" | "RC";

export interface OpcionesGenerador {
  familia: Familia;
  clientes: number;
  semilla: number;
  capacidad?: number;
  /** Fin de la ventana del depósito (horizonte). */
  horizonte?: number;
  /** Ancho medio de las ventanas de los clientes. */
  anchoVentana?: number;
  servicio?: number;
}

export function generarInstancia(op: OpcionesGenerador): Instancia {
  const rnd = crearAleatorio(op.semilla);
  const capacidad = op.capacidad ?? 200;
  const horizonte = op.horizonte ?? 230;
  const anchoMedio = op.anchoVentana ?? 30;
  const servicio = op.servicio ?? 10;
  const deposito: Nodo = { id: 0, x: 50, y: 50, demanda: 0, inicio: 0, fin: horizonte, servicio: 0 };

  const centros = Array.from({ length: Math.max(2, Math.round(op.clientes / 10)) }, () => ({
    x: rnd.entero(10, 90),
    y: rnd.entero(10, 90),
  }));
  const punto = (agrupado: boolean): { x: number; y: number } => {
    if (!agrupado) return { x: rnd.entero(0, 100), y: rnd.entero(0, 100) };
    const c = rnd.elegir(centros);
    const lim = (v: number) => Math.min(100, Math.max(0, v));
    return { x: lim(c.x + rnd.entero(-8, 8)), y: lim(c.y + rnd.entero(-8, 8)) };
  };

  const nodos: Nodo[] = [deposito];
  for (let id = 1; id <= op.clientes; id++) {
    const agrupado = op.familia === "C" || (op.familia === "RC" && id % 2 === 0);
    const { x, y } = punto(agrupado);
    const viaje = Math.hypot(x - deposito.x, y - deposito.y);
    // Último inicio de servicio que todavía permite volver a tiempo al depósito.
    const ultimo = Math.floor(horizonte - servicio - viaje);
    const primero = Math.ceil(viaje);
    if (ultimo < primero) throw new Error("horizonte demasiado corto para el cliente generado");
    const centro = rnd.entero(primero, ultimo);
    const medio = Math.max(1, Math.round(anchoMedio / 2 + (rnd.real() - 0.5) * anchoMedio * 0.5));
    // La ventana siempre contiene un instante alcanzable desde el depósito.
    const inicio = Math.max(0, centro - medio);
    const fin = Math.max(primero, Math.min(ultimo, centro + medio));
    nodos.push({ id, x, y, demanda: rnd.entero(5, 40), inicio, fin, servicio });
  }
  const nombre = `${op.familia}-${op.clientes}-s${op.semilla}`;
  return crearInstancia(nombre, capacidad, op.clientes, nodos);
}
