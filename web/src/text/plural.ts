/** «1 registro», «3 registros». Evita cifras con plural incorrecto en la interfaz. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
