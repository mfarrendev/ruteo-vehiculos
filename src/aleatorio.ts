/**
 * Generador pseudoaleatorio con semilla (mulberry32). Todo lo que es azar en
 * este proyecto —generador de instancias, ALNS, pruebas— pasa por aquí, para
 * que una corrida se repita idéntica con la misma semilla.
 */
export interface Aleatorio {
  /** Real uniforme en [0, 1). */
  real(): number;
  /** Entero uniforme en [min, max] (ambos incluidos). */
  entero(min: number, max: number): number;
  /** Elemento uniforme de un arreglo no vacío. */
  elegir<T>(xs: readonly T[]): T;
  /** Baraja en el lugar (Fisher-Yates) y devuelve el mismo arreglo. */
  barajar<T>(xs: T[]): T[];
}

export function crearAleatorio(semilla: number): Aleatorio {
  let a = semilla >>> 0;
  const real = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entero = (min: number, max: number): number => min + Math.floor(real() * (max - min + 1));
  return {
    real,
    entero,
    elegir<T>(xs: readonly T[]): T {
      if (xs.length === 0) throw new Error("elegir: arreglo vacío");
      return xs[entero(0, xs.length - 1)] as T;
    },
    barajar<T>(xs: T[]): T[] {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = entero(0, i);
        const t = xs[i] as T;
        xs[i] = xs[j] as T;
        xs[j] = t;
      }
      return xs;
    },
  };
}
