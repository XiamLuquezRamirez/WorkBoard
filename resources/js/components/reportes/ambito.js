import { createContext } from 'react';

/**
 * Parámetros que acotan todos los informes de una ventana. Administración no
 * pasa ninguno; la ventana de los líderes pasa {equipo: 1}: su equipo, sin sus
 * propias tareas. El servidor lo aplica; sólo puede reducir lo que se ve.
 */
export const AmbitoInforme = createContext({});
