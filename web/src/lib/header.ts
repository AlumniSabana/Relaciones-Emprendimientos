/** Acercamiento (respecto al encuadre inicial) desde el que el encabezado empieza a desvanecerse. */
const FADE_START = 1.05;
/** Acercamiento al que el encabezado ya no se ve. */
const FADE_END = 1.5;

/** Opacidad del encabezado: 1 con el encuadre inicial (o alejado) y 0 al acercar lo suficiente. */
export function headerOpacity(zoomRatio: number): number {
  const t = (zoomRatio - FADE_START) / (FADE_END - FADE_START);
  return Math.min(1, Math.max(0, 1 - t));
}
