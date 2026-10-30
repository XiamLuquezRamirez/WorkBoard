/**
 * Planta real de la oficina, recreada del plano dibujado a mano.
 *
 * Las salas están donde están: no se reparten en una rejilla. El plano
 * original es vertical (seis franjas), pero aquí se despliega en tres franjas
 * anchas para que encaje en una pantalla apaisada sin encoger a la gente —
 * la vecindad entre salas se conserva: Proyectos y Dirección arriba, Diseño en
 * el centro, servicios abajo.
 *
 * Cada sala declara su departamento con `depto` (id de la tabla
 * departamentos). Las que no lo tienen —cocina, baños, recepción, salas de
 * reunión— se dibujan igual: son el edificio, aunque nunca tengan puestos.
 *
 * `plazas` son los sitios donde se sienta la gente, tomados de los círculos
 * del plano. Si un departamento tiene más gente que plazas, los puestos de
 * más se colocan al pie de la misma sala.
 */

// Píxeles por unidad de la cuadrícula. Cuanto mayor, más pequeños quedan los
// avatares y los rótulos en relación con la planta, porque se dibujan a
// tamaño fijo. 34 deja la gente legible ya en la vista general.
export const UNIDAD = 34;

/** Mesas, sofás, plantas y demás; decoran, no representan datos. */
const M = (tipo, x, y, ancho = 1, alto = 1, giro = 0) => ({ tipo, x, y, ancho, alto, giro });

export const PISOS = [
    {
        id: 1,
        nombre: 'Primer piso',
        ancho: 43,
        alto: 37,
        salas: [
            // ── Franja superior ────────────────────────────────────────────
            {
                id: 'proyectos',
                nombre: 'Proyectos e Infraestructura',
                corto: 'Proyectos',
                depto: 4,
                x: 1, y: 1, ancho: 15, alto: 9,
                plazas: [[4, 3.4], [8, 3.4], [12, 3.4], [4, 8.2], [8, 8.2], [12, 8.2]],
                muebles: [
                    M('mesa-larga', 3, 5.2, 10.4, 1.8),
                    M('planta', 15, 9),
                    M('pizarra', 1.3, 2, 0.4, 2.6),
                    M('impresora', 14.6, 2.2),
                ],
            },
            {
                id: 'director',
                nombre: 'Dirección de Proyecto',
                corto: 'Dirección',
                depto: 7,
                x: 16.5, y: 1, ancho: 7, alto: 9,
                plazas: [[18.8, 3.6], [21.8, 3.6], [20.3, 7.8]],
                muebles: [
                    M('escritorio', 18, 5.4, 2.6, 1.3),
                    M('escritorio', 21, 5.4, 2.6, 1.3),
                    M('archivador', 22.6, 1.6),
                    M('planta', 17.4, 9.2),
                ],
            },
            {
                id: 'almacen',
                nombre: 'Almacén',
                corto: 'Almacén',
                x: 24, y: 1, ancho: 6, alto: 9,
                muebles: [
                    M('estante', 24.8, 2, 1, 6.2),
                    M('estante', 27.4, 2, 1, 6.2),
                    M('caja', 29, 8.2),
                ],
            },
            {
                id: 'administrativa',
                nombre: 'Gestión Administrativa',
                corto: 'Administrativa',
                depto: 6,
                x: 31, y: 1, ancho: 8, alto: 9,
                plazas: [[33.4, 3.6], [36.8, 3.6], [35.1, 7.8]],
                muebles: [
                    M('escritorio', 32.6, 5.4, 2.6, 1.3),
                    M('escritorio', 36, 5.4, 2.6, 1.3),
                    M('archivador', 38, 1.6),
                    M('planta', 38.2, 9.2),
                ],
            },
            {
                id: 'terraza',
                nombre: 'Terraza',
                corto: 'Terraza',
                x: 39.5, y: 1, ancho: 2.5, alto: 9,
                muebles: [M('planta', 40.8, 3.4), M('planta', 40.8, 6.4), M('planta', 40.8, 9)],
            },

            // ── Franja central ─────────────────────────────────────────────
            {
                id: 'juntas',
                nombre: 'Sala de Juntas',
                corto: 'Sala de Juntas',
                x: 1, y: 10.5, ancho: 7, alto: 10,
                muebles: [
                    M('mesa-redonda', 2.6, 13.4, 3.8, 3.8),
                    M('pizarra', 1.3, 11.6, 0.4, 2.4),
                    M('planta', 7, 19.6),
                    M('sofa', 2, 18.4, 3, 1.1),
                ],
            },
            {
                id: 'diseno',
                nombre: 'Diseño',
                corto: 'Diseño',
                depto: 3,
                x: 8.5, y: 10.5, ancho: 16, alto: 10,
                // Siete sitios alrededor de la mesa central, como en el plano.
                plazas: [[11.6, 12.8], [15.6, 12.8], [19.6, 12.8], [10.2, 16.4], [22.6, 16.4], [13.6, 19.4], [18.6, 19.4]],
                muebles: [
                    M('mesa-larga', 11.6, 14.8, 9.6, 3.2),
                    M('planta', 23.6, 19.8),
                    M('impresora', 9.4, 11.6),
                    M('pizarra', 24.3, 12, 0.4, 3),
                ],
            },
            {
                id: 'educacion',
                nombre: 'Educación e Innovación Pedagógica',
                corto: 'Educación',
                depto: 8,
                x: 25, y: 10.5, ancho: 9, alto: 10,
                plazas: [[27.4, 13], [31.4, 13], [27.4, 18.4], [31.4, 18.4]],
                muebles: [
                    M('mesa-larga', 26.6, 15.2, 6.4, 1.8),
                    M('planta', 33.2, 19.8),
                    M('pizarra', 25.3, 12, 0.4, 2.6),
                ],
            },
            {
                id: 'juridica',
                nombre: 'Jurídica',
                corto: 'Jurídica',
                depto: 2,
                x: 34.5, y: 10.5, ancho: 7.5, alto: 10,
                plazas: [[36.6, 13], [40, 13]],
                muebles: [
                    M('escritorio', 35.8, 14.8, 2.6, 1.3),
                    M('escritorio', 39.2, 14.8, 2.6, 1.3),
                    M('estante', 35.2, 17.4, 1, 2.4),
                    M('planta', 41.2, 19.8),
                ],
            },

            // ── Franja inferior: servicios ─────────────────────────────────
            {
                id: 'sala-1',
                nombre: 'Sala de reuniones',
                corto: 'Sala',
                x: 1, y: 21, ancho: 6, alto: 8,
                muebles: [M('mesa-redonda', 2.4, 23.4, 2.8, 2.8), M('sofa', 1.8, 27, 2.6, 1.1), M('planta', 6.2, 28.4)],
            },
            {
                id: 'bano-1',
                nombre: 'Baño',
                corto: 'Baño',
                x: 7.5, y: 21, ancho: 6, alto: 8,
                muebles: [M('sanitario', 8.4, 22.6), M('sanitario', 11, 22.6), M('lavamanos', 8.4, 26.4, 3.6, 0.9)],
            },
            {
                id: 'cocina',
                nombre: 'Cocina',
                corto: 'Cocina',
                x: 14, y: 21, ancho: 7, alto: 8,
                muebles: [
                    M('encimera', 14.8, 22, 5.4, 1.2),
                    M('nevera', 19.8, 26.6),
                    M('mesa-redonda', 15.4, 25.2, 2.4, 2.4),
                    M('planta', 20.4, 28.4),
                ],
            },
            {
                id: 'escalera',
                nombre: 'Escalera al segundo piso',
                corto: 'Escalera',
                x: 21.5, y: 21, ancho: 5, alto: 8,
                muebles: [M('escalones', 22.3, 22.2, 3.4, 5.8)],
            },
            {
                id: 'sala-2',
                nombre: 'Sala de espera',
                corto: 'Sala',
                x: 27, y: 21, ancho: 7, alto: 8,
                muebles: [
                    M('sofa', 27.8, 22.4, 2.8, 1.1),
                    M('sofa', 27.8, 26.6, 2.8, 1.1),
                    M('mesa-baja', 31.4, 24.4, 1.8, 1.8),
                    M('planta', 33.2, 28.4),
                ],
            },
            {
                id: 'recepcion',
                nombre: 'Recepción',
                corto: 'Recepción',
                x: 34.5, y: 21, ancho: 7.5, alto: 8,
                muebles: [
                    M('mostrador', 35.4, 24.4, 4.4, 1.4),
                    M('planta', 41, 23),
                    M('planta', 41, 28),
                    M('sofa', 35.4, 27, 2.8, 1.1),
                ],
            },
            {
                id: 'soporte',
                nombre: 'Soporte Técnico',
                corto: 'Soporte Técnico',
                // Sin departamento: la gente de Sistemas se sienta en
                // Tecnología (segundo piso). Asignarlo también aquí la
                // duplicaba y el plano mostraba más gente de la que hay.
                x: 14, y: 30, ancho: 12, alto: 6,
                muebles: [
                    M('mesa-larga', 15, 32.4, 9.4, 1.4),
                    M('estante', 24.6, 31, 1, 3.4),
                    M('caja', 14.6, 34.6),
                ],
            },
        ],
    },

    {
        id: 2,
        nombre: 'Segundo piso',
        ancho: 43,
        alto: 25,
        salas: [
            {
                id: 'tecnologia',
                nombre: 'Tecnología',
                corto: 'Tecnología',
                depto: 1,
                x: 1, y: 1, ancho: 18, alto: 12,
                plazas: [[4, 3.4], [8.5, 3.4], [13, 3.4], [4, 9.6], [8.5, 9.6], [13, 9.6]],
                muebles: [
                    M('mesa-larga', 3, 5.6, 11.4, 2.4),
                    M('planta', 17.4, 12.2),
                    M('pizarra', 1.3, 2, 0.4, 3),
                    M('impresora', 16.8, 2.2),
                    M('estante', 16.4, 7.4, 1, 3.4),
                ],
            },
            {
                id: 'escalera-2',
                nombre: 'Escalera',
                corto: 'Escalera',
                x: 19.5, y: 1, ancho: 5, alto: 12,
                muebles: [M('escalones', 20.3, 3, 3.4, 7.6)],
            },
            {
                id: 'contabilidad',
                nombre: 'Contabilidad',
                corto: 'Contabilidad',
                depto: 5,
                x: 25, y: 1, ancho: 17, alto: 12,
                plazas: [[28, 3.4], [32.5, 3.4], [37, 3.4], [28, 9.6], [32.5, 9.6], [37, 9.6]],
                muebles: [
                    M('mesa-larga', 27, 5.6, 11.4, 2.4),
                    M('archivador', 40.4, 1.8),
                    M('archivador', 40.4, 4.4),
                    M('planta', 41, 12.2),
                    M('impresora', 25.6, 2.2),
                ],
            },

            {
                id: 'salon',
                nombre: 'Salón de capacitación',
                corto: 'Salón',
                x: 1, y: 13.5, ancho: 12, alto: 10.5,
                muebles: [
                    M('mesa-larga', 2.4, 16.4, 8.4, 1.4),
                    M('mesa-larga', 2.4, 20, 8.4, 1.4),
                    M('pizarra', 1.3, 14.6, 0.4, 3),
                    M('planta', 12.2, 23.4),
                ],
            },
            {
                id: 'bano-2',
                nombre: 'Baño',
                corto: 'Baño',
                x: 13.5, y: 13.5, ancho: 6, alto: 10.5,
                muebles: [M('sanitario', 14.4, 15.2), M('sanitario', 17, 15.2), M('lavamanos', 14.4, 19.4, 3.6, 0.9)],
            },
            {
                id: 'sala-3',
                nombre: 'Sala de reuniones',
                corto: 'Sala',
                x: 20, y: 13.5, ancho: 9, alto: 10.5,
                muebles: [
                    M('mesa-redonda', 22.6, 16.4, 3.4, 3.4),
                    M('sofa', 21, 21.4, 2.8, 1.1),
                    M('planta', 28.2, 23.4),
                ],
            },
            {
                id: 'archivo',
                nombre: 'Archivo',
                corto: 'Archivo',
                x: 29.5, y: 13.5, ancho: 12.5, alto: 10.5,
                muebles: [
                    M('estante', 30.4, 14.6, 1, 4.4),
                    M('estante', 33.6, 14.6, 1, 4.4),
                    M('estante', 36.8, 14.6, 1, 4.4),
                    M('estante', 30.4, 20.2, 1, 3),
                    M('caja', 40, 22),
                ],
            },
        ],
    },
];

/**
 * Reparte a la gente del servidor en las plazas del plano.
 *
 * Los puestos llegan agrupados por departamento (`zonas`); se colocan en la
 * sala cuyo `depto` coincide. Quien no tenga sala en ningún piso va a una
 * lista aparte, visible, en vez de perderse.
 */
export function repartirEnPlano(piso, zonas) {
    const porDepto = new Map();
    for (const z of zonas) {
        porDepto.set(Number(z.id), [...z.puestos]);
    }

    const colocadas = piso.salas.map((sala) => {
        const gente = sala.depto ? (porDepto.get(sala.depto) || []) : [];
        if (sala.depto) porDepto.delete(sala.depto);

        const plazas = sala.plazas || [];
        const puestos = gente.map((p, i) => {
            if (i < plazas.length) {
                return { puesto: p, x: plazas[i][0], y: plazas[i][1] };
            }
            // Más gente que plazas dibujadas: se añaden en fila al pie de la
            // sala, dentro de sus paredes, en vez de dejarlas fuera.
            const sobra = i - plazas.length;
            return {
                puesto: p,
                x: sala.x + 1.6 + (sobra % 3) * 3.4,
                y: sala.y + sala.alto - 1.6 - Math.floor(sobra / 3) * 2.8,
            };
        });

        return { ...sala, puestos, zona: zonas.find((z) => Number(z.id) === sala.depto) || null };
    });

    // Sólo son «sin sala» los departamentos que NINGÚN piso contempla: los
    // del otro piso no faltan, simplemente no están en éste.
    const enAlgunPiso = new Set(
        PISOS.flatMap((p) => p.salas.map((s) => s.depto)).filter(Boolean)
    );

    const sinSala = [];
    for (const [id, gente] of porDepto) {
        if (enAlgunPiso.has(id) || gente.length === 0) continue;
        sinSala.push({ zona: zonas.find((x) => Number(x.id) === id), puestos: gente });
    }

    return { salas: colocadas, sinSala };
}
