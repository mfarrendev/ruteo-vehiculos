#!/usr/bin/env node
/**
 * Uso:
 *   ruteo generar --familia R|C|RC --clientes N --semilla S        (escribe Solomon a stdout)
 *   ruteo resolver <instancia.txt> [--metodo ahorros|insercion|local|alns]
 *                  [--iteraciones N] [--semilla S] [--salida solucion.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { generarInstancia, type Familia } from "./generador.js";
import { aJson } from "./salida.js";
import { parsearSolomon, serializarSolomon } from "./solomon.js";
import { resolver, type Metodo } from "./solver.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    familia: { type: "string", default: "R" },
    clientes: { type: "string", default: "25" },
    semilla: { type: "string", default: "1" },
    metodo: { type: "string", default: "alns" },
    iteraciones: { type: "string", default: "2000" },
    salida: { type: "string" },
  },
});

const [orden, archivo] = positionals;
const entero = (v: string | undefined, nombre: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${nombre} debe ser un entero no negativo`);
  return n;
};

if (orden === "generar") {
  const familia = values.familia as Familia;
  if (!["R", "C", "RC"].includes(familia)) throw new Error("--familia debe ser R, C o RC");
  process.stdout.write(
    serializarSolomon(generarInstancia({ familia, clientes: entero(values.clientes, "clientes"), semilla: entero(values.semilla, "semilla") })),
  );
} else if (orden === "resolver" && archivo !== undefined) {
  const metodo = values.metodo as Metodo;
  if (!["ahorros", "insercion", "local", "alns"].includes(metodo)) throw new Error("método desconocido");
  const inst = parsearSolomon(readFileSync(archivo, "utf8"));
  const t0 = performance.now();
  const sol = resolver(inst, { metodo, iteraciones: entero(values.iteraciones, "iteraciones"), semilla: entero(values.semilla, "semilla") });
  const ms = performance.now() - t0;
  const json = aJson(inst, sol, metodo);
  console.log(`${inst.nombre}  método=${metodo}  vehículos=${json.vehiculos}  distancia=${json.distancia.toFixed(2)}  válida=${json.valida}  tiempo=${(ms / 1000).toFixed(2)} s`);
  for (const e of json.errores) console.log(`  error: ${e}`);
  if (values.salida !== undefined) writeFileSync(values.salida, JSON.stringify(json, null, 2) + "\n");
  if (!json.valida) process.exitCode = 1;
} else {
  console.error("uso: ruteo generar --familia R --clientes 25 --semilla 1\n     ruteo resolver <instancia.txt> [--metodo alns] [--iteraciones 2000] [--semilla 1] [--salida sol.json]");
  process.exitCode = 2;
}
