import React from 'react';
import { getImageUrl } from '../../utils/assetHelper';
import { useAvatar } from './AvataresContext';

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function fechaCorta(iso) {
    if (!iso) return '—';
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
}

const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function Persona({ p }) {
    const foto = useAvatar(p.id);
    return (
        <li className="tb-persona">
            {foto
                ? <img src={getImageUrl(foto)} alt="" className="tb-avatar" />
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

function Equipo({ equipo }) {
    return (
        <section className="tb-panel" aria-label="Equipo">
            <h3 className="tb-panel-titulo">EQUIPO</h3>
            <ul className="tb-equipo">
                {equipo.map((p) => <Persona key={p.id} p={p} />)}
                {equipo.length === 0 && <li className="tb-col-vacia">Sin integrantes</li>}
            </ul>
        </section>
    );
}

function Alertas({ alertas }) {
    const filas = [
        { n: alertas.vencidas, texto: 'tareas vencidas', clase: 'al-roja' },
        { n: alertas.vencen_hoy, texto: 'vencen hoy', clase: 'al-naranja' },
        { n: alertas.proximas, texto: 'vencen esta semana', clase: 'al-amarilla' },
        { n: alertas.pausadas, texto: 'tareas en pausa', clase: 'al-azul' },
    ].filter((f) => f.n > 0);

    return (
        <section className="tb-panel" aria-label="Alertas">
            <h3 className="tb-panel-titulo">ALERTAS</h3>
            {filas.length === 0
                ? <p className="tb-sin-alertas">✓ Sin alertas</p>
                : (
                    <ul className="tb-alertas">
                        {filas.map((f) => (
                            <li key={f.texto} className={`tb-alerta ${f.clase}`}>
                                <strong>{f.n}</strong> {f.texto}
                            </li>
                        ))}
                    </ul>
                )}
        </section>
    );
}

function Entregas({ entregas }) {
    return (
        <section className="tb-panel" aria-label="Próximas entregas">
            <h3 className="tb-panel-titulo">PRÓXIMAS ENTREGAS</h3>
            <ul className="tb-entregas">
                {entregas.map((e) => (
                    <li key={e.id} className="tb-entrega">
                        <span className={`tb-entrega-fecha ${e.dias_restantes < 0 ? 'es-vencida' : ''}`}>
                            {fechaCorta(e.fecha_pactada)}
                        </span>
                        <span className="tb-entrega-info">
                            <span className="tb-entrega-titulo" title={e.titulo}>{e.titulo}</span>
                            <span className="tb-entrega-persona">{e.empleado}</span>
                        </span>
                    </li>
                ))}
                {entregas.length === 0 && <li className="tb-col-vacia">Sin entregas programadas</li>}
            </ul>
        </section>
    );
}

export default function TableroLateral({ datos }) {
    return (
        <aside className="tb-lateral">
            <Alertas alertas={datos.alertas} />
            <Equipo equipo={datos.equipo} />
            <Entregas entregas={datos.entregas} />
        </aside>
    );
}
