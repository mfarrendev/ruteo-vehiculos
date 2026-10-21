/*
 * Medición (2026-10-20, arnés que exige que corran las 3 pruebas): en
 * src/exacto.ts se anularon las dos comprobaciones de factibilidad (el corte
 * de prefijos y el cierre de la ruta). Caen 3 de 3. Anulando solo el cierre
 * caen 0 de 3: el corte de prefijos ya descarta casi todo y el generador hace
 * que volver al depósito rara vez sea la restricción que manda.
 * Se revirtió y vuelven las 3.
 */
import { describe, expect, it } from "vitest";
import { crearAleatorio } from "../src/aleatorio.js";
import { optimoExacto } from "../src/exacto.js";
import { generarInstancia, type Familia } from "../src/generador.js";
import { resolver } from "../src/solver.js";
import { verificar } from "../src/verificador.js";

const instancias = (["R", "C", "RC"] as Familia[]).flatMap((familia) =>
  [1, 2, 3, 4, 5].map((semilla) =>
    generarInstancia({ familia, clientes: semilla % 2 === 0 ? 6 : 7, semilla, capacidad: 60, anchoVentana: 40 }),
  ),
);

/** Referencia ingenua: todas las permutaciones con todos los cortes posibles. */
function porPermutaciones(inst: (typeof instancias)[number]): number {
  const n = inst.nodos.length - 1;
  let mejor = Infinity, mejorVeh = Infinity;
  const perm = (resto: number[], hecho: number[]) => {
    if (resto.length === 0) {
      for (let cortes = 0; cortes < 1 << (n - 1); cortes++) {
        const rutas: number[][] = [[hecho[0]!]];
        for (let k = 1; k < n; k++) {
          if (cortes & (1 << (k - 1))) rutas.push([]);
          rutas[rutas.length - 1]!.push(hecho[k]!);
        }
        const v = verificar(inst, { rutas });
        if (v.valida && (v.vehiculos < mejorVeh || (v.vehiculos === mejorVeh && v.distancia < mejor))) {
          mejorVeh = v.vehiculos;
          mejor = v.distancia;
        }
      }
      return;
    }
    resto.forEach((c, i) => perm([...resto.slice(0, i), ...resto.slice(i + 1)], [...hecho, c]));
  };
  perm(Array.from({ length: n }, (_, i) => i + 1), []);
  return mejorVeh * 1e6 + mejor;
}

describe("óptimo exacto", () => {
  it("coincide con la enumeración ingenua y pasa el verificador", () => {
    for (const inst of instancias.filter((i) => i.nodos.length - 1 === 6)) {
      const o = optimoExacto(inst)!;
      const v = verificar(inst, o.solucion);
      expect(v.errores).toEqual([]);
      expect(v.distancia).toBeCloseTo(o.distancia, 9);
      expect(o.vehiculos * 1e6 + o.distancia).toBeCloseTo(porPermutaciones(inst), 6);
    }
  });

  it("el solver alcanza el óptimo en instancias de 6 y 7 clientes", () => {
    let iguales = 0;
    for (const inst of instancias) {
      const o = optimoExacto(inst)!;
      const s = resolver(inst, { metodo: "alns", iteraciones: 300, semilla: 1 });
      const v = verificar(inst, s);
      expect(v.errores).toEqual([]);
      expect(v.vehiculos).toBe(o.vehiculos);
      // Nunca mejor que el óptimo (si lo fuera, el exacto estaría mal) y a lo sumo 1 % peor.
      expect(v.distancia).toBeGreaterThanOrEqual(o.distancia - 1e-6);
      expect(v.distancia).toBeLessThanOrEqual(o.distancia * 1.01);
      if (Math.abs(v.distancia - o.distancia) < 1e-6) iguales++;
    }
    expect(iguales).toBeGreaterThanOrEqual(instancias.length - 1);
  });

  it("detecta instancias sin solución con la flota disponible", () => {
    const rnd = crearAleatorio(1);
    const inst = generarInstancia({ familia: "R", clientes: 6, semilla: rnd.entero(1, 99), capacidad: 40 });
    expect(optimoExacto({ ...inst, maxVehiculos: 1 })).toBeNull();
  });
});
