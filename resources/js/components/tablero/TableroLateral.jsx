import React, { useEffect, useState } from 'react';
import { useAvatar } from './AvataresContext';
import TableroAmbiente from './TableroAmbiente';

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const CLAVE_PLEGADOS = 'tableroPanelesPlegados';

function fechaCorta(iso) {
    if (!iso) return '—';
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
}

const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/**
 * Panel plegable del lateral.
 *
 * El estado se recuerda en la pantalla: en modo TV el lateral no scrollea, así
 * que poder cerrar alertas o equipo es lo que deja sitio al vídeo. Plegado
 * muestra un resumen para no perder el dato de un vistazo.
 */
function Panel({ id, titulo, resumen, plegado, onAlternar, children }) {
    return (
        <section className={`tb-panel ${plegado ? 'es-plegado' : ''}`} aria-label={titulo}>
            <button
                className="tb-panel-cab"
                onClick={() => onAlternar(id)}
                aria-expanded={!plegado}
                title={plegado ? 'Desplegar' : 'Plegar'}
            >
                <span className="tb-panel-titulo">{titulo}</span>
                {plegado && resumen != null && <span className="tb-panel-resumen">{resumen}</span>}
                <span className="tb-panel-chevron">{plegado ? '▸' : '▾'}</span>
            </button>
            {!plegado && <div className="tb-panel-cuerpo">{children}</div>}
        </section>
    );
}

function Persona({ p }) {
    const fotoOriginal = useAvatar(p.id);
    const [fotoFallida, setFotoFallida] = useState(false);
    const foto = fotoFallida ? null : fotoOriginal;
    return (
        <li className="tb-persona">
            {foto
                ? <img src={foto} alt="" className="tb-avatar" onError={() => setFotoFallida(true)} />
                : <span className="tb-avatar tb-avatar-vacio" aria-hidden="true">{iniciales(p.nombre)}</span>}
            <div className="tb-persona-info">
                <span className="tb-persona-nombre">{p.nombre}</span>
                <span className="tb-persona-cargo">{p.cargo || '—'}</span>
                <div className="tb-carga" role="img" aria-label={`${p.activas} tareas activas`}>
                    <div className="tb-carga-fill" style={{ width: `${p.carga_pct}%` }} />
                </div>
            </div>
            <span className="tb-persona-n">{p.activas}</span>
        </li>
    );
}

export default function TableroLateral({ datos, interactivo, onVerAlerta, onVerTarea }) {
    const [plegados, setPlegados] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(CLAVE_PLEGADOS)) || {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(CLAVE_PLEGADOS, JSON.stringify(plegados));
        } catch {
            /* sin persistencia si el navegador la bloquea */
        }
    }, [plegados]);

    const alternar = (id) => setPlegados((p) => ({ ...p, [id]: !p[id] }));

    // Las entregas llevan sólo lo justo para el listado; la tarea completa ya
    // viaja en las columnas, así que se resuelve aquí en lugar de engordar el
    // sondeo repitiendo los mismos campos.
    const tareaCompleta = (id) => [
        ...(datos.columnas.pendiente || []),
        ...(datos.columnas.proceso || []),
        ...(datos.columnas.pausa || []),
        ...(datos.columnas.completadas?.items || []),
    ].find((t) => t.id === id) || null;

    const filasAlerta = [
        { id: 'vencidas', n: datos.alertas.vencidas, texto: 'tareas vencidas', clase: 'al-roja' },
        { id: 'hoy', n: datos.alertas.vencen_hoy, texto: 'vencen hoy', clase: 'al-naranja' },
        { id: 'semana', n: datos.alertas.proximas, texto: 'vencen esta semana', clase: 'al-amarilla' },
        { id: 'pausa', n: datos.alertas.pausadas, texto: 'tareas en pausa', clase: 'al-azul' },
    ].filter((f) => f.n > 0);

    return (
        <aside className="tb-lateral">
            <Panel
                id="alertas"
                titulo="ALERTAS"
                resumen={filasAlerta.length || '✓'}
                plegado={plegados.alertas}
                onAlternar={alternar}
            >
                {filasAlerta.length === 0
                    ? <p className="tb-sin-alertas">✓ Sin alertas</p>
                    : (
                        <ul className="tb-alertas">
                            {filasAlerta.map((f) => (
                                <li key={f.id} className={`tb-alerta ${f.clase}`}>
                                    {/* En modo interactivo la alerta abre la lista de
                                        tareas que la provocan; fuera de él es sólo
                                        informativa. */}
                                    {interactivo ? (
                                        <button
                                            className="tb-alerta-btn"
                                            onClick={() => onVerAlerta(f)}
                                            title={`Ver las ${f.texto}`}
                                        >
                                            <strong>{f.n}</strong> {f.texto}
                                            <span className="tb-alerta-mas">›</span>
                                        </button>
                                    ) : (
                                        <><strong>{f.n}</strong> {f.texto}</>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
            </Panel>

            <Panel
                id="equipo"
                titulo="EQUIPO"
                resumen={datos.equipo.length}
                plegado={plegados.equipo}
                onAlternar={alternar}
            >
                <ul className="tb-equipo">
                    {datos.equipo.map((p) => <Persona key={p.id} p={p} />)}
                    {datos.equipo.length === 0 && <li className="tb-col-vacia">Sin integrantes</li>}
                </ul>
            </Panel>

            <Panel
                id="entregas"
                titulo={datos.entregas_modo === 'vencidas'
                    ? 'ENTREGAS PENDIENTES'
                    : 'PRÓXIMAS ENTREGAS'}
                resumen={datos.entregas.length}
                plegado={plegados.entregas}
                onAlternar={alternar}
            >
                {datos.entregas_modo === 'vencidas' && datos.entregas.length > 0 && (
                    <p className="tb-col-nota tb-nota-entregas">
                        Sin entregas en plazo · las más recientes vencidas
                    </p>
                )}
                <ul className="tb-entregas">
                    {datos.entregas.map((e) => {
                        const contenido = (
                            <>
                                <span className={`tb-entrega-fecha ${e.dias_restantes < 0 ? 'es-vencida' : ''}`}>
                                    {fechaCorta(e.fecha_pactada)}
                                </span>
                                <span className="tb-entrega-info">
                                    <span className="tb-entrega-titulo" title={e.titulo}>{e.titulo}</span>
                                    <span className="tb-entrega-persona">{e.empleado}</span>
                                </span>
                            </>
                        );

                        return (
                            <li key={e.id} className="tb-entrega">
                                {interactivo ? (
                                    <button
                                        className="tb-entrega-btn"
                                        onClick={() => {
                                            const t = tareaCompleta(e.id);
                                            if (t) onVerTarea(t);
                                        }}
                                        title={`Ver ${e.titulo}`}
                                    >
                                        {contenido}
                                        <span className="tb-alerta-mas">›</span>
                                    </button>
                                ) : contenido}
                            </li>
                        );
                    })}
                    {datos.entregas.length === 0 && <li className="tb-col-vacia">Sin entregas programadas</li>}
                </ul>
            </Panel>

            {/* El vídeo ocupa el hueco libre bajo las entregas, dentro del
                lateral: así no se superpone al kanban ni le resta espacio. */}
            <TableroAmbiente
                plegado={plegados.ambiente}
                onAlternar={() => alternar('ambiente')}
            />
        </aside>
    );
}
