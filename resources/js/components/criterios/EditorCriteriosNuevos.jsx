import React from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import './criterios.css';

/** Criterio vacío para una fila nueva. */
export const criterioVacio = () => ({ descripcion: '', obligatorio: true, requiere_evidencia: false });

/** Los criterios que se enviarán: sólo los que tienen texto. */
export const criteriosParaEnviar = (lista) => (lista || [])
    .map((c) => ({ ...c, descripcion: String(c.descripcion || '').trim() }))
    .filter((c) => c.descripcion !== '');

/**
 * Mensaje de error si la lista no sirve para crear la tarea, o null.
 * Repite la regla del servidor para avisar antes de enviar el formulario.
 */
export const validarCriterios = (lista) => {
    const validos = criteriosParaEnviar(lista);
    if (validos.length === 0) {
        return 'Define al menos un criterio de aceptación: cómo sabremos que el resultado está bien.';
    }
    if (validos.some((c) => c.descripcion.length < 5)) {
        return 'Cada criterio debe explicarse en al menos 5 caracteres.';
    }
    return null;
};

/**
 * Lista de criterios de aceptación al crear una tarea.
 *
 * Sustituye al antiguo campo de texto único «¿Cómo sabremos que se
 * cumplió?»: ahora son condiciones separadas que se verifican una a una.
 * Se usa en los tres formularios que crean tareas.
 */
export default function EditorCriteriosNuevos({ valor, onCambio }) {
    const lista = valor && valor.length ? valor : [criterioVacio()];

    const cambiar = (i, campo, v) => onCambio(lista.map((c, k) => (k === i ? { ...c, [campo]: v } : c)));
    const quitar = (i) => onCambio(lista.length > 1 ? lista.filter((_, k) => k !== i) : [criterioVacio()]);
    const agregar = () => onCambio([...lista, criterioVacio()]);

    return (
        <div className="ecn">
            <label className="ecn-titulo">Criterios de aceptación</label>
            <p className="ecn-ayuda">
                Condiciones que debe cumplir el resultado para darlo por bueno. Son distintas del checklist,
                que lista los pasos para hacerlo.
            </p>

            {lista.map((c, i) => (
                <div className="ecn-fila" key={i}>
                    <span className="ecn-num">{i + 1}</span>
                    <div className="ecn-campos">
                        <input
                            type="text"
                            value={c.descripcion}
                            onChange={(e) => cambiar(i, 'descripcion', e.target.value)}
                            placeholder={i === 0 ? 'Ej.: El formulario valida los campos obligatorios' : 'Otra condición verificable'}
                            maxLength={1000}
                        />
                        <div className="ecn-opciones">
                            <label>
                                <input type="checkbox" checked={!!c.obligatorio} onChange={(e) => cambiar(i, 'obligatorio', e.target.checked)} />
                                Obligatorio
                            </label>
                            <label>
                                <input type="checkbox" checked={!!c.requiere_evidencia} onChange={(e) => cambiar(i, 'requiere_evidencia', e.target.checked)} />
                                Requiere evidencia
                            </label>
                        </div>
                    </div>
                    <button type="button" className="ecn-quitar" onClick={() => quitar(i)} title="Quitar criterio">
                        <FaTimes />
                    </button>
                </div>
            ))}

            <button type="button" className="ecn-agregar" onClick={agregar}>
                <FaPlus /> Añadir criterio
            </button>
        </div>
    );
}
