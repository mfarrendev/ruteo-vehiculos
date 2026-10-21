import { describe, expect, it } from "vitest";
import { generarInstancia } from "../src/generador.js";
import { parsearSolomon, serializarSolomon } from "../src/solomon.js";
import { verificar } from "../src/verificador.js";

const texto = `C101

VEHICLE
NUMBER     CAPACITY
  25         200

CUSTOMER
CUST NO.  XCOORD.   YCOORD.    DEMAND   READY TIME  DUE DATE   SERVICE   TIME

    0      40         50          0          0       1236          0
    1      45         68         10        912        967         90
    2      45         70         30        825        870         90
`;

describe("formato Solomon", () => {
  it("lee nombre, flota y clientes", () => {
    const inst = parsearSolomon(texto.replace(/\n/g, "\r\n"));
    expect(inst.nombre).toBe("C101");
    expect(inst.maxVehiculos).toBe(25);
    expect(inst.capacidad).toBe(200);
    expect(inst.nodos).toHaveLength(3);
    expect(inst.nodos[1]).toEqual({ id: 1, x: 45, y: 68, demanda: 10, inicio: 912, fin: 967, servicio: 90 });
    expect(inst.dist[1]![2]).toBeCloseTo(2, 9);
  });

  it("rechaza filas rotas y ids no consecutivos", () => {
    expect(() => parsearSolomon(texto.replace("825        870", "825"))).toThrow(/ilegible/);
    expect(() => parsearSolomon(texto.replace(/\n    2 /, "\n    5 "))).toThrow(/ids/);
    expect(() => parsearSolomon("X\n")).toThrow(/VEHICLE/);
  });

  it("escribir y volver a leer deja la misma instancia", () => {
    const inst = generarInstancia({ familia: "RC", clientes: 25, semilla: 3 });
    const otra = parsearSolomon(serializarSolomon(inst));
    expect(otra.nodos).toEqual(inst.nodos);
    expect(otra.capacidad).toBe(inst.capacidad);
    expect(otra.nombre).toBe(inst.nombre);
  });

  it("el generador produce instancias factibles con una ruta por cliente", () => {
    for (const familia of ["R", "C", "RC"] as const) {
      const inst = generarInstancia({ familia, clientes: 100, semilla: 11 });
      const rutas = inst.nodos.slice(1).map((n) => [n.id]);
      expect(verificar(inst, { rutas }).errores).toEqual([]);
    }
  });
});
