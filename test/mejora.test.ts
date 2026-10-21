/*
 * Medición (2026-10-20, arnés que exige que corran las 6 pruebas):
 *  - sin comprobar la factibilidad de la ruta B en relocate/cross
 *    (src/mejora/busqueda-local.ts): caen 3 de 6; el verificador rechaza lo
 *    que devuelve la búsqueda.
 *  - 2-opt* que pierde un cliente al reconstruir la ruta B ("ca.slice(i + 1)"):
 *    cae 1 de 6 ("cada operador por separado"); con todos los operadores
 *    juntos 2-opt* casi nunca llega a aplicarse, por eso existe esa prueba.
 *  - aceptar movimientos que empeoran (MEJORA = -1) no se pudo medir: la
 *    búsqueda cicla para siempre, que es justamente lo que el criterio de
 *    mejora estricta evita.
 * Se revirtió y vuelven las 6.
 */
import { describe, expect, it } from "vitest";
import { ahorros } from "../src/construccion/ahorros.js";
import { insercionI1, insercionI1Mejor } from "../src/construccion/insercion.js";
import { generarInstancia, type Familia } from "../src/generador.js";
import { alns } from "../src/mejora/alns.js";
import { busquedaLocal, OPERADORES } from "../src/mejora/busqueda-local.js";
import { costo } from "../src/solucion.js";
import { verificar } from "../src/verificador.js";

const familias: Familia[] = ["R", "C", "RC"];
const casos = familias.flatMap((f) => [1, 2, 3, 4].map((s) => generarInstancia({ familia: f, clientes: 35, semilla: s, capacidad: 120, anchoVentana: 50 })));

const valida = (inst: Parameters<typeof verificar>[0], sol: Parameters<typeof verificar>[1]) => {
  const v = verificar(inst, sol);
  expect(v.errores, inst.nombre).toEqual([]);
  return v;
};

describe("construcción", () => {
  it("ahorros e I1 dan soluciones factibles", () => {
    for (const inst of casos) {
      valida(inst, ahorros(inst));
      valida(inst, insercionI1(inst));
      valida(inst, insercionI1Mejor(inst));
    }
  });
});

describe("búsqueda local", () => {
  it("nunca empeora el costo ni rompe la factibilidad", () => {
    let mejoras = 0;
    for (const inst of casos) {
      for (const inicial of [ahorros(inst), insercionI1(inst)]) {
        const antes = valida(inst, inicial);
        const despues = valida(inst, busquedaLocal(inst, inicial));
        expect(despues.vehiculos).toBeLessThanOrEqual(antes.vehiculos);
        if (despues.vehiculos === antes.vehiculos) expect(despues.distancia).toBeLessThanOrEqual(antes.distancia + 1e-9);
        if (despues.distancia < antes.distancia - 1e-6 || despues.vehiculos < antes.vehiculos) mejoras++;
      }
    }
    // Si nunca mejorara nada, la prueba no estaría midiendo la búsqueda.
    expect(mejoras).toBeGreaterThan(casos.length);
  });

  it("cada operador por separado nunca empeora y mantiene la factibilidad", () => {
    for (const operador of OPERADORES) {
      let mejoro = 0;
      for (const inst of casos.slice(0, 6)) {
        const inicial = insercionI1(inst, { mu: 1, lambda: 1, alfa1: 0 });
        const despues = busquedaLocal(inst, inicial, { operadores: [operador] });
        valida(inst, despues);
        expect(costo(inst, despues)).toBeLessThanOrEqual(costo(inst, inicial) + 1e-9);
        if (costo(inst, despues) < costo(inst, inicial) - 1e-6) mejoro++;
      }
      expect(mejoro, `${operador} no mejoró ninguna instancia`).toBeGreaterThan(0);
    }
  });

  it("es un óptimo local: correrla de nuevo no cambia nada", () => {
    const inst = casos[5]!;
    const una = busquedaLocal(inst, ahorros(inst));
    expect(costo(inst, busquedaLocal(inst, una))).toBeCloseTo(costo(inst, una), 9);
  });
});

describe("ALNS", () => {
  it("devuelve soluciones factibles y no peores que la búsqueda local", () => {
    for (const inst of casos.filter((_, k) => k % 2 === 0)) {
      const inicial = busquedaLocal(inst, insercionI1Mejor(inst));
      const r = alns(inst, inicial, { iteraciones: 150, semilla: 3 });
      valida(inst, r.solucion);
      expect(costo(inst, r.solucion)).toBeLessThanOrEqual(costo(inst, inicial) + 1e-9);
    }
  });

  it("con la misma semilla da exactamente la misma solución", () => {
    const inst = casos[1]!;
    const ini = insercionI1Mejor(inst);
    const a = alns(inst, ini, { iteraciones: 120, semilla: 42 });
    const b = alns(inst, ini, { iteraciones: 120, semilla: 42 });
    expect(a.solucion).toEqual(b.solucion);
  });
});
