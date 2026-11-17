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
                // Adonde camina quien está en reunión (ver repartirEnPlano).
                destino: 'reunion',
                nombre: 'Sala de Juntas',
                corto: 'Sala de Juntas',
                x: 1, y: 10.5, ancho: 7, alto: 10,
                muebles: [
                    M('alfombra', 2, 12.8, 5, 5),
                    M('mesa-redonda', 2.6, 13.4, 3.8, 3.8),
                    M('pizarra', 1.3, 11.6, 0.4, 2.4),
                    M('tv', 7.55, 13.4, 0.35, 3.4),
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
                muebles: [M('alfombra', 1.9, 22.9, 3.8, 3.8), M('mesa-redonda', 2.4, 23.4, 2.8, 2.8), M('sofa', 1.8, 27, 2.6, 1.1), M('planta', 6.2, 28.4)],
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
                destino: 'almuerzo',
                nombre: 'Cocina',
                corto: 'Cocina',
                x: 14, y: 21, ancho: 7, alto: 8,
                muebles: [
                    M('encimera', 14.8, 22, 5.4, 1.2),
                    M('cafetera', 15.3, 22.15),
                    M('nevera', 19.8, 26.6),
                    M('dispensador', 14.9, 27.9),
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
                    M('alfombra', 30.8, 23.8, 3, 3),
                    M('mesa-baja', 31.4, 24.4, 1.8, 1.8),
                    M('dispensador', 33.2, 22),
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
                    M('alfombra', 37.5, 28.1, 1.6, 0.75),
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
                    M('dispensador', 1.6, 11.6),
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
                destino: 'reunion',
                nombre: 'Salón de capacitación',
                corto: 'Salón',
                x: 1, y: 13.5, ancho: 12, alto: 10.5,
                muebles: [
                    M('tv', 12.55, 15.6, 0.35, 4.4),
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
                    M('alfombra', 22, 15.8, 4.6, 4.6),
                    M('mesa-redonda', 22.6, 16.4, 3.4, 3.4),
                    M('tv', 28.55, 16.4, 0.35, 3.4),
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

const MESAS = ['mesa-larga', 'escritorio', 'mesa-redonda'];

/**
 * Hacia qué lado de su mesa queda una plaza: 'n' si la persona se sienta al
 * norte de la mesa, 's' al sur, 'o' y 'e' en las cabeceras. Orienta la silla
 * y el portátil, que de otro modo mirarían todos hacia el mismo sitio.
 */
function ladoDeMesa(px, py, muebles) {
    const mesas = muebles.filter((m) => MESAS.includes(m.tipo));
    const holgura = 0.3;

    const enFrente = mesas.find((m) => px >= m.x - holgura && px <= m.x + m.ancho + holgura);
    if (enFrente) {
        const arriba = py < enFrente.y + enFrente.alto / 2;
        // El portátil no puede colgar del canto aunque la plaza esté justo
        // en la esquina de la mesa.
        const x = Math.min(Math.max(px, enFrente.x + 0.5), enFrente.x + enFrente.ancho - 0.5);
        return { lado: arriba ? 'n' : 's', mesa: enFrente, x, y: arriba ? enFrente.y : enFrente.y + enFrente.alto };
    }

    const alCostado = mesas.find((m) => py >= m.y - holgura && py <= m.y + m.alto + holgura);
    if (alCostado) {
        const izquierda = px < alCostado.x + alCostado.ancho / 2;
        const y = Math.min(Math.max(py, alCostado.y + 0.5), alCostado.y + alCostado.alto - 0.5);
        return { lado: izquierda ? 'o' : 'e', mesa: alCostado, x: izquierda ? alCostado.x : alCostado.x + alCostado.ancho, y };
    }

    return { lado: 'n', mesa: null };
}

/** Mueve una sala entera —paredes, muebles, gente— `dx` y `dy` unidades. */
function desplazar(sala, dx, dy = 0) {
    if (!dx && !dy) return sala;
    const mover = (o) => ({ ...o, x: o.x + dx, y: o.y + dy });
    return {
        ...sala,
        x: sala.x + dx,
        y: sala.y + dy,
        muebles: (sala.muebles || []).map(mover),
        puestos: sala.puestos.map(mover),
        sillasLibres: sala.sillasLibres.map(mover),
        portatiles: sala.portatiles.map(mover),
    };
}

/**
 * Deja en el plano sólo las áreas con personal y cierra los huecos que dejan
 * las demás: en cada franja, las salas de la derecha se corren a la
 * izquierda, y las franjas que se quedan sin nada desaparecen y las de abajo
 * suben. Un hueco de césped en mitad del edificio parecía una sala derribada;
 * así la planta sigue leyéndose como un edificio continuo.
 *
 * Las salas de servicio (cocina, baños, escaleras, salas de reuniones…) no
 * tienen personal propio, así que tampoco se dibujan: el plano muestra dónde
 * está la gente, sin relleno alrededor.
 */
function compactar(salas, piso) {
    // Las salas adonde se camina (juntas, cocina) siempre se ven: si
    // aparecieran sólo con alguien dentro, la franja entera daría un salto
    // cada vez que alguien entra a una reunión. Un área con toda su gente
    // fuera tampoco desaparece: sus sillas esperan a que vuelvan.
    const vacia = (s) => s.puestos.length === 0 && !s.destino && !s.retenida;

    const filas = new Map();
    for (const s of salas) {
        if (!filas.has(s.y)) filas.set(s.y, []);
        filas.get(s.y).push(s);
    }

    const corrimiento = new Map();
    for (const fila of filas.values()) {
        fila.sort((a, b) => a.x - b.x);
        let acumulado = 0;
        fila.forEach((s, i) => {
            if (vacia(s)) {
                // Se quita la sala y el pasillo que la separaba de la siguiente.
                const siguiente = fila[i + 1];
                acumulado += siguiente ? siguiente.x - s.x : s.ancho;
            } else {
                corrimiento.set(s.id, acumulado);
            }
        });
    }

    // Franjas enteras sin nadie: se quitan y las de debajo suben lo que
    // ocupaba la franja más su pasillo.
    const ys = [...filas.keys()].sort((a, b) => a - b);
    const subida = new Map();
    let acumuladoY = 0;
    ys.forEach((y, i) => {
        if (filas.get(y).some((s) => !vacia(s))) {
            subida.set(y, acumuladoY);
        } else if (i + 1 < ys.length) {
            acumuladoY += ys[i + 1] - y;
        }
    });

    const visibles = salas
        .filter((s) => !vacia(s))
        .map((s) => desplazar(s, -corrimiento.get(s.id), -subida.get(s.y)));

    // Las ventanas van en los muros que dan a la calle: arriba, a la
    // izquierda y en la última sala de cada franja.
    const ultimaDeFila = new Map();
    for (const s of visibles) {
        const actual = ultimaDeFila.get(s.y);
        if (!actual || s.x > actual.x) ultimaDeFila.set(s.y, s);
    }

    const conVentanas = visibles.map((s) => ({
        ...s,
        ventanas: { n: s.y <= 1, o: s.x <= 1, e: ultimaDeFila.get(s.y) === s },
    }));

    // Cada franja apoya sobre un piso de pasillo; la unión de todas es la
    // huella del edificio, y entre sala y sala se ve pasillo, no césped.
    // Se agrupan por la posición ya desplazada, no por la original.
    const franjas = [...new Set(conVentanas.map((s) => s.y))].map((y) => {
        const fila = conVentanas.filter((s) => s.y === y);
        const x0 = Math.min(...fila.map((s) => s.x));
        const x1 = Math.max(...fila.map((s) => s.x + s.ancho));
        const y1 = Math.max(...fila.map((s) => s.y + s.alto));
        return { x: x0, y, ancho: x1 - x0, alto: y1 - y };
    });

    const derecha = Math.max(0, ...conVentanas.map((s) => s.x + s.ancho));
    const abajo = Math.max(0, ...conVentanas.map((s) => s.y + s.alto));

    return {
        salas: conVentanas,
        franjas,
        ancho: Math.min(piso.ancho, derecha + 1),
        alto: Math.min(piso.alto, abajo + 1),
        ocultas: salas.filter(vacia).length,
    };
}

/**
 * Sitios para quien llega de visita (a una reunión, a almorzar): alrededor
 * de la mesa redonda si la sala tiene una, a lo largo de las mesas largas si
 * no, y en cuadrícula como último recurso. Con más gente que sitio se abre
 * un segundo anillo, para que nadie quede encima de otro.
 */
function plazasDeVisita(sala, n) {
    const muebles = sala.muebles || [];
    const redonda = muebles.find((m) => m.tipo === 'mesa-redonda');
    if (redonda) {
        const cx = redonda.x + redonda.ancho / 2;
        const cy = redonda.y + redonda.alto / 2;
        const porAnillo = Math.max(4, Math.floor((redonda.ancho + 2) * 1.6));
        return Array.from({ length: n }, (_, i) => {
            const anillo = Math.floor(i / porAnillo);
            const enAnillo = Math.min(porAnillo, n - anillo * porAnillo);
            const ang = -Math.PI / 2 + (2 * Math.PI * (i % porAnillo)) / enAnillo + anillo * 0.4;
            const r = redonda.ancho / 2 + 0.9 + anillo * 1.9;
            return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.92];
        });
    }

    const largas = muebles.filter((m) => m.tipo === 'mesa-larga');
    if (largas.length) {
        const sitios = [];
        for (const m of largas) {
            for (let x = m.x + 1; x < m.x + m.ancho - 0.4; x += 2.1) {
                sitios.push([x, m.y - 0.9], [x, m.y + m.alto + 1.1]);
            }
        }
        // Si sobrara gente, la tanda siguiente se corre un poco.
        return Array.from({ length: n }, (_, i) => {
            const [x, y] = sitios[i % sitios.length];
            const tanda = Math.floor(i / sitios.length);
            return [x + tanda * 0.8, y + tanda * 0.6];
        });
    }

    const cols = Math.max(1, Math.floor((sala.ancho - 1) / 2.4));
    return Array.from({ length: n }, (_, i) => [
        sala.x + 1.5 + (i % cols) * 2.4,
        sala.y + 2.5 + Math.floor(i / cols) * 2.6,
    ]);
}

/**
 * Reparte a la gente del servidor en las plazas del plano.
 *
 * Los puestos llegan agrupados por departamento (`zonas`); se colocan en la
 * sala cuyo `depto` coincide. Quien no tenga sala en ningún piso va a una
 * lista aparte, visible, en vez de perderse. Las áreas sin personal no se
 * dibujan (ver `compactar`).
 */
export function repartirEnPlano(piso, zonas) {
    const porDepto = new Map();
    for (const z of zonas) {
        porDepto.set(Number(z.id), [...z.puestos]);
    }

    // Adónde camina cada quien. Una reunión de la agenda trae su sala y
    // reúne ahí a todos sus asistentes, aunque trabajen en el otro piso: en
    // éste se dibuja sólo si la sala es de este piso, y si es del otro, la
    // persona no está en su puesto. Sin sala explícita (en reunión elegido a
    // mano, almorzando) se usa la sala de ese tipo de su mismo piso; si el
    // piso no la tiene, se queda en su puesto.
    const destinos = new Map();
    for (const s of piso.salas) {
        if (s.destino && !destinos.has(s.destino)) destinos.set(s.destino, s);
    }
    const salasDelPiso = new Set(piso.salas.map((s) => s.id));
    const enOtroPiso = new Set(PISOS.flatMap((p) => p.salas.map((s) => s.id)).filter((id) => !salasDelPiso.has(id)));
    const visitas = new Map();
    const visitar = (salaId, p) => {
        if (!visitas.has(salaId)) visitas.set(salaId, []);
        visitas.get(salaId).push(p);
    };
    // Devuelve la sala de este piso adonde va, OTRO_PISO, o null si se queda.
    const OTRO_PISO = '__otro_piso__';
    const fuera = (p) => {
        const explicita = p.presencia?.sala;
        if (explicita && salasDelPiso.has(explicita)) return explicita;
        if (explicita && enOtroPiso.has(explicita)) return OTRO_PISO;
        const sala = destinos.get(p.presencia?.estado);
        return sala ? sala.id : null;
    };

    // Quien trabaja en otro piso pero tiene su reunión en éste, llega aquí.
    const deptosDelPiso = new Set(piso.salas.map((s) => s.depto).filter(Boolean));
    for (const z of zonas) {
        if (deptosDelPiso.has(Number(z.id))) continue;
        for (const p of z.puestos) {
            const sala = p.presencia?.sala;
            if (sala && salasDelPiso.has(sala)) visitar(sala, p);
        }
    }

    const colocadas = piso.salas.map((sala) => {
        const gente = sala.depto ? (porDepto.get(sala.depto) || []) : [];
        if (sala.depto) porDepto.delete(sala.depto);

        const plazas = sala.plazas || [];
        const muebles = sala.muebles || [];
        const enSuSitio = gente.map((p, i) => {
            if (i < plazas.length) {
                return { puesto: p, x: plazas[i][0], y: plazas[i][1], plaza: i };
            }
            // Más gente que plazas dibujadas: se añaden en fila al pie de la
            // sala, dentro de sus paredes, en vez de dejarlas fuera.
            const sobra = i - plazas.length;
            return {
                puesto: p,
                x: sala.x + 1.6 + (sobra % 3) * 3.4,
                y: sala.y + sala.alto - 1.6 - Math.floor(sobra / 3) * 2.8,
                plaza: -1,
            };
        });

        const puestos = [];
        const sillasFuera = [];
        for (const c of enSuSitio) {
            const destino = fuera(c.puesto);
            if (!destino) { puestos.push(c); continue; }
            if (destino !== OTRO_PISO) visitar(destino, c.puesto);
            // Su silla queda vacía mientras tanto, con el portátil apagado.
            if (c.plaza >= 0) sillasFuera.push(c.plaza);
        }
        const ocupada = (i) => i < gente.length && !sillasFuera.includes(i);

        // Las plazas sin nadie se ven como sillas vacías: dicen cuánto sitio
        // libre queda en el área sin tener que contar.
        const sillasLibres = plazas
            .map(([x, y], i) => ({ x, y, i }))
            .filter(({ i }) => !ocupada(i))
            .map(({ x, y }) => ({ x, y, lado: ladoDeMesa(x, y, muebles).lado }));

        // Un portátil en la mesa delante de cada plaza: encendido si alguien
        // se sienta ahí, cerrado si no. Los escritorios ya traen monitor.
        const portatiles = plazas.map(([px, py], i) => {
            const r = ladoDeMesa(px, py, muebles);
            if (!r.mesa || r.mesa.tipo !== 'mesa-larga') return null;
            return { x: r.x, y: r.y, lado: r.lado, encendido: ocupada(i) };
        }).filter(Boolean);

        return {
            ...sala,
            puestos,
            retenida: gente.length > 0,
            sillasLibres,
            portatiles,
            zona: zonas.find((z) => Number(z.id) === sala.depto) || null,
        };
    });

    // Los visitantes se sientan alrededor de la mesa de la sala de destino.
    for (const sala of colocadas) {
        const llegados = visitas.get(sala.id);
        if (!llegados) continue;
        // Los de una misma reunión, juntos alrededor de la mesa.
        const gente = [...llegados].sort((a, b) => (a.presencia?.reunion || 0) - (b.presencia?.reunion || 0));
        const sitios = plazasDeVisita(sala, gente.length);
        gente.forEach((p, i) => sala.puestos.push({ puesto: p, x: sitios[i][0], y: sitios[i][1], visita: true }));
    }

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

    return { ...compactar(colocadas, piso), sinSala };
}
