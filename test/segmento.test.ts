/*
 * Medición (2026-10-20, arnés que exige que corran las 5 pruebas):
 *  - violación de ventana anulada en concatenar ("const viol = 0"): caen 4 de 5.
 *  - l sin desplazar por delta ("Math.min(b.l, a.l)"): caen 2 de 5.
 *  - espera anulada ("const espera = 0"): caen 0 de 5, y es correcto: es una
 *    mutación equivalente para este proyecto. La espera que se deja de sumar a
 *    dur aparece en e, y e + dur, tw y l no cambian; solo importaría si hubiera
 *    un tope de duración de ruta, que el modelo no tiene.
 * Se revirtió y vuelven las 5.
 */
import { describe, expect, it } from "vitest";
import { crearAleatorio } from "../src/aleatorio.js";
import { generarInstancia } from "../src/generador.js";
import { crearInstancia, type Instancia } from "../src/instancia.js";
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

  it("cuenta la espera forzada cuando la salida no se puede atrasar", () => {
    // A cierra temprano (no se puede salir tarde del depósito) y B abre tarde:
    // el vehículo tiene que esperar en B, y esa espera es parte de la duración.
    const inst = crearInstancia("espera", 100, 2, [
      { id: 0, x: 0, y: 0, demanda: 0, inicio: 0, fin: 500, servicio: 0 },
      { id: 1, x: 10, y: 0, demanda: 1, inicio: 10, fin: 12, servicio: 5 },
      { id: 2, x: 20, y: 0, demanda: 1, inicio: 100, fin: 110, servicio: 5 },
    ]);
    const s = segmentoDeSecuencia(inst, [0, 1, 2, 0]);
    expect(factible(inst, s)).toBe(true);
    // Sale en 0..2, llega a B en ≤27, espera hasta 100, sirve 5, vuelve 20 → 125.
    expect(s.e + s.dur).toBeCloseTo(simular(inst, [1, 2]).fin, 9);
    expect(s.e + s.dur).toBeCloseTo(125, 9);
    // Con B cerrando antes de que el regreso quepa en el horizonte, infactible.
    const corta = crearInstancia("corta", 100, 2, [{ ...inst.nodos[0]!, fin: 120 }, ...inst.nodos.slice(1)]);
    expect(factible(corta, segmentoDeSecuencia(corta, [0, 1, 2, 0]))).toBe(false);
  });

  it("da lo mismo asociar la concatenación por la izquierda o por la derecha", () => {
    const rnd = crearAleatorio(13);
    for (const inst of instancias) {
      for (let k = 0; k < 200; k++) {
        const ids = [0, ...rnd.barajar(Array.from({ length: 30 }, (_, i) => i + 1)).slice(0, 5), 0];
        const izq = segmentoDeSecuencia(inst, ids);
        const corte = rnd.entero(1, ids.length - 1);
        const der = unir(inst, segmentoDeSecuencia(inst, ids.slice(0, corte)), segmentoDeSecuencia(inst, ids.slice(corte)));
        expect(der.tw > 1e-9).toBe(izq.tw > 1e-9);
        if (izq.tw <= 1e-9) expect(der.e + der.dur).toBeCloseTo(izq.e + izq.dur, 6);
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
