/**
 * Genera docs/ejemplo.html: el visor con una solución incrustada, para verlo
 * sin servidor ni archivos aparte. También deja la solución en
 * docs/ejemplo-solucion.json y la instancia en instancias/.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { generarInstancia } from "./generador.js";
import { aJson } from "./salida.js";
import { serializarSolomon } from "./solomon.js";
import { resolver } from "./solver.js";

const inst = generarInstancia({ familia: "RC", clientes: 100, semilla: 1 });
writeFileSync(`instancias/${inst.nombre}.txt`, serializarSolomon(inst));
const json = aJson(inst, resolver(inst, { metodo: "alns", iteraciones: 1000, semilla: 1 }), "alns");
if (!json.valida) throw new Error("la solución de ejemplo no es válida");
writeFileSync("docs/ejemplo-solucion.json", JSON.stringify(json) + "\n");
const visor = readFileSync("docs/visor.html", "utf8");
const marca = '<script id="datos" type="application/json"></script>';
if (!visor.includes(marca)) throw new Error("docs/visor.html no tiene la marca de datos");
// "<" escapado para que ningún dato pueda cerrar la etiqueta script.
writeFileSync("docs/ejemplo.html", visor.replace(marca, marca.replace("></", `>${JSON.stringify(json).replace(/</g, "\\u003c")}</`)));
console.log(`docs/ejemplo.html: ${inst.nombre}, ${json.vehiculos} vehículos, distancia ${json.distancia}`);
