/**
 * Benchmark reproducible: instancias generadas con semilla (no las oficiales
 * de Solomon, ver README) y, para las chicas, comparación con el óptimo
 * exacto. Todo resultado pasa por el verificador independiente.
 */
import { optimoExacto } from "./exacto.js";
import { generarInstancia, type Familia } from "./generador.js";
import type { Instancia } from "./instancia.js";
import { resolver, type Metodo } from "./solver.js";
import { verificar } from "./verificador.js";

const ITERACIONES = Number(process.env.ITERACIONES ?? 5000);
const SEMILLA = 1;

function correr(inst: Instancia, metodo: Metodo) {
  const t0 = performance.now();
  const sol = resolver(inst, { metodo, iteraciones: ITERACIONES, semilla: SEMILLA });
  const ms = performance.now() - t0;
  const v = verificar(inst, sol);
  if (!v.valida) throw new Error(`${inst.nombre} ${metodo}: solución inválida: ${v.errores.join("; ")}`);
  return { v, ms };
}

console.log(`Benchmark: ALNS con ${ITERACIONES} iteraciones, semilla ${SEMILLA}, Node ${process.version}\n`);
console.log("| instancia | ahorros | I1 | búsqueda local | ALNS | tiempo ALNS |");
console.log("|---|---|---|---|---|---|");
const fmt = (r: ReturnType<typeof correr>) => `${r.v.vehiculos} / ${r.v.distancia.toFixed(1)}`;
for (const clientes of [25, 100]) {
  for (const familia of ["R", "C", "RC"] as Familia[]) {
    const inst = generarInstancia({ familia, clientes, semilla: 1 });
    const filas = (["ahorros", "insercion", "local", "alns"] as Metodo[]).map((m) => correr(inst, m));
    console.log(`| ${inst.nombre} | ${filas.map(fmt).join(" | ")} | ${(filas[3]!.ms / 1000).toFixed(2)} s |`);
  }
}
console.log("\nCeldas: vehículos / distancia. Objetivo jerárquico: primero vehículos.\n");

console.log("Contra el óptimo exacto (fuerza bruta), 8 clientes:\n");
console.log("| instancia | óptimo | ALNS | brecha |");
console.log("|---|---|---|---|");
let iguales = 0, total = 0;
for (const familia of ["R", "C", "RC"] as Familia[]) {
  for (const semilla of [1, 2, 3, 4]) {
    const inst = generarInstancia({ familia, clientes: 8, semilla, capacidad: 60, anchoVentana: 40 });
    const o = optimoExacto(inst)!;
    const r = correr(inst, "alns");
    const brecha = r.v.vehiculos === o.vehiculos ? `${Math.max(0, ((r.v.distancia - o.distancia) / o.distancia) * 100).toFixed(2)} %` : "más vehículos";
    total++;
    if (r.v.vehiculos === o.vehiculos && Math.abs(r.v.distancia - o.distancia) < 1e-6) iguales++;
    console.log(`| ${inst.nombre} | ${o.vehiculos} / ${o.distancia.toFixed(2)} | ${r.v.vehiculos} / ${r.v.distancia.toFixed(2)} | ${brecha} |`);
  }
}
console.log(`\nÓptimo alcanzado en ${iguales} de ${total}.`);
