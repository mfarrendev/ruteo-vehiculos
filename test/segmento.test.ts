/*
 * Medición (2026-10-20): en src/segmento.ts se cambió la espera de la
 * concatenación por 0 ("const espera = 0"). Cayeron 2 de 3 pruebas de este
 * archivo (las dos que comparan contra la simulación directa); la de
 * prefijos/sufijos sigue en verde porque es consistente consigo misma, y por
 * eso las otras dos existen. Se revirtió y vuelven las 3.
 */
import { describe, expect, it } from "vitest";
import { crearAleatorio } from "../src/aleatorio.js";
import { generarInstancia } from "../src/generador.js";
import type { Instancia } from "../src/instancia.js";
import { factible, indexarRuta, segmentoDeSecuencia, unir } from "../src/segmento.js";
import { verificar } from "../src/verificador.js";

/** Simulación directa, la referencia contra la que se mide. */
function simular(inst: Instancia, clientes: number[]) {
  const nodos = [0, ...clientes, 0];
  let t = inst.nodos[0]!.inicio;
  let ok = true;
  let carga = 0;
  for (let k = 1; k < nodos.length; k++) {
    const a = nodos[k - 1]!, b = nodos[k]!;
    t = Math.max(t + inst.nodos[a]!.servicio + inst.dist[a]![b]!, inst.nodos[b]!.inicio);
    if (t > inst.nodos[b]!.fin + 1e-9) ok = false;
    carga += inst.nodos[b]!.demanda;
  }
  return { ok: ok && carga <= inst.capacidad, fin: t };
}

const instancias = [1, 2, 3].flatMap((s) =>
  (["R", "C", "RC"] as const).map((f) => generarInstancia({ familia: f, clientes: 30, semilla: s, anchoVentana: 60 })),
);

describe("concatenación de segmentos", () => {
  it("coincide con la simulación directa en factibilidad y hora de llegada", () => {
    const rnd = crearAleatorio(5);
    let factibles = 0, infactibles = 0;
    for (const inst of instancias) {
      for (let k = 0; k < 400; k++) {
        const ids = rnd.barajar(Array.from({ length: 30 }, (_, i) => i + 1)).slice(0, rnd.entero(1, 6));
        const s = segmentoDeSecuencia(inst, [0, ...ids, 0]);
        const ref = simular(inst, ids);
        expect(factible(inst, s)).toBe(ref.ok);
        expect(factible(inst, s)).toBe(verificar({ ...inst, maxVehiculos: 99 }, { rutas: [ids] }).errores.filter((e) => !/sin visitar/.test(e)).length === 0);
        if (ref.ok) {
          // Saliendo en e (el depósito abre en 0) la ruta termina en e + dur.
          expect(s.e + s.dur).toBeCloseTo(ref.fin, 6);
          factibles++;
        } else infactibles++;
      }
    }
    // La prueba solo vale si ejercita los dos lados.
    expect(factibles).toBeGreaterThan(200);
    expect(infactibles).toBeGreaterThan(200);
  });

  it("evalúa bien un trozo movido entre un prefijo y un sufijo", () => {
    const rnd = crearAleatorio(8);
    for (const inst of instancias) {
      for (let k = 0; k < 200; k++) {
        const ids = rnd.barajar(Array.from({ length: 30 }, (_, i) => i + 1)).slice(0, 7);
        const ruta = indexarRuta(inst, ids.slice(0, 4));
        const corte = rnd.entero(0, 4);
        const medio = ids.slice(4);
        const s = unir(inst, ruta.pre[corte]!, segmentoDeSecuencia(inst, medio), ruta.suf[corte + 1]!);
        const esperado = [...ids.slice(0, corte), ...medio, ...ids.slice(corte, 4)];
        expect(factible(inst, s)).toBe(simular(inst, esperado).ok);
      }
    }
  });

  it("prefijo más sufijo reconstruyen la ruta completa", () => {
    const inst = instancias[0]!;
    const ruta = indexarRuta(inst, [3, 9, 14, 2, 27]);
    const total = segmentoDeSecuencia(inst, ruta.nodos);
    for (let i = 0; i < ruta.nodos.length - 1; i++) {
      const s = unir(inst, ruta.pre[i]!, ruta.suf[i + 1]!);
      expect(s.distancia).toBeCloseTo(total.distancia, 9);
      expect(s.tw).toBeCloseTo(total.tw, 9);
    }
  });
});
