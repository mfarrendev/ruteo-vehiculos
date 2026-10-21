/*
 * Medición (2026-10-20, arnés que exige que corran las 9 pruebas):
 *  - sin la comprobación de capacidad en src/verificador.ts caen 1 de 9
 *    ("rechaza sobrecarga"). La mutación "fusionar todas las rutas" de la
 *    prueba con una solución real NO la detecta, porque esa fusión rompe
 *    también ventanas; por eso existe la prueba a mano de sobrecarga.
 *  - sin la comprobación de clientes repetidos caen 1 de 9 ("rechaza clientes
 *    repetidos, faltantes e inexistentes").
 * Se revirtió y vuelven las 9.
 */
import { describe, expect, it } from "vitest";
import { crearAleatorio } from "../src/aleatorio.js";
import { generarInstancia } from "../src/generador.js";
import { crearInstancia, type Nodo } from "../src/instancia.js";
import { verificar, type Solucion } from "../src/verificador.js";
import { resolver } from "../src/solver.js";

// Instancia a mano: depósito en el origen, tres clientes en línea.
const nodos: Nodo[] = [
  { id: 0, x: 0, y: 0, demanda: 0, inicio: 0, fin: 100, servicio: 0 },
  { id: 1, x: 3, y: 4, demanda: 5, inicio: 0, fin: 10, servicio: 1 },
  { id: 2, x: 6, y: 8, demanda: 5, inicio: 0, fin: 20, servicio: 1 },
  { id: 3, x: 0, y: 10, demanda: 8, inicio: 30, fin: 40, servicio: 1 },
];
const chica = crearInstancia("chica", 10, 3, nodos);

describe("verificador", () => {
  it("acepta una solución válida y calcula su distancia", () => {
    const v = verificar(chica, { rutas: [[1, 2], [3]] });
    expect(v.errores).toEqual([]);
    expect(v.valida).toBe(true);
    // 0->1 = 5, 1->2 = 5, 2->0 = 10, 0->3->0 = 20
    expect(v.distancia).toBeCloseTo(40, 9);
    expect(v.vehiculos).toBe(2);
  });

  it("rechaza sobrecarga", () => {
    const v = verificar(chica, { rutas: [[1, 3], [2]] });
    expect(v.valida).toBe(false);
    expect(v.errores.join()).toMatch(/capacidad/);
  });

  it("rechaza llegar después del fin de la ventana", () => {
    // 0->2 (10) ->1: llega en 10+1+5 = 16 > 10.
    const v = verificar(chica, { rutas: [[2, 1], [3]] });
    expect(v.valida).toBe(false);
    expect(v.errores.join()).toMatch(/cliente 1 .*fin 10/);
  });

  it("acepta esperar si se llega antes del inicio", () => {
    expect(verificar(chica, { rutas: [[1], [2], [3]] }).valida).toBe(true);
  });

  it("rechaza clientes repetidos, faltantes e inexistentes", () => {
    expect(verificar(chica, { rutas: [[1, 2], [3, 1]] }).errores.join()).toMatch(/visitado 2 veces/);
    expect(verificar(chica, { rutas: [[1, 2]] }).errores.join()).toMatch(/cliente 3 sin visitar/);
    expect(verificar(chica, { rutas: [[1, 2], [3], [9]] }).errores.join()).toMatch(/inexistente 9/);
    expect(verificar(chica, { rutas: [[1, 2], [3], [0]] }).valida).toBe(false);
  });

  it("rechaza volver tarde al depósito", () => {
    const corta = crearInstancia("corta", 100, 3, [{ ...nodos[0]!, fin: 30 }, ...nodos.slice(1)]);
    expect(verificar(corta, { rutas: [[1, 2], [3]] }).errores.join()).toMatch(/vuelve al depósito/);
  });

  it("rechaza usar más vehículos que los disponibles", () => {
    const dos = crearInstancia("dos", 10, 2, nodos);
    expect(verificar(dos, { rutas: [[1], [2], [3]] }).errores.join()).toMatch(/vehículos/);
  });

  it("no cuenta las rutas vacías como vehículos", () => {
    expect(verificar(chica, { rutas: [[1, 2], [], [3]] }).vehiculos).toBe(2);
  });

  it("rechaza cada mutación de una solución real", () => {
    const inst = generarInstancia({ familia: "R", clientes: 40, semilla: 7, capacidad: 100 });
    const base = resolver(inst, { metodo: "local", semilla: 1 });
    expect(verificar(inst, base).valida).toBe(true);
    const rnd = crearAleatorio(99);
    const copia = (): number[][] => base.rutas.map((r) => [...r]);
    const mutaciones: Array<[string, () => Solucion]> = [
      ["duplicar un cliente", () => { const r = copia(); r[0]!.push(r[1]![0]!); return { rutas: r }; }],
      ["quitar un cliente", () => { const r = copia(); r[0]!.pop(); return { rutas: r }; }],
      ["fusionar todas las rutas", () => ({ rutas: [copia().flat()] })],
      ["invertir la ruta más larga", () => {
        const r = copia();
        const i = r.reduce((m, x, k) => (x.length > r[m]!.length ? k : m), 0);
        r[i]!.reverse();
        return { rutas: r };
      }],
      ["cliente fuera de rango", () => { const r = copia(); r[0]![0] = 41; return { rutas: r }; }],
    ];
    for (const [nombre, mutar] of mutaciones) {
      expect(verificar(inst, mutar()).valida, nombre).toBe(false);
    }
    // Barajar al azar los clientes de una ruta larga casi siempre rompe ventanas.
    let rechazos = 0;
    for (let k = 0; k < 20; k++) {
      const r = copia();
      const larga = r.reduce((m, x, i) => (x.length > r[m]!.length ? i : m), 0);
      const antes = r[larga]!.join();
      rnd.barajar(r[larga]!);
      if (r[larga]!.join() === antes) continue;
      if (!verificar(inst, { rutas: r }).valida) rechazos++;
    }
    expect(rechazos).toBeGreaterThan(15);
  });
});
