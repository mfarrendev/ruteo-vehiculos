/**
 * Lector y escritor del formato de texto de las instancias de Solomon (1987):
 *
 *   C101
 *
 *   VEHICLE
 *   NUMBER     CAPACITY
 *     25         200
 *
 *   CUSTOMER
 *   CUST NO.  XCOORD.   YCOORD.    DEMAND   READY TIME  DUE DATE   SERVICE   TIME
 *
 *       0      40         50          0          0       1236          0
 *       1      45         68         10        912        967         90
 *
 * El lector es tolerante con espacios y líneas vacías, pero estricto con los
 * datos: exige ids consecutivos desde 0 y siete columnas numéricas por fila.
 */
import { crearInstancia, type Instancia, type Nodo } from "./instancia.js";

export function parsearSolomon(texto: string): Instancia {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim());
  const nombre = lineas.find((l) => l.length > 0);
  if (nombre === undefined) throw new Error("archivo vacío");

  const iVeh = lineas.findIndex((l) => /^VEHICLE\b/i.test(l));
  if (iVeh < 0) throw new Error("falta la sección VEHICLE");
  const filaVeh = lineas.slice(iVeh + 1).find((l) => /^\d/.test(l));
  if (filaVeh === undefined) throw new Error("falta la fila NUMBER CAPACITY");
  const [maxVehiculos, capacidad] = filaVeh.split(/\s+/).map(Number);
  if (!Number.isFinite(maxVehiculos) || !Number.isFinite(capacidad)) {
    throw new Error(`fila de vehículos ilegible: "${filaVeh}"`);
  }

  const iCli = lineas.findIndex((l) => /^CUSTOMER\b/i.test(l));
  if (iCli < 0) throw new Error("falta la sección CUSTOMER");
  const nodos: Nodo[] = [];
  for (const l of lineas.slice(iCli + 1)) {
    if (!/^\d/.test(l)) continue;
    const c = l.split(/\s+/).map(Number);
    if (c.length !== 7 || c.some((v) => !Number.isFinite(v))) {
      throw new Error(`fila de cliente ilegible: "${l}"`);
    }
    const [id, x, y, demanda, inicio, fin, servicio] = c as [number, number, number, number, number, number, number];
    nodos.push({ id, x, y, demanda, inicio, fin, servicio });
  }
  return crearInstancia(nombre, capacidad!, maxVehiculos!, nodos);
}

export function serializarSolomon(inst: Instancia): string {
  const n = (v: number, ancho: number) => String(v).padStart(ancho);
  const filas = inst.nodos.map(
    (c) => `${n(c.id, 5)}${n(c.x, 10)}${n(c.y, 10)}${n(c.demanda, 10)}${n(c.inicio, 12)}${n(c.fin, 11)}${n(c.servicio, 10)}`,
  );
  return [
    inst.nombre,
    "",
    "VEHICLE",
    "NUMBER     CAPACITY",
    `${n(inst.maxVehiculos, 5)}${n(inst.capacidad, 13)}`,
    "",
    "CUSTOMER",
    "CUST NO.  XCOORD.   YCOORD.    DEMAND   READY TIME  DUE DATE   SERVICE   TIME",
    "",
    ...filas,
    "",
  ].join("\n");
}
