/**
 * Rasgos del dispositivo que cambian pequeños comportamientos de la interfaz.
 * Puntero fino = ratón o trackpad. En pantallas táctiles (sobre todo iOS como app
 * instalada) el foco programático deja un campo con aspecto de enfocado pero sin
 * aceptar teclas hasta tocarlo; en esos casos no se enfoca nada solo.
 */
export const FINE_POINTER = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
