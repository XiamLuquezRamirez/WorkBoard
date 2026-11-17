import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAvatar } from './AvataresContext';
// El archivo de datos se llama distinto que este componente a propósito:
// con el mismo nombre, webpack resolvía «./PlanoOficina» al .js y no al
// .jsx, y el componente quedaba sin exportar.
import { PISOS, UNIDAD, repartirEnPlano } from './distribucionOficina';

/**
 * Orden de gravedad de las señales: lo que impide avanzar pesa más que lo que
 * sólo va tarde. Manda el color del puesto y el de la sala.
 */
const SENALES = {
    bloqueado:    { peso: 5, etiqueta: 'Bloqueado',    icono: '⛔' },
    pausa:        { peso: 4, etiqueta: 'En pausa',     icono: '⏸' },
    atrasado:     { peso: 3, etiqueta: 'Con atraso',   icono: '!' },
    sin_criterio: { peso: 2, etiqueta: 'Sin criterio', icono: '◌' },
    trabajando:   { peso: 1, etiqueta: 'Trabajando',   icono: '•' },
    libre:        { peso: 0, etiqueta: 'Sin trabajo abierto', icono: '' },
};

/**
 * Presencia: lo que cada quien eligió (o lo que se deduce) para que los demás
 * sepan si pueden interrumpirle. El punto de color va junto a la cara.
 */
export const PRESENCIA = {
    disponible:   { etiqueta: 'Disponible',   icono: '🟢' },
    ocupado:      { etiqueta: 'Ocupado',      icono: '🔴' },
    reunion:      { etiqueta: 'En reunión',   icono: '📅' },
    almuerzo:     { etiqueta: 'Almorzando',   icono: '☕' },
    ausente:      { etiqueta: 'Ausente',      icono: '🌙' },
    desconectado: { etiqueta: 'Desconectado', icono: '⚪' },
};

const ACTIVIDAD = {
    tarea:       'trabajando en una tarea',
    escribiendo: 'escribiendo en el chat',
    equipo:      'usando el equipo',
};

/** Lo que dura el paseo de un sitio a otro; igual que la transición del CSS. */
const PASEO_MS = 1900;

const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const primerNombre = (nombre) => String(nombre || '').trim().split(/\s+/)[0] || '—';

const U = (v) => v * UNIDAD;

// ─── Mobiliario ─────────────────────────────────────────────────────────────

/**
 * Enseres de la oficina. Son decorado: dan escala y hacen reconocible cada
 * sala, pero no representan ningún dato y no reciben el ratón.
 */
function Mueble({ m }) {
    const x = U(m.x);
    const y = U(m.y);
    const w = U(m.ancho);
    const h = U(m.alto);
    const giro = m.giro ? `rotate(${m.giro} ${x} ${y})` : undefined;

    switch (m.tipo) {
        case 'mesa-larga':
            return (
                <g transform={giro}>
                    <rect className="po-mueble po-mesa" x={x} y={y} width={w} height={h} rx="5" />
                    <rect className="po-mesa-luz" x={x + 5} y={y + 5} width={Math.max(0, w - 10)} height="3" rx="1.5" />
                </g>
            );
        case 'mesa-redonda':
            return (
                <>
                    <ellipse className="po-mueble po-mesa" cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />
                    <ellipse className="po-mesa-luz" cx={x + w / 2} cy={y + h / 2} rx={w / 3} ry={h / 3} />
                </>
            );
        case 'mesa-baja':
            return <rect className="po-mueble po-mesa" x={x} y={y} width={w} height={h} rx="4" />;
        case 'escritorio':
            return (
                <g>
                    <rect className="po-mueble po-mesa" x={x} y={y} width={w} height={h} rx="4" />
                    <rect className="po-monitor" x={x + w / 2 - 11} y={y + 3} width="22" height="13" rx="2" />
                    <rect className="po-monitor-luz" x={x + w / 2 - 8} y={y + 5.5} width="16" height="8" rx="1.5" />
                </g>
            );
        case 'sofa':
            return (
                <g>
                    <rect className="po-mueble po-sofa" x={x} y={y} width={w} height={h} rx="7" />
                    <rect className="po-sofa-cojin" x={x + 4} y={y + 4} width={Math.max(0, w - 8)} height={Math.max(0, h - 10)} rx="4" />
                </g>
            );
        case 'archivador':
        case 'nevera':
            return (
                <g>
                    <rect className="po-mueble" x={x} y={y} width={U(0.9)} height={U(1.4)} rx="3" />
                    <line className="po-linea" x1={x + 4} y1={y + U(0.7)} x2={x + U(0.9) - 4} y2={y + U(0.7)} />
                </g>
            );
        case 'estante':
            return (
                <g>
                    <rect className="po-mueble" x={x} y={y} width={w} height={h} rx="3" />
                    {Array.from({ length: Math.max(1, Math.floor(m.alto)) }).map((_, i) => (
                        <line key={i} className="po-linea" x1={x} y1={y + U(i + 1)} x2={x + w} y2={y + U(i + 1)} />
                    ))}
                </g>
            );
        case 'encimera':
        case 'mostrador':
            return (
                <g>
                    <rect className="po-mueble po-encimera" x={x} y={y} width={w} height={h} rx="4" />
                    <rect className="po-encimera-luz" x={x + 6} y={y + 4} width={Math.max(0, w - 12)} height="3" rx="1.5" />
                </g>
            );
        case 'sanitario':
            return (
                <g>
                    <ellipse className="po-sanitario" cx={x + U(0.4)} cy={y + U(0.45)} rx={U(0.3)} ry={U(0.38)} />
                    <rect className="po-sanitario" x={x + U(0.15)} y={y} width={U(0.5)} height={U(0.22)} rx="3" />
                </g>
            );
        case 'lavamanos':
            return <rect className="po-sanitario" x={x} y={y} width={w} height={h} rx="5" />;
        case 'escalones':
            return (
                <g>
                    <rect className="po-mueble po-escalera" x={x} y={y} width={w} height={h} rx="3" />
                    {Array.from({ length: 7 }).map((_, i) => (
                        <line key={i} className="po-linea" x1={x} y1={y + (h / 7) * (i + 1)} x2={x + w} y2={y + (h / 7) * (i + 1)} />
                    ))}
                </g>
            );
        case 'pizarra':
            return (
                <g>
                    <rect className="po-pizarra" x={x} y={y} width={w} height={h} rx="2" />
                    <rect className="po-pizarra-trazo" x={x + 2} y={y + 8} width={Math.max(1, w - 4)} height="2.5" rx="1" />
                    <rect className="po-pizarra-trazo" x={x + 2} y={y + h / 2} width={Math.max(1, w - 6)} height="2.5" rx="1" />
                </g>
            );
        case 'impresora':
            return (
                <g>
                    <rect className="po-impresora" x={x} y={y} width={U(1.1)} height={U(0.9)} rx="3" />
                    <rect className="po-mesa-luz" x={x + 5} y={y + U(0.55)} width={U(1.1) - 10} height="4" rx="2" />
                    <circle className="po-impresora-luz" cx={x + U(0.9)} cy={y + 7} r="2.4" />
                </g>
            );
        case 'caja':
            return (
                <g>
                    <rect className="po-caja" x={x} y={y} width={U(0.85)} height={U(0.8)} rx="2" />
                    <rect className="po-caja-cinta" x={x + U(0.36)} y={y} width={U(0.13)} height={U(0.8)} />
                </g>
            );
        case 'alfombra':
            return (
                <g>
                    <rect className="po-alfombra" x={x} y={y} width={w} height={h} rx="6" />
                    <rect className="po-alfombra-borde" x={x + 5} y={y + 5} width={Math.max(0, w - 10)} height={Math.max(0, h - 10)} rx="4" />
                </g>
            );
        case 'tv':
            return (
                <g>
                    <rect className="po-tv" x={x} y={y} width={w} height={h} rx="2" />
                    <rect className="po-tv-luz" x={x + 3} y={y + 2.5} width={Math.max(0, w - 6)} height={Math.max(1, h - 5)} rx="1" />
                </g>
            );
        case 'cafetera':
            return (
                <g>
                    <rect className="po-cafetera" x={x} y={y} width={U(0.7)} height={U(0.8)} rx="3" />
                    <circle className="po-cafe" cx={x + U(0.35)} cy={y + U(0.48)} r={U(0.17)} />
                </g>
            );
        case 'dispensador':
            return (
                <g>
                    <rect className="po-mueble" x={x} y={y} width={U(0.8)} height={U(0.8)} rx="3" />
                    <circle className="po-garrafon" cx={x + U(0.4)} cy={y + U(0.4)} r={U(0.3)} />
                    <circle className="po-garrafon-luz" cx={x + U(0.32)} cy={y + U(0.32)} r={U(0.09)} />
                </g>
            );
        case 'planta':
            return (
                <g className="po-planta">
                    <ellipse className="po-hojas" cx={x} cy={y - 7} rx="13" ry="12" />
                    <ellipse className="po-hojas-2" cx={x - 5} cy={y - 12} rx="7" ry="7" />
                    <ellipse className="po-hojas-2" cx={x + 6} cy={y - 11} rx="6" ry="6" />
                    <path className="po-maceta" d={`M ${x - 8} ${y + 2} L ${x + 8} ${y + 2} L ${x + 6} ${y + 15} L ${x - 6} ${y + 15} Z`} />
                </g>
            );
        default:
            return null;
    }
}

/** Giro según el lado de la mesa en que queda la plaza (ver ladoDeMesa). */
const GIRO_LADO = { n: 0, e: 90, s: 180, o: -90 };

/**
 * Silla de una plaza sin nadie: el respaldo queda del lado contrario a la
 * mesa. Dice cuánto sitio libre tiene el área sin contar cabezas.
 */
function SillaLibre({ s }) {
    return (
        <g className="po-silla" transform={`translate(${U(s.x)} ${U(s.y)}) rotate(${GIRO_LADO[s.lado] || 0})`}>
            <rect className="po-silla-asiento" x="-12" y="-8" width="24" height="20" rx="6" />
            <rect className="po-silla-respaldo" x="-13" y="-15" width="26" height="7" rx="3.5" />
        </g>
    );
}

/**
 * Portátil sobre el borde de la mesa, de cara a su plaza. Encendido (y con
 * su taza al lado) cuando alguien se sienta ahí.
 */
function Portatil({ p }) {
    return (
        <g
            className={`po-portatil${p.encendido ? ' es-encendido' : ''}`}
            transform={`translate(${U(p.x)} ${U(p.y)}) rotate(${GIRO_LADO[p.lado] || 0})`}
        >
            <rect className="po-portatil-base" x="-12" y="4" width="24" height="14" rx="2" />
            <rect className="po-portatil-teclas" x="-9" y="7" width="18" height="6" rx="1" />
            <rect className="po-portatil-pantalla" x="-12" y="18" width="24" height="5" rx="1.5" />
            {p.encendido && <circle className="po-taza" cx="19" cy="10" r="4" />}
        </g>
    );
}

/**
 * Ventanas repartidas a lo largo de los muros que dan a la calle. Se
 * dibujan sobre el grosor del muro, como en un plano de arquitecto.
 */
function ventanasDe(sala) {
    const x = U(sala.x);
    const y = U(sala.y);
    const w = U(sala.ancho);
    const h = U(sala.alto);
    const tramos = (largo) => {
        const n = Math.max(1, Math.floor(largo / U(3.2)));
        const paso = largo / n;
        const hueco = Math.min(U(1.8), paso - U(0.6));
        return Array.from({ length: n }, (_, i) => ({ centro: paso * (i + 0.5), hueco }));
    };

    const lados = sala.ventanas || {};
    const v = [];
    if (lados.n) tramos(w).forEach((t) => v.push({ x: x + t.centro - t.hueco / 2, y: y - 5, width: t.hueco, height: 6 }));
    if (lados.o) tramos(h - U(1.4)).forEach((t) => v.push({ x: x - 5, y: y + t.centro - t.hueco / 2, width: 6, height: t.hueco }));
    if (lados.e) tramos(h - U(1.4)).forEach((t) => v.push({ x: x + w - 1, y: y + t.centro - t.hueco / 2, width: 6, height: t.hueco }));
    return v;
}

// ─── Puesto ─────────────────────────────────────────────────────────────────

/**
 * Colores de camiseta por departamento. Que cada área vista distinto hace
 * que el plano se lea de un vistazo, como en un juego: no hace falta el
 * rótulo para saber de dónde es alguien.
 */
const ROPA = {
    1: ['#2563EB', '#1D4ED8'],   // Sistemas — azul
    2: ['#7C3AED', '#6D28D9'],   // Jurídica — morado
    3: ['#DB2777', '#BE185D'],   // Diseño — rosa
    4: ['#EA580C', '#C2410C'],   // Proyectos — naranja
    5: ['#0D9488', '#0F766E'],   // Contabilidad — verde azulado
    6: ['#CA8A04', '#A16207'],   // Recursos Humanos — ámbar
    7: ['#475569', '#334155'],   // Gerencia — gris
    8: ['#16A34A', '#15803D'],   // Educación — verde
};

const PIEL = '#E8B48C';

/**
 * Lo que flota sobre la cabeza: qué está haciendo o dónde anda. Una sola a
 * la vez, por orden de interés: un saludo, luego dónde está, luego qué hace.
 */
function Burbuja({ estado, actividad, saluda }) {
    let contenido = null;
    let clase = '';

    if (saluda) {
        clase = 'bu-saludo';
        contenido = <text className="po-bu-emoji" x="0" y="5" textAnchor="middle">👋</text>;
    } else if (estado === 'ausente' || estado === 'desconectado') {
        clase = 'bu-dormido';
        contenido = (
            <>
                <text className="po-zeta z1" x="-3" y="4">z</text>
                <text className="po-zeta z2" x="3" y="-2">z</text>
                <text className="po-zeta z3" x="8" y="-8">Z</text>
            </>
        );
        // Sin globo: las zetas flotan solas.
        return <g className={`po-burbuja ${clase}`} transform="translate(-20 -50)">{contenido}</g>;
    } else if (estado === 'reunion') {
        clase = 'bu-reunion';
        contenido = <text className="po-bu-emoji" x="0" y="5" textAnchor="middle">🗣️</text>;
    } else if (estado === 'almuerzo') {
        clase = 'bu-almuerzo';
        contenido = (
            <>
                <text className="po-bu-emoji" x="0" y="5" textAnchor="middle">☕</text>
                <path className="po-vapor v1" d="M -3 -7 q 2 -3 0 -6" />
                <path className="po-vapor v2" d="M 2 -7 q 2 -3 0 -6" />
            </>
        );
    } else if (actividad === 'escribiendo') {
        clase = 'bu-escribe';
        contenido = (
            <>
                <circle className="po-punto p1" cx="-6" cy="0" r="2.4" />
                <circle className="po-punto p2" cx="0" cy="0" r="2.4" />
                <circle className="po-punto p3" cx="6" cy="0" r="2.4" />
            </>
        );
    } else if (actividad === 'tarea') {
        clase = 'bu-tarea';
        contenido = <text className="po-bu-codigo" x="0" y="4" textAnchor="middle">{'</>'}</text>;
    } else if (estado === 'ocupado') {
        clase = 'bu-ocupado';
        contenido = <text className="po-bu-emoji" x="0" y="5" textAnchor="middle">🎧</text>;
    }

    if (!contenido) return null;

    return (
        <g className={`po-burbuja ${clase}`} transform="translate(-22 -52)">
            <g className="po-burbuja-flota">
                <rect className="po-globo" x="-13" y="-10" width="26" height="20" rx="10" />
                <path className="po-globo-cola" d="M 4 9 L 10 16 L 9 8 Z" />
                {contenido}
            </g>
        </g>
    );
}

/**
 * Una persona de cuerpo entero, vista desde arriba en perspectiva de juego:
 * se le ven los hombros, los brazos y los pies, y la cara es su foto real.
 *
 * Antes era una cabeza flotando sobre una silla; así parece un personaje y
 * el plano se lee como una oficina con gente dentro.
 */
function Puesto({ colocado, resaltarEquipo, seleccionado, esYo, onElegir }) {
    const { puesto, x, y } = colocado;
    const foto = useAvatar(puesto.id);
    const senal = SENALES[puesto.senal] || SENALES.libre;
    const c = puesto.conteos;
    const pr = puesto.presencia || null;
    const estado = pr?.estado || null;
    const actividad = pr?.actividad || null;

    // Al cambiar de sitio (va a una reunión, vuelve de almorzar) el
    // personaje camina: la transición del CSS lo desplaza y, mientras dura,
    // mueve las piernas. Sin esto aparecería de golpe en la otra sala.
    const [caminando, setCaminando] = useState(false);
    const antes = useRef({ x, y });
    useEffect(() => {
        const a = antes.current;
        antes.current = { x, y };
        if (Math.hypot(a.x - x, a.y - y) < 0.5) return undefined;
        setCaminando(true);
        const t = setTimeout(() => setCaminando(false), PASEO_MS);
        return () => clearTimeout(t);
    }, [x, y]);

    // Cada uno respira a su ritmo: con la misma fase, toda la oficina
    // subía y bajaba a la vez como un coro.
    const desfase = { animationDelay: `-${(puesto.id % 9) * 0.37}s` };

    const atenuado = resaltarEquipo && !puesto.mi_equipo && !esYo;
    const [camisa, sombra] = ROPA[puesto.departamento_id] || ['#64748B', '#475569'];

    const detalle = [
        c.bloqueadas && `${c.bloqueadas} bloqueada(s)`,
        c.pausadas && `${c.pausadas} en pausa`,
        c.atrasadas && `${c.atrasadas} atrasada(s)`,
        c.revision && `${c.revision} por verificar`,
    ].filter(Boolean).join(' · ');

    const idFoto = `po-f${puesto.id}`;
    const rotulo = puesto.etiqueta || primerNombre(puesto.nombre);
    // Las etiquetas largas («FABIAN QUINTERO») bajan de cuerpo: a 17px la
    // cinta invadía la del escritorio de al lado. ~0,62 del cuerpo por
    // carácter en negrita, más el margen de la cinta.
    const cuerpo = rotulo.length > 9 ? 13.5 : 17;
    const anchoCinta = Math.max(72, Math.round(rotulo.length * cuerpo * 0.62 + 16));

    return (
        <g
            className={`po-puesto se-${puesto.senal}`
                + (estado ? ` pr-${estado}` : '')
                + (actividad ? ` ac-${actividad}` : '')
                + (pr?.saluda ? ' es-saludando' : '')
                + (caminando ? ' es-caminando' : '')
                + (colocado.visita ? ' es-visita' : '')
                + (esYo ? ' es-yo' : '')
                + (puesto.mi_equipo ? ' es-mio' : '')
                + (atenuado ? ' es-atenuado' : '')
                + (seleccionado ? ' es-elegido' : '')}
            // Por estilo y no por atributo: así el CSS puede animar el
            // cambio de sitio (el atributo transform no tiene transición).
            style={{ transform: `translate(${U(x)}px, ${U(y)}px)` }}
            onClick={(e) => { e.stopPropagation(); onElegir(puesto); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onElegir(puesto); }
            }}
            aria-label={`${puesto.nombre}, ${estado ? `${PRESENCIA[estado]?.etiqueta}, ` : ''}${senal.etiqueta}`}
        >
            <title>{[
                `${puesto.nombre}${esYo ? ' (tú)' : ''}`,
                estado && `${PRESENCIA[estado]?.etiqueta}${pr?.nota ? `: «${pr.nota}»` : ''}`,
                actividad && `Ahora: ${ACTIVIDAD[actividad]}`,
                senal.etiqueta,
                detalle,
            ].filter(Boolean).join('\n')}</title>

            <g className="po-figura">
            {/* El cuerpo respira (sube y baja apenas) y es lo que se anima al
                caminar; la cinta del nombre queda fuera para leerse quieta. */}
            <g className="po-cuerpo" style={desfase}>

            {/* Halo: late sólo en quien trabaja o está bloqueado. */}
            <circle className="po-halo" cx="0" cy="-6" r="26" />

            {/* La sombra en el suelo asienta la figura; sin ella el personaje
                parece pegado como una calcomanía. */}
            <ellipse className="po-sombra-suelo" cx="0" cy="20" rx="17" ry="6" />

            {/* Piernas y pies */}
            <g className="po-pie po-pie-i">
                <rect className="po-pierna" x="-8" y="6" width="6.5" height="15" rx="3" />
                <ellipse className="po-zapato" cx="-4.8" cy="21" rx="4.6" ry="3" />
            </g>
            <g className="po-pie po-pie-d">
                <rect className="po-pierna" x="1.5" y="6" width="6.5" height="15" rx="3" />
                <ellipse className="po-zapato" cx="4.8" cy="21" rx="4.6" ry="3" />
            </g>

            {/* Torso con camiseta del color de su departamento */}
            <path
                className="po-camisa"
                d="M -13 -8 Q -13 -14 -7 -15 L 7 -15 Q 13 -14 13 -8 L 13 6 Q 13 9 10 9 L -10 9 Q -13 9 -13 6 Z"
                fill={camisa}
            />
            <path className="po-camisa-sombra" d="M -13 2 L 13 2 L 13 6 Q 13 9 10 9 L -10 9 Q -13 9 -13 6 Z" fill={sombra} />

            {/* Brazos a los lados */}
            {/* Cada brazo con su mano, para poder teclear o saludar. */}
            <g className="po-brazo-g po-brazo-i">
                <rect className="po-brazo" x="-18" y="-12" width="6" height="17" rx="3" fill={camisa} />
                <circle className="po-mano" cx="-15" cy="6" r="3.4" fill={PIEL} />
            </g>
            <g className="po-brazo-g po-brazo-d">
                <rect className="po-brazo" x="12" y="-12" width="6" height="17" rx="3" fill={camisa} />
                <circle className="po-mano" cx="15" cy="6" r="3.4" fill={PIEL} />
            </g>

            {/* Cuello y cabeza: la foto real recortada en círculo */}
            <rect className="po-cuello" x="-4" y="-18" width="8" height="6" rx="3" fill={PIEL} />
            <circle className="po-cabeza-borde" cx="0" cy="-27" r="15" />
            {foto ? (
                <>
                    <defs>
                        <clipPath id={idFoto}><circle cx="0" cy="-27" r="13" /></clipPath>
                    </defs>
                    <image
                        href={foto}
                        x="-13" y="-40" width="26" height="26"
                        clipPath={`url(#${idFoto})`}
                        preserveAspectRatio="xMidYMid slice"
                    />
                </>
            ) : (
                <>
                    <circle className="po-cabeza-lisa" cx="0" cy="-27" r="13" fill={PIEL} />
                    <text className="po-iniciales" x="0" y="-22" textAnchor="middle">
                        {iniciales(puesto.nombre)}
                    </text>
                </>
            )}

            {/* Punto de presencia junto a la barbilla, como en un chat. */}
            {estado && <circle className="po-presencia" cx="-12" cy="-16" r="5.5" />}

            </g>

            <Burbuja estado={estado} actividad={actividad} saluda={pr?.saluda} />

            {senal.icono && (
                <>
                    <circle className="po-chincheta" cx="14" cy="-36" r="10" />
                    <text className="po-chincheta-txt" x="14" y="-32.2" textAnchor="middle">{senal.icono}</text>
                </>
            )}

            {/* La etiqueta la decide el servidor: el primer nombre, o nombre y
                apellido cuando dos personas se llaman igual. La cinta se
                ensancha con ella para que «FABIAN QUINTERO» no se salga. */}
            <rect
                className="po-cinta"
                x={-anchoCinta / 2} y="26" width={anchoCinta} height="19" rx="6"
            />
            <text className="po-nombre" x="0" y="39.5" textAnchor="middle" style={{ fontSize: cuerpo }}>{rotulo}</text>

            </g>
        </g>
    );
}

// ─── Sala ───────────────────────────────────────────────────────────────────

function Sala({ sala }) {
    // La sala toma el color de la señal más grave que contenga, para que una
    // sala trabada se reconozca sin leer un solo nombre.
    const peor = useMemo(() => (sala.puestos || []).reduce((acc, c) => {
        const peso = (SENALES[c.puesto.senal] || SENALES.libre).peso;
        return peso > acc.peso ? { peso, senal: c.puesto.senal } : acc;
    }, { peso: 0, senal: 'libre' }), [sala.puestos]);

    const x = U(sala.x);
    const y = U(sala.y);
    const w = U(sala.ancho);
    const h = U(sala.alto);
    const r = sala.zona?.resumen;
    const gente = (sala.puestos || []).length;
    const bisagra = x + w / 2 - 22;

    return (
        <g className={`po-sala zs-${peor.senal}${sala.depto ? '' : ' es-servicio'}`}>
            <title>{sala.nombre}</title>

            {/* El muro va DEBAJO y sobresale: así se ve su grosor alrededor
                del suelo. Dibujarlo encima tapaba la sala entera. */}
            <rect className="po-muro" x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx="7" />

            {/* Suelo con veta: la textura da calidez y escala, como en un
                juego. El patrón se define una vez para toda la planta. */}
            <rect className="po-suelo" x={x} y={y} width={w} height={h} rx="3" />
            <rect
                className="po-veta"
                x={x} y={y} width={w} height={h} rx="3"
                fill={`url(#${sala.depto ? 'po-madera' : 'po-baldosa'})`}
            />

            {/* Luz de techo: las áreas de trabajo se ven encendidas y cálidas
                frente a los servicios. */}
            {sala.depto && (
                <rect className="po-luz-techo" x={x} y={y} width={w} height={h} rx="3" fill="url(#po-luz)" />
            )}

            {/* Filo interior claro: remata el muro por dentro. */}
            <rect className="po-muro-luz" x={x} y={y} width={w} height={h} rx="3" />

            {ventanasDe(sala).map((v, i) => <rect key={`v${i}`} className="po-ventana" rx="1.5" {...v} />)}

            {/* Puerta: hueco en el muro, con su marco y el barrido de la hoja
                hacia dentro, como en un plano de arquitecto. */}
            <rect className="po-puerta" x={bisagra} y={y + h - 4} width="44" height="8" rx="2" />
            <path className="po-puerta-barrido" d={`M ${bisagra + 40} ${y + h - 2} A 40 40 0 0 0 ${bisagra} ${y + h - 42}`} />
            <line className="po-puerta-hoja" x1={bisagra} y1={y + h - 2} x2={bisagra} y2={y + h - 42} />
            <rect className="po-puerta-marco" x={x + w / 2 - 24} y={y + h - 5} width="4" height="10" rx="1" />
            <rect className="po-puerta-marco" x={x + w / 2 + 20} y={y + h - 5} width="4" height="10" rx="1" />

            {(sala.muebles || []).map((m, i) => <Mueble key={i} m={m} />)}

            {(sala.portatiles || []).map((p, i) => <Portatil key={`p${i}`} p={p} />)}
            {(sala.sillasLibres || []).map((s, i) => <SillaLibre key={`s${i}`} s={s} />)}

            {sala.corto && (
                <>
                    <rect className="po-rotulo" x={x + 7} y={y + 7} width={Math.max(80, w - 14)} height="30" rx="7" />
                    <text className="po-rotulo-txt" x={x + 16} y={y + 28}>
                        {sala.corto}
                        {gente > 0 && <tspan className="po-rotulo-n" dx="8">{`· ${gente}`}</tspan>}
                    </text>
                    {r && (r.bloqueadas > 0 || r.atrasadas > 0) && (
                        <text className="po-rotulo-dato" x={x + w - 16} y={y + 28} textAnchor="end">
                            {r.bloqueadas > 0 ? `⛔ ${r.bloqueadas}` : `${r.atrasadas} tarde`}
                        </text>
                    )}
                </>
            )}
        </g>
    );
}

// ─── Plano ──────────────────────────────────────────────────────────────────

const ZOOM_MIN = 0.45;
const ZOOM_MAX = 3;

/**
 * Plano de la oficina, recreado del plano real de la empresa.
 *
 * Dos pisos con su distribución verdadera: se elige piso, se acerca con la
 * rueda o los botones y se arrastra para recorrerlo. Los avatares se dibujan
 * a tamaño fijo en el lienzo, así que al acercarse se ven con detalle en vez
 * de quedar diminutos como en una vista general.
 */
export default function PlanoOficina({ zonas, miEquipoTotal, yo, elegido, onElegir, soloMios, onSoloMios }) {
    const [piso, setPiso] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [desp, setDesp] = useState({ x: 0, y: 0 });
    const arrastre = useRef(null);
    // Dedos (o ratón) sobre el lienzo, por pointerId: con dos se pellizca.
    const punteros = useRef(new Map());
    const pellizco = useRef(null);
    const cajaRef = useRef(null);

    const datosPiso = PISOS[piso];

    const filtradas = useMemo(() => {
        if (!soloMios) return zonas;
        return zonas
            .map((z) => ({ ...z, puestos: z.puestos.filter((p) => p.mi_equipo) }))
            .filter((z) => z.puestos.length > 0);
    }, [zonas, soloMios]);

    const { salas, sinSala, franjas, ancho, alto, ocultas } = useMemo(
        () => repartirEnPlano(datosPiso, filtradas),
        [datosPiso, filtradas]
    );

    // Al cambiar de piso se vuelve a la vista general: conservar el encuadre
    // del piso anterior dejaría mirando a un rincón vacío.
    useEffect(() => {
        setZoom(1);
        setDesp({ x: 0, y: 0 });
    }, [piso]);

    const acercar = (paso, centro) => {
        setZoom((z) => {
            const nuevo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * paso));
            if (centro && cajaRef.current) {
                // Se acerca hacia donde está el puntero, no hacia la esquina:
                // de lo contrario el punto de interés se escapa de la vista.
                const caja = cajaRef.current.getBoundingClientRect();
                const cx = centro.x - caja.left - caja.width / 2;
                const cy = centro.y - caja.top - caja.height / 2;
                const k = nuevo / z;
                setDesp((d) => ({ x: cx - (cx - d.x) * k, y: cy - (cy - d.y) * k }));
            }
            return nuevo;
        });
    };

    const alRodar = (e) => {
        e.preventDefault();
        acercar(e.deltaY < 0 ? 1.15 : 1 / 1.15, { x: e.clientX, y: e.clientY });
    };

    // Eventos de puntero: valen igual para ratón, dedo y lápiz. Antes sólo
    // había eventos de ratón y en el móvil el plano no se podía mover.
    const empezarArrastre = (x, y) => {
        arrastre.current = { x, y, dx: desp.x, dy: desp.y };
    };

    const dosDedos = () => {
        const [a, b] = [...punteros.current.values()];
        return {
            distancia: Math.hypot(a.x - b.x, a.y - b.y),
            centro: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
    };

    const alBajar = (e) => {
        punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (punteros.current.size === 1) {
            empezarArrastre(e.clientX, e.clientY);
        } else if (punteros.current.size === 2) {
            arrastre.current = null;
            pellizco.current = dosDedos().distancia;
        }
    };

    const alMover = (e) => {
        if (!punteros.current.has(e.pointerId)) return;
        punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (punteros.current.size >= 2 && pellizco.current) {
            const { distancia, centro } = dosDedos();
            if (distancia > 0) acercar(distancia / pellizco.current, centro);
            pellizco.current = distancia;
            return;
        }
        if (!arrastre.current) return;
        const a = arrastre.current;
        setDesp({ x: a.dx + (e.clientX - a.x), y: a.dy + (e.clientY - a.y) });
    };

    const soltar = (e) => {
        punteros.current.delete(e.pointerId);
        if (punteros.current.size < 2) pellizco.current = null;
        // Al levantar uno de dos dedos se sigue arrastrando con el otro, sin salto.
        const resto = [...punteros.current.values()][0];
        if (resto) empezarArrastre(resto.x, resto.y);
        else arrastre.current = null;
    };

    const reencuadrar = () => { setZoom(1); setDesp({ x: 0, y: 0 }); };

    const hayEquipo = (miEquipoTotal || 0) > 0;
    const gentePiso = salas.reduce((a, s) => a + s.puestos.length, 0);

    // La gente se dibuja en una capa propia, encima de todas las salas y
    // siempre con la misma clave: así, al pasar de su área a la sala de
    // juntas, es el mismo personaje el que camina y no uno nuevo que aparece.
    // Se ordena por altura para que quien está más abajo tape al de arriba.
    const gente = useMemo(
        () => salas.flatMap((s) => s.puestos).sort((a, b) => a.y - b.y || a.x - b.x),
        [salas]
    );

    return (
        <div className="po-marco">
            <div className="po-barra">
                <div className="po-pisos">
                    {PISOS.map((p, i) => (
                        <button
                            key={p.id}
                            className={i === piso ? 'es-activo' : ''}
                            onClick={() => setPiso(i)}
                        >
                            {p.nombre}
                        </button>
                    ))}
                </div>

                <span className="po-cuenta">
                    {gentePiso} {gentePiso === 1 ? 'persona' : 'personas'}
                    {ocultas > 0 && (ocultas === 1
                        ? ' · 1 área sin personal oculta'
                        : ` · ${ocultas} áreas sin personal ocultas`)}
                </span>

                <div className="po-herramientas">
                    {hayEquipo && (
                        <button
                            className={`po-chip ${soloMios ? 'es-activo' : ''}`}
                            onClick={onSoloMios}
                        >
                            {soloMios ? 'Viendo mi equipo' : 'Sólo mi equipo'}
                        </button>
                    )}
                    <button className="po-chip" onClick={() => acercar(1 / 1.25)} title="Alejar">−</button>
                    <span className="po-zoom">{Math.round(zoom * 100)}%</span>
                    <button className="po-chip" onClick={() => acercar(1.25)} title="Acercar">+</button>
                    <button className="po-chip" onClick={reencuadrar} title="Ver el piso entero">⤢</button>
                </div>
            </div>

            <div
                className={`po-lienzo ${arrastre.current ? 'es-arrastrando' : ''}`}
                ref={cajaRef}
                onWheel={alRodar}
                onPointerDown={alBajar}
                onPointerMove={alMover}
                onPointerUp={soltar}
                onPointerCancel={soltar}
                onPointerLeave={soltar}
            >
                <svg
                    className="po-svg"
                    viewBox={`0 0 ${U(Math.max(ancho, 1))} ${U(Math.max(alto, 1))}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                        transform: `translate(${desp.x}px, ${desp.y}px) scale(${zoom})`,
                    }}
                    role="img"
                    aria-label={`Planta de la oficina, ${datosPiso.nombre}`}
                >
                    <defs>
                        {/* Madera para las áreas de trabajo y baldosa para los
                            servicios: distinguir el suelo ahorra leer rótulos. */}
                        <pattern id="po-madera" width="96" height="30" patternUnits="userSpaceOnUse">
                            <rect width="96" height="30" fill="#A06B3E" />
                            <rect width="96" height="14" fill="#B2794A" />
                            <rect x="48" y="15" width="48" height="14" fill="#8E5E36" />
                            <line x1="48" y1="0" x2="48" y2="14" stroke="#6E4729" strokeWidth="2.2" />
                            <line x1="0" y1="14.6" x2="96" y2="14.6" stroke="#6E4729" strokeWidth="2.2" />
                            <line x1="0" y1="29.4" x2="96" y2="29.4" stroke="#6E4729" strokeWidth="2.2" />
                        </pattern>
                        <pattern id="po-baldosa" width="26" height="26" patternUnits="userSpaceOnUse">
                            <rect width="26" height="26" fill="#C9CFD8" />
                            <rect width="26" height="26" fill="none" stroke="#B4BCC7" strokeWidth="1.4" />
                        </pattern>
                        <pattern id="po-cemento" width="40" height="40" patternUnits="userSpaceOnUse">
                            <rect width="40" height="40" fill="#8A8F98" />
                            <circle cx="9" cy="12" r="1.2" fill="#7B8089" />
                            <circle cx="29" cy="31" r="1" fill="#7B8089" />
                            <circle cx="33" cy="8" r="0.8" fill="#9A9FA8" />
                        </pattern>
                        <radialGradient id="po-luz" cx="50%" cy="45%" r="60%">
                            <stop offset="0%" stopColor="#FFE9B8" stopOpacity="0.26" />
                            <stop offset="100%" stopColor="#FFE9B8" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    {/* La clase no puede ser po-planta: ésa es la de las
                        macetas, y el césped entero se mecía con ellas. */}
                    <rect className="po-exterior" x="0" y="0" width={U(ancho)} height={U(alto)} />

                    {/* Pasillo: la huella del edificio bajo las salas. */}
                    {franjas.map((f) => (
                        <rect
                            key={f.y}
                            className="po-pasillo"
                            x={U(f.x - 0.55)} y={U(f.y - 0.55)}
                            width={U(f.ancho + 1.1)} height={U(f.alto + 1.1)}
                            rx="10"
                            fill="url(#po-cemento)"
                        />
                    ))}

                    {salas.map((s) => <Sala key={s.id} sala={s} />)}

                    <g className="po-gente">
                        {gente.map((c) => (
                            <Puesto
                                key={c.puesto.id}
                                colocado={c}
                                resaltarEquipo={hayEquipo && !soloMios}
                                seleccionado={elegido === c.puesto.id}
                                esYo={yo != null && c.puesto.id === yo}
                                onElegir={onElegir}
                            />
                        ))}
                    </g>
                </svg>

                {/* Sólo se dibujan áreas con personal: un piso sin nadie
                    quedaría en blanco sin explicación. */}
                {salas.length === 0 && (
                    <p className="po-vacio">
                        {soloMios ? 'Nadie de tu equipo en este piso.' : 'No hay personal en este piso.'}
                    </p>
                )}
            </div>

            {sinSala.length > 0 && (
                <p className="po-aviso">
                    Sin sitio en el plano:{' '}
                    {sinSala.map((s) => `${s.zona?.nombre || 'Sin departamento'} (${s.puestos.length})`).join(', ')}
                </p>
            )}

            <div className="po-leyenda">
                {['trabajando', 'atrasado', 'pausa', 'bloqueado', 'sin_criterio'].map((k) => (
                    <span key={k} className={`po-ley ley-${k}`}><i />{SENALES[k].etiqueta}</span>
                ))}
                {hayEquipo && <span className="po-ley ley-mio"><i />Tu equipo</span>}
                <span className="po-ley ley-silla"><i />Puesto libre</span>
            </div>

            <div className="po-leyenda po-leyenda-presencia">
                {['disponible', 'ocupado', 'reunion', 'almuerzo', 'ausente', 'desconectado'].map((k) => (
                    <span key={k} className={`po-ley pley-${k}`}><i />{PRESENCIA[k].etiqueta}</span>
                ))}
                <span className="po-ley pley-act">{'</>'} trabajando · ••• escribiendo · manos en el teclado: usando el equipo</span>
            </div>

            <p className="po-ayuda">
                Rueda o pellizco para acercar · arrastra para moverte · pulsa un puesto para ver a esa persona
                {yo != null && ' · pulsa tu personaje para cambiar tu estado'}
            </p>
        </div>
    );
}
