import React, { useState, useMemo } from "react";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
    FaArrowLeft,
    FaChartArea,
    FaChartBar,
    FaChartLine,
    FaTimes,
    FaPrint,
    FaFilePdf,
} from "react-icons/fa";
import axiosInstance from "../axiosConfig";
import RangosFecha from "./rangosFecha";
import {
    BarChart, Bar, Cell, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend,
    LineChart, Line, ResponsiveContainer,
} from "recharts";
import * as XLSX from 'xlsx';

const ReportesDepartamentoModal = ({ user, onClose }) => {
    const empleadosNames = useMemo(
        () => (user.empleados_asignados || []).map(e => e.nombre),
        [user.empleados_asignados]
    );

    const [selectedReport, setSelectedReport] = useState(null);
    const [activeTab, setActiveTab] = useState("tareasCompletadas");

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d) => d.toISOString().split("T")[0];

    const [startDate, setStartDate] = useState(fmt(firstDay));
    const [endDate, setEndDate] = useState(fmt(lastDay));
    const [tareas, setTareas] = useState([]);
    const [filterEmpleado, setFilterEmpleado] = useState('');
    const [filterDepartamento, setFilterDepartamento] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [filterFechaInicio, setFilterFechaInicio] = useState('');
    const [filterFechaFin, setFilterFechaFin] = useState('');
    const [filterAtrasadas, setFilterAtrasadas] = useState(false);
    const [empleadosList, setEmpleadosList] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [estados, setEstados] = useState([]);
    const [datosEficiencia, setDatosEficiencia] = useState([]);
    const [loadingEficiencia, setLoadingEficiencia] = useState(false);
    const [eficienciaStart, setEficienciaStart] = useState('');
    const [eficienciaEnd, setEficienciaEnd] = useState('');
    const [eficienciaFilterArea, setEficienciaFilterArea] = useState('');
    const [eficienciaFilterEmpleado, setEficienciaFilterEmpleado] = useState('');
    const [datosProyectos, setDatosProyectos] = useState([]);
    const [loadingProyectos, setLoadingProyectos] = useState(false);
    const [proyectoFiltro, setProyectoFiltro] = useState('');
    const [proyectoEstadoFiltro, setProyectoEstadoFiltro] = useState('');
    const [proyectoDepartamentoFiltro, setProyectoDepartamentoFiltro] = useState('');
    const [proyectoStartDate, setProyectoStartDate] = useState('');
    const [proyectoEndDate, setProyectoEndDate] = useState('');
    const [pdfLoading, setPdfLoading] = useState(false);
    const [rGStart, setRGStart] = useState(fmt(firstDay));
    const [rGEnd, setRGEnd] = useState(fmt(lastDay));

    const cambiarFormatoFecha = (fecha) => {
        if (!fecha) return 'N/A';
        const d = new Date(fecha + 'T12:00:00');
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };


    const consultarTareas = () => {
        axiosInstance.get("/informes/tareas").then(res => {
            const todas = res.data;
            const filtradas = todas.filter(t => empleadosNames.includes(t.empleado));
            setTareas(filtradas);
            setEmpleadosList([...new Set(filtradas.map(t => t.empleado))]);
            setDepartamentos([...new Set(filtradas.map(t => t.departamento).filter(Boolean))]);
            setEstados([...new Set(filtradas.map(t => t.estado))]);
        }).catch(err => console.error("Error fetching tasks:", err));
    };

    const consultarEficiencia = () => {
        setLoadingEficiencia(true);
        axiosInstance.get('/informes/eficiencia')
            .then(res => setDatosEficiencia(res.data.filter(t => empleadosNames.includes(t.nombre_empleado))))
            .catch(err => console.error('Error cargando eficiencia:', err))
            .finally(() => setLoadingEficiencia(false));
    };

    const consultarProyectos = () => {
        setLoadingProyectos(true);
        axiosInstance.get('/informes/proyectos')
            .then(res => {
                const proyectos = res.data
                    .map(p => ({ ...p, tareas: (p.tareas || []).filter(t => empleadosNames.includes(t.empleado)) }))
                    .filter(p => p.tareas.length > 0);
                setDatosProyectos(proyectos);
            })
            .catch(err => console.error('Error cargando proyectos:', err))
            .finally(() => setLoadingProyectos(false));
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    const isPausada = (t) => t.pausada === 1 || t.pausada === '1' || t.pausada === true;

    // ── Computed data (same logic as Reportes.jsx) ───────────────────────────

    const tareasCompletadasData = tareas.reduce((acc, t) => {
        if (t.estado === "Completada"
            && t.fecha_entregada >= startDate && t.fecha_entregada <= endDate
            && (!filterDepartamento || t.departamento === filterDepartamento)
            && (!filterEmpleado || t.empleado === filterEmpleado)) {
            acc[t.empleado] = (acc[t.empleado] || 0) + 1;
        }
        return acc;
    }, {});
    const tareasCompletadasArray = Object.entries(tareasCompletadasData).map(([empleado, tareasCompletadas]) => ({ empleado, tareasCompletadas }));

    const promedioTiempoData = tareas.reduce((acc, t) => {
        if (t.estado === "Completada" && t.fecha_pactada && t.fecha_pactada >= startDate && t.fecha_pactada <= endDate
            && t.fecha_entregada
            && (!filterDepartamento || t.departamento === filterDepartamento)
            && (!filterEmpleado || t.empleado === filterEmpleado)) {
            const dias = (new Date(t.fecha_entregada) - new Date(t.fecha_aprobacion)) / (1000 * 60 * 60 * 24);
            if (!acc[t.empleado]) acc[t.empleado] = { totalDias: 0, tareas: 0 };
            acc[t.empleado].totalDias += dias;
            acc[t.empleado].tareas += 1;
        }
        return acc;
    }, {});
    const promedioTiempoArray = Object.entries(promedioTiempoData).map(([empleado, d]) => ({ empleado, promedioTiempo: (d.totalDias / d.tareas).toFixed(1) }));
    const comparativoArray = tareasCompletadasArray.map(item => {
        const promedio = promedioTiempoArray.find(p => p.empleado === item.empleado);
        return { empleado: item.empleado, tareasCompletadas: item.tareasCompletadas, promedioTiempo: promedio ? promedio.promedioTiempo : 0, productividad: promedio ? parseFloat((item.tareasCompletadas / promedio.promedioTiempo).toFixed(1)) : 0 };
    });

    const calcularDias = (inicio, fin) => Math.ceil((new Date(fin) - new Date(inicio)) / (1000 * 60 * 60 * 24));
    const informe = tareas.filter(t =>
        t.fecha_pactada >= startDate && t.fecha_pactada <= endDate
        && (!filterDepartamento || t.departamento === filterDepartamento)
        && (!filterEmpleado || t.empleado === filterEmpleado)
    ).map(t => {
        const diasEstimados = calcularDias(t.fecha_aprobacion, t.fecha_pactada);
        const diasReales = t.fecha_entregada ? calcularDias(t.fecha_aprobacion, t.fecha_entregada) : null;
        return { ...t, diasEstimados, diasReales, horasEstimadas: diasEstimados * 8, horasReales: diasReales ? diasReales * 8 : null, retrasada: !isPausada(t) && t.fecha_entregada && t.fecha_entregada > t.fecha_pactada };
    });

    const empleadosAvance = [...new Set(tareas.filter(t => (!filterDepartamento || t.departamento === filterDepartamento) && (!filterEmpleado || t.empleado === filterEmpleado)).map(t => t.empleado))];
    const resumenAvance = empleadosAvance.map(empleado => {
        const te = tareas.filter(t => t.empleado === empleado && t.fecha_pactada >= startDate && t.fecha_pactada <= endDate && (!filterDepartamento || t.departamento === filterDepartamento));
        const total = te.length;
        const completadas = te.filter(t => t.estado === "Completada").length;
        return { empleado, total, completadas, porcentaje: total > 0 ? ((completadas / total) * 100).toFixed(1) : 0 };
    });

    const _cumplFiltro = t => t.fecha_pactada >= startDate && t.fecha_pactada <= endDate && (!filterDepartamento || t.departamento === filterDepartamento) && (!filterEmpleado || t.empleado === filterEmpleado);
    const noIniciadas = tareas.filter(t => t.estado === "Pendiente" && !isPausada(t) && _cumplFiltro(t)).length;
    const completadasCumpl = tareas.filter(t => t.estado === "Completada" && _cumplFiltro(t)).length;
    const titulos = tareas.filter(t => _cumplFiltro(t) && !isPausada(t)).map(t => t.titulo);
    const titulosRecurrentes = titulos.filter((titulo, i, arr) => arr.indexOf(titulo) !== i);
    const recurrentesNoCumplidas = tareas.filter(t => titulosRecurrentes.includes(t.titulo) && t.estado !== "Completada" && !isPausada(t) && _cumplFiltro(t));
    const incumplidas = tareas.filter(t => { if (!t.fecha_entregada || !_cumplFiltro(t) || isPausada(t)) return false; return new Date(t.fecha_entregada) > new Date(t.fecha_pactada); });

    const calcularInformeEjecutivo = () => {
        const hoy = new Date().toISOString().split('T')[0];
        const filtradas = tareas.filter(t => t.fecha_pactada >= startDate && t.fecha_pactada <= endDate && (!filterDepartamento || t.departamento === filterDepartamento) && (!filterEmpleado || t.empleado === filterEmpleado));
        const totalCompletadas = filtradas.filter(t => t.estado === 'Completada').length;
        const totalEnProceso = filtradas.filter(t => t.estado === 'En Proceso' && !isPausada(t)).length;
        const totalPendientes = filtradas.filter(t => t.estado === 'Pendiente' && !isPausada(t)).length;
        const totalPausadas = filtradas.filter(t => isPausada(t)).length;
        const totalAtrasadas = filtradas.filter(t => t.fecha_pactada && t.fecha_pactada < hoy && t.estado !== 'Completada' && !isPausada(t)).length;
        const porDept = filtradas.filter(t => !isPausada(t)).reduce((acc, t) => {
            if (!t.departamento) return acc;
            if (!acc[t.departamento]) acc[t.departamento] = { departamento: t.departamento, completadas: 0, total: 0 };
            acc[t.departamento].total += 1;
            if (t.estado === 'Completada') acc[t.departamento].completadas += 1;
            return acc;
        }, {});
        const deptData = Object.values(porDept).map(d => ({ ...d, porcentaje: d.total > 0 ? Math.round((d.completadas / d.total) * 100) : 0 }));
        const porEmpleado = filtradas.reduce((acc, t) => {
            if (!t.empleado) return acc;
            if (!acc[t.empleado]) acc[t.empleado] = { empleado: t.empleado, completadasATiempo: 0, totalCompletadas: 0 };
            if (t.estado === 'Completada') { acc[t.empleado].totalCompletadas += 1; if (t.fecha_entregada && t.fecha_pactada && t.fecha_entregada <= t.fecha_pactada) acc[t.empleado].completadasATiempo += 1; }
            return acc;
        }, {});
        const eficienciaData = Object.values(porEmpleado).map(e => ({ empleado: e.empleado, eficiencia: e.totalCompletadas > 0 ? Math.round((e.completadasATiempo / e.totalCompletadas) * 100) : 0 })).sort((a, b) => b.eficiencia - a.eficiencia);
        return { totalCompletadas, totalEnProceso, totalPendientes, totalPausadas, totalAtrasadas, deptData, eficienciaData };
    };

    const calcularEficienciaOperativa = () => {
        const filtradas = datosEficiencia.filter(t =>
            (!eficienciaStart || t.fecha_pactada >= eficienciaStart)
            && (!eficienciaEnd || t.fecha_pactada <= eficienciaEnd)
            && (!eficienciaFilterArea || t.departamento === eficienciaFilterArea)
            && (!eficienciaFilterEmpleado || t.nombre_empleado === eficienciaFilterEmpleado)
        );
        const porEmpleado = filtradas.reduce((acc, t) => {
            const key = t.nombre_empleado;
            if (!acc[key]) acc[key] = { nombre: t.nombre_empleado, cargo: t.cargo, departamento: t.departamento, total: 0, completadas: 0, aTiempo: 0, reprocesos: 0, pausadas: 0 };
            // Las pausadas no se cuentan en el total activo para el score
            if (isPausada(t)) { acc[key].pausadas++; return acc; }
            acc[key].total++;
            if (t.estado === 'Completada') acc[key].completadas++;
            if (t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada) acc[key].aTiempo++;
            if (t.rechazada == 1) acc[key].reprocesos++;
            return acc;
        }, {});
        return Object.values(porEmpleado).map(emp => {
            const score = emp.total > 0 ? (emp.completadas / emp.total) * 0.4 + (emp.aTiempo / emp.total) * 0.3 + ((emp.total - emp.reprocesos) / emp.total) * 0.3 : 0;
            const scoreRound = Math.round(score * 100) / 100;
            return { ...emp, score: scoreRound, nivel: scoreRound >= 0.75 ? '🟢 Alto' : scoreRound >= 0.50 ? '🟡 Medio' : '🔴 Crítico' };
        }).sort((a, b) => b.score - a.score);
    };

    const calcularDeptEficiencia = (empleados) => {
        const porDept = empleados.reduce((acc, emp) => {
            const d = emp.departamento || 'Sin área';
            if (!acc[d]) acc[d] = { departamento: d, count: 0, sumaScore: 0, empleadosList: [] };
            acc[d].count++; acc[d].sumaScore += emp.score; acc[d].empleadosList.push(emp);
            return acc;
        }, {});
        return Object.values(porDept).map(d => {
            const avg = Math.round((d.sumaScore / d.count) * 100) / 100;
            return { ...d, scorePromedio: avg, nivel: avg >= 0.75 ? '🟢 Alto' : avg >= 0.50 ? '🟡 Medio' : '🔴 Crítico' };
        }).sort((a, b) => b.scorePromedio - a.scorePromedio);
    };

    const calcularProyecto = (proyecto, filtros = {}) => {
        const { startDate: fStart, endDate: fEnd, departamento: fDept } = filtros;
        const hoy = new Date().toISOString().split('T')[0];
        let trs = proyecto.tareas || [];
        if (fDept) trs = trs.filter(t => t.departamento === fDept);
        if (fStart || fEnd) trs = trs.filter(t => (!fStart || t.fecha_pactada >= fStart) && (!fEnd || t.fecha_pactada <= fEnd));
        const total = trs.length;
        const pausadas = trs.filter(t => isPausada(t)).length;
        const completadas = trs.filter(t => t.estado === 'Completada').length;
        const enProceso = trs.filter(t => t.estado === 'En Proceso' && !isPausada(t)).length;
        const pendientes = trs.filter(t => t.estado === 'Pendiente' && !isPausada(t)).length;
        const atrasadas = trs.filter(t => t.fecha_pactada < hoy && t.estado !== 'Completada' && !isPausada(t)).length;
        const aTiempo = trs.filter(t => t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada).length;
        const avance = total > 0 ? Math.round((completadas / total) * 100) : 0;
        return { total, completadas, enProceso, pendientes, pausadas, atrasadas, aTiempo, avance, empleados: [...new Set(trs.map(t => t.empleado).filter(Boolean))], areas: [...new Set(trs.map(t => t.departamento).filter(Boolean))] };
    };

    const generarTareasPorEmpleado = () => {
        let tfs = tareas;
        if (filterEmpleado) tfs = tfs.filter(t => t.empleado === filterEmpleado);
        if (filterDepartamento) tfs = tfs.filter(t => t.departamento === filterDepartamento);
        if (filterEstado) tfs = tfs.filter(t => t.estado === filterEstado);
        if (filterAtrasadas) { const hoy = new Date().toISOString().split('T')[0]; tfs = tfs.filter(t => t.fecha_pactada && t.fecha_pactada < hoy && t.estado !== 'Completada'); }
        if (filterFechaInicio) tfs = tfs.filter(t => t.fecha_pactada && t.fecha_pactada >= filterFechaInicio);
        if (filterFechaFin) tfs = tfs.filter(t => t.fecha_pactada && t.fecha_pactada <= filterFechaFin);
        const map = {};
        tfs.forEach(t => { if (!map[t.empleado]) map[t.empleado] = { empleado: t.empleado, tareas: [] }; map[t.empleado].tareas.push(t); });
        return Object.values(map);
    };

    const generarResumenTareasPorEmpleado = () => generarTareasPorEmpleado().map(({ empleado, tareas: ts }) => ({
        empleado, total: ts.length,
        completadas: ts.filter(t => t.estado === 'Completada').length,
        pendientes: ts.filter(t => t.estado === 'Pendiente' && !isPausada(t)).length,
        enProceso: ts.filter(t => t.estado === 'En Proceso' && !isPausada(t)).length,
        pausadas: ts.filter(t => isPausada(t)).length,
        atrasadas: ts.filter(t => t.estado === 'Atrasada').length,
    }));

    const generarPDF = async (titulo) => {
        const element = document.querySelector('.rdm-report-content');
        if (!element) return;
        setPdfLoading(true);
        const saved = [];
        [element, ...element.querySelectorAll('*')].forEach(el => {
            const cs = window.getComputedStyle(el);
            const hasScroll = ['auto','scroll'].includes(cs.overflowY) || ['auto','scroll'].includes(cs.overflowX) || ['auto','scroll'].includes(cs.overflow);
            const hasMaxH = cs.maxHeight && cs.maxHeight !== 'none';
            if (hasScroll || hasMaxH) { saved.push({ el, overflow: el.style.overflow, overflowX: el.style.overflowX, overflowY: el.style.overflowY, maxHeight: el.style.maxHeight, height: el.style.height }); el.style.overflow = 'visible'; el.style.overflowX = 'visible'; el.style.overflowY = 'visible'; el.style.maxHeight = 'none'; el.style.height = 'auto'; }
        });
        await new Promise(r => setTimeout(r, 200));
        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff', scrollX: 0, scrollY: -window.scrollY, width: element.scrollWidth, height: element.scrollHeight });
            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
            const scale = pw / canvas.width, scaledH = canvas.height * scale;
            let posY = 0;
            while (posY < scaledH) { if (posY > 0) pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, -posY, pw, scaledH); posY += ph; }
            pdf.save(`${titulo.replace(/\s+/g,'-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) { console.error('Error generando PDF:', e); }
        finally { saved.forEach(({ el, overflow, overflowX, overflowY, maxHeight, height }) => { el.style.overflow = overflow; el.style.overflowX = overflowX; el.style.overflowY = overflowY; el.style.maxHeight = maxHeight; el.style.height = height; }); setPdfLoading(false); }
    };

    const exportarExcel = () => {
        const wb = XLSX.utils.book_new();
        const resumenData = generarResumenTareasPorEmpleado().map(i => ({ 'Empleado': i.empleado, 'Total': i.total, 'Completadas': i.completadas, 'En Proceso': i.enProceso, 'Pendientes': i.pendientes, 'Pausadas': i.pausadas, 'Atrasadas': i.atrasadas }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), 'Resumen');
        const detalle = [];
        generarTareasPorEmpleado().forEach(ed => ed.tareas.forEach(t => detalle.push({ 'Empleado': ed.empleado, 'Departamento': t.departamento || 'N/A', 'Título': t.titulo, 'Estado': t.estado, 'Prioridad': t.prioridad || 'N/A', 'Fecha Pactada': cambiarFormatoFecha(t.fecha_pactada), 'Fecha Entregada': cambiarFormatoFecha(t.fecha_entregada) })));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Detalle');
        XLSX.writeFile(wb, `Tareas_Depto_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportarEficienciaExcel = (empleados, deptos) => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empleados.map((e, i) => ({ '#': i+1, 'Nombre': e.nombre, 'Cargo': e.cargo, 'Área': e.departamento, 'Nivel': e.nivel, 'Score': e.score, 'Total activo': e.total, 'Completadas': e.completadas, 'A tiempo': e.aTiempo, 'Reprocesos': e.reprocesos, 'Pausadas': e.pausadas || 0 }))), 'Por Empleado');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptos.map(d => ({ 'Área': d.departamento, 'Empleados': d.count, 'Score Promedio': d.scorePromedio, 'Nivel': d.nivel }))), 'Por Área');
        XLSX.writeFile(wb, `eficiencia-depto-${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportarProyectosExcel = (proyectos, filtros = {}) => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(proyectos.map(p => { const st = calcularProyecto(p, filtros); return { 'Proyecto': p.nombre, 'Estado': p.estado, 'Total': st.total, 'Completadas': st.completadas, 'En Proceso': st.enProceso, 'Pendientes': st.pendientes, 'Pausadas': st.pausadas, 'Atrasadas': st.atrasadas, '% Avance': st.avance + '%', 'Empleados': st.empleados.join(', ') }; })), 'Resumen');
        const detalle = []; proyectos.forEach(p => (p.tareas||[]).forEach((t,i) => { const at = t.estado==='Completada'&&t.fecha_entregada&&t.fecha_entregada<=t.fecha_pactada; detalle.push({ 'Proyecto': p.nombre, '#': i+1, 'Tarea': t.titulo||'', 'Empleado': t.empleado||'', 'Estado': t.estado, 'Fecha pactada': t.fecha_pactada||'', 'Fecha entregada': t.fecha_entregada||'', 'A tiempo': t.estado==='Completada'?(at?'Sí':'No'):'—' }); }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Tareas');
        XLSX.writeFile(wb, `proyectos-depto-${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // ── Report cards ─────────────────────────────────────────────────────────

    const reportCards = [
        { id: 0, title: "Informe Ejecutivo", icon: <FaChartLine size={25} />, description: "Resumen global del departamento", color: "#0f766e", onClick: () => { setFilterEmpleado(''); setFilterDepartamento(''); setSelectedReport("ejecutivo"); consultarTareas(); } },
        { id: 1, title: "Informe de Productividad", icon: <FaChartBar size={25} />, description: "Resumen de tareas por empleado", color: "#0891b2", onClick: () => { setFilterEmpleado(''); setFilterDepartamento(''); setSelectedReport("productividad"); setActiveTab("tareasCompletadas"); consultarTareas(); } },
        { id: 2, title: "Informe de Tiempo", icon: <FaChartArea size={25} />, description: "Tiempos y retrasos", color: "#0891b2", onClick: () => { setFilterEmpleado(''); setFilterDepartamento(''); setSelectedReport("tiempo"); consultarTareas(); } },
        { id: 3, title: "Informe de Avance", icon: <FaChartBar size={25} />, description: "Avance de tareas por empleado", color: "#0891b2", onClick: () => { setFilterEmpleado(''); setFilterDepartamento(''); setSelectedReport("avance"); consultarTareas(); } },
        { id: 4, title: "Cumplimiento de Tareas", icon: <FaChartBar size={25} />, description: "Tareas pendientes y vencidas", color: "#0891b2", onClick: () => { setFilterEmpleado(''); setFilterDepartamento(''); setSelectedReport("cumplimiento"); consultarTareas(); } },
        { id: 5, title: "Tareas por Empleado", icon: <FaChartBar size={25} />, description: "Detalle completo por empleado", color: "#0891b2", onClick: () => { setFilterEmpleado(''); setFilterDepartamento(''); setSelectedReport("tareasPorEmpleado"); setActiveTab("tareasPorEmpleado"); consultarTareas(); } },
        { id: 6, title: "Eficiencia Operativa", icon: <FaChartArea size={25} />, description: "Ranking de eficiencia del equipo", color: "#1d4ed8", onClick: () => { setSelectedReport("eficiencia"); consultarEficiencia(); } },
        { id: 7, title: "Proyectos", icon: <FaChartBar size={25} />, description: "Avance y tareas por proyecto", color: "#7c3aed", onClick: () => { setProyectoFiltro(''); setProyectoEstadoFiltro(''); setSelectedReport("proyectos"); consultarProyectos(); } },
        { id: 8, title: "Reporte General", icon: <FaFilePdf size={25} />, description: "Informe completo por período — exportable a PDF", color: "#1a3a5c", onClick: () => { setSelectedReport("reporteGeneral"); consultarTareas(); } },
    ];

    // ── Filter bar (shared across most reports) ───────────────────────────────

    const FiltroBarra = ({ showDateRange = true }) => (
        <div className="eficiencia-filtros">
            {showDateRange && <RangosFecha startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />}
            <label className="eficiencia-filtro-label">
                Empleado
                <select className="eficiencia-filtro-input" value={filterEmpleado} onChange={e => setFilterEmpleado(e.target.value)}>
                    <option value="">Todos</option>
                    {empleadosList.sort().map(emp => <option key={emp} value={emp}>{emp}</option>)}
                </select>
            </label>
            <button className="eficiencia-filtro-clear" onClick={() => { setFilterEmpleado(''); setFilterDepartamento(''); }}>Limpiar</button>
        </div>
    );

    // ── Report content per type ───────────────────────────────────────────────

    const renderReportContent = () => {
        if (!selectedReport) return null;

        if (selectedReport === "productividad") return (
            <div className="rdm-report-content">
                <div className="tab-buttons">
                    {["tareasCompletadas","promedioTiempo","comparativo"].map(tab => (
                        <button key={tab} className={`tab-button ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                            {tab === 'tareasCompletadas' ? 'Tareas Completadas' : tab === 'promedioTiempo' ? 'Promedio por Tarea' : 'Comparativo'}
                        </button>
                    ))}
                </div>
                <div className="tab-content">
                    <FiltroBarra />
                    {activeTab === "tareasCompletadas" && (<>
                        <table className="table-productivity"><thead className="table-productivity-thead"><tr><th>Empleado</th><th>Tareas completadas</th></tr></thead><tbody>{tareasCompletadasArray.map((item, i) => <tr key={i}><td>{item.empleado}</td><td>{item.tareasCompletadas}</td></tr>)}</tbody></table>
                        <ResponsiveContainer width="100%" height={300}><BarChart data={tareasCompletadasArray} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="empleado" /><YAxis /><Tooltip /><Legend /><Bar dataKey="tareasCompletadas" fill="#2b60e5" name="Tareas Completadas" /></BarChart></ResponsiveContainer>
                    </>)}
                    {activeTab === "promedioTiempo" && (<>
                        <table className="table-productivity"><thead className="table-productivity-thead"><tr><th>Empleado</th><th>Promedio por tarea (hrs)</th></tr></thead><tbody>{promedioTiempoArray.map((item, i) => <tr key={i}><td>{item.empleado}</td><td>{item.promedioTiempo}</td></tr>)}</tbody></table>
                        <ResponsiveContainer width="100%" height={300}><LineChart data={promedioTiempoArray} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="empleado" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="promedioTiempo" stroke="#2b60e5" name="Promedio por tarea" /></LineChart></ResponsiveContainer>
                    </>)}
                    {activeTab === "comparativo" && (<>
                        <table className="table-productivity"><thead className="table-productivity-thead"><tr><th>Empleado</th><th>Completadas</th><th>Promedio (hrs)</th><th>Productividad</th></tr></thead><tbody>{comparativoArray.map((item, i) => <tr key={i}><td>{item.empleado}</td><td>{item.tareasCompletadas}</td><td>{item.promedioTiempo}</td><td>{item.productividad}</td></tr>)}</tbody></table>
                        <ResponsiveContainer width="100%" height={300}><BarChart data={comparativoArray} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="empleado" /><YAxis /><Tooltip /><Legend /><Bar dataKey="productividad" fill="#2b60e5" name="Productividad" /></BarChart></ResponsiveContainer>
                    </>)}
                </div>
            </div>
        );

        if (selectedReport === "tiempo") return (
            <div className="rdm-report-content tab-content">
                <FiltroBarra />
                <table border="1" cellPadding="8" className="table-productivity"><thead className="table-productivity-thead"><tr><th>Tarea</th><th>Empleado</th><th>Estado</th><th>Horas Estimadas</th><th>Horas Reales</th><th>¿Retrasada?</th></tr></thead><tbody>{informe.map((t, i) => <tr key={i} style={isPausada(t)?{background:'#fefce8',opacity:0.85}:{}}><td style={{ textAlign:'left' }}>{t.titulo}{isPausada(t) && <span style={{marginLeft:'6px',fontSize:'0.7rem',background:'#fde047',color:'#713f12',borderRadius:'4px',padding:'1px 5px'}}>⏸ Pausada</span>}</td><td style={{ textAlign:'left' }}>{t.empleado}</td><td>{t.estado}</td><td>{t.horasEstimadas}</td><td>{t.horasReales ?? '—'}</td><td>{isPausada(t) ? '— (pausada)' : t.retrasada ? '✅ Sí' : 'No'}</td></tr>)}</tbody></table>
            </div>
        );

        if (selectedReport === "avance") return (
            <div className="rdm-report-content tab-content">
                <FiltroBarra />
                <table className="table-productivity"><thead className="table-productivity-thead"><tr><th>Empleado</th><th>Tareas totales</th><th>Completadas</th><th>Porcentaje de avance</th></tr></thead><tbody>{resumenAvance.map((item, i) => <tr key={i}><td>{item.empleado}</td><td>{item.total}</td><td>{item.completadas}</td><td>{Math.round(item.porcentaje)}%</td></tr>)}</tbody></table>
            </div>
        );

        if (selectedReport === "cumplimiento") return (
            <div className="rdm-report-content tab-content">
                <div className="bg-white shadow-xl rounded-2xl p-8 space-y-8 border border-gray-200">
                    <div className="text-center mb-10">
                        <h3 className="text-3xl font-bold text-gray-800 mb-3">Resumen de Cumplimiento</h3>
                        <p className="text-gray-600 text-lg">Estado actual de las tareas y su cumplimiento</p>
                        <div className="w-24 h-1 bg-blue-500 mx-auto mt-4 rounded-full"></div>
                    </div>
                    <div className="overflow-x-auto">
                        <FiltroBarra />
                        <table className="table-productivity"><thead className="table-productivity-thead"><tr><th>Métrica</th><th>Cantidad</th><th>Estado</th><th>Detalle</th></tr></thead>
                            <tbody>
                                <tr><td><div className="icon-cell"><span>📋</span><span>Tareas no iniciadas</span></div></td><td className="number-cell">{noIniciadas}</td><td><span className="status-badge status-pending">Pendientes</span></td><td>Total de tareas sin iniciar</td></tr>
                                <tr><td><div className="icon-cell"><span>✅</span><span>Tareas completadas</span></div></td><td className="number-cell">{completadasCumpl}</td><td><span className="status-badge status-completed">Finalizadas</span></td><td>Total de tareas completadas</td></tr>
                                <tr><td><div className="icon-cell"><span>🔄</span><span>Recurrentes no cumplidas</span></div></td><td className="number-cell">{recurrentesNoCumplidas.length}</td><td><span className="status-badge status-pending">Pendientes</span></td><td>Tareas recurrentes sin completar</td></tr>
                                <tr><td><div className="icon-cell"><span>⏰</span><span>Incumplieron fecha límite</span></div></td><td className="number-cell">{incumplidas.length}</td><td><span className="status-badge status-delayed">Atrasadas</span></td><td>Tareas fuera de plazo</td></tr>
                            </tbody>
                        </table>
                    </div>
                    {incumplidas.length > 0 && (
                        <div className="mt-12">
                            <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-2xl p-8 shadow-lg">
                                <div className="warning-header"><h4><span>⚠️</span> Tareas que incumplieron fechas límite</h4><p className="text-red-600 mt-1">Se requiere atención inmediata</p></div>
                                <div className="overflow-x-auto">
                                    <table className="table-productivity"><thead className="table-productivity-thead"><tr><th>Tarea</th><th>Empleado</th><th>Fecha Pactada</th><th>Fecha Entregada</th><th>Estado</th></tr></thead>
                                        <tbody>{incumplidas.map((t, i) => <tr key={i}><td>{t.titulo}</td><td><span className="status-badge status-pending">{t.empleado}</span></td><td className="date-cell">{cambiarFormatoFecha(t.fecha_pactada)}</td><td className="date-cell text-red-600">{cambiarFormatoFecha(t.fecha_entregada)}</td><td><span className="status-badge status-delayed">Atrasada</span></td></tr>)}</tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );

        if (selectedReport === "tareasPorEmpleado") return (
            <div className="rdm-report-content tab-content">
                <div className="bg-white shadow-xl rounded-2xl p-8 space-y-8 border border-gray-200">
                    <div className="text-center mb-10">
                        <h3 className="text-3xl font-bold text-gray-800 mb-3">Tareas por Empleado</h3>
                        <div className="w-24 h-1 bg-blue-500 mx-auto mt-4 rounded-full"></div>
                    </div>
                    <div className="filters-section">
                        <div className="filters-grid">
                            <div className="filter-group"><label>Empleado:</label><select value={filterEmpleado} onChange={e => setFilterEmpleado(e.target.value)} className="filter-select"><option value="">Todos los empleados</option>{empleadosList.map(emp => <option key={emp} value={emp}>{emp}</option>)}</select></div>
                            <div className="filter-group"><label>Estado:</label><select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="filter-select"><option value="">Todos los estados</option>{estados.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                            <div className="filter-group"><label>Fecha Pactada - Desde:</label><input type="date" value={filterFechaInicio} onChange={e => setFilterFechaInicio(e.target.value)} className="filter-select" /></div>
                            <div className="filter-group"><label>Fecha Pactada - Hasta:</label><input type="date" value={filterFechaFin} onChange={e => setFilterFechaFin(e.target.value)} className="filter-select" /></div>
                            <div className="filter-group flex items-center gap-2"><label><input type="checkbox" checked={filterAtrasadas} onChange={e => setFilterAtrasadas(e.target.checked)} /> Solo tareas atrasadas</label></div>
                        </div>
                        <div className="filters-actions"><button className="clear-filters-button" onClick={() => { setFilterEmpleado(''); setFilterDepartamento(''); setFilterEstado(''); setFilterFechaInicio(''); setFilterFechaFin(''); setFilterAtrasadas(false); }}>Limpiar Filtros</button></div>
                    </div>
                    <div className="summary-section">
                        <div className="summary-header"><h4 className="text-xl font-semibold">Resumen por Empleado</h4><div className="summary-stats"><span className="stats-badge">{generarTareasPorEmpleado().reduce((tot, e) => tot + e.tareas.length, 0)} tareas</span></div></div>
                        <div className="overflow-x-auto">
                            <table className="table-productivity"><thead className="table-productivity-thead"><tr><th>Empleado</th><th>Total</th><th>Completadas</th><th>En Proceso</th><th>Pendientes</th><th>Pausadas</th><th>Atrasadas</th></tr></thead>
                                <tbody>{generarResumenTareasPorEmpleado().map((item, i) => <tr key={i}><td>{item.empleado}</td><td>{item.total}</td><td>{item.completadas}</td><td>{item.enProceso}</td><td>{item.pendientes}</td><td>{item.pausadas > 0 ? <span style={{color:'#f97316',fontWeight:600}}>{item.pausadas}</span> : 0}</td><td>{item.atrasadas}</td></tr>)}</tbody>
                            </table>
                        </div>
                    </div>
                    <div className="detail-section">
                        <h4 className="text-xl font-semibold mb-4">Detalle de Tareas</h4>
                        {generarTareasPorEmpleado().map((ed, idx) => (
                            <div key={idx} className="empleado-tasks mb-8">
                                <h5 className="text-lg font-medium text-blue-600 mb-3">{ed.empleado} ({ed.tareas.length} tareas)</h5>
                                <div className="overflow-x-auto">
                                    <table className="table-productivity"><thead className="table-productivity-thead"><tr><th>Título</th><th>Estado</th><th>Fecha Pactada</th><th>Fecha Entregada</th><th>Prioridad</th></tr></thead>
                                        <tbody>{ed.tareas.map((t, ti) => <tr key={ti}><td>{t.titulo}</td><td><span className={`status-badge status-${t.estado.toLowerCase().replace(' ','-')}`}>{t.estado}</span></td><td>{cambiarFormatoFecha(t.fecha_pactada)}</td><td>{cambiarFormatoFecha(t.fecha_entregada)}</td><td>{t.prioridad || 'N/A'}</td></tr>)}</tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );

        if (selectedReport === "ejecutivo") {
            const { totalCompletadas, totalEnProceso, totalPendientes, totalPausadas, totalAtrasadas, deptData, eficienciaData } = calcularInformeEjecutivo();
            return (
                <div className="rdm-report-content tab-content">
                    <FiltroBarra />
                    <div className="executive-kpis">
                        <div className="exec-kpi exec-kpi--green"><span className="exec-kpi-number">{totalCompletadas}</span><span className="exec-kpi-label">Completadas</span></div>
                        <div className="exec-kpi exec-kpi--blue"><span className="exec-kpi-number">{totalEnProceso}</span><span className="exec-kpi-label">En Proceso</span></div>
                        <div className="exec-kpi exec-kpi--orange"><span className="exec-kpi-number">{totalPendientes}</span><span className="exec-kpi-label">Pendientes</span></div>
                        {totalPausadas > 0 && <div className="exec-kpi exec-kpi--pause"><span className="exec-kpi-number">{totalPausadas}</span><span className="exec-kpi-label">Pausadas</span></div>}
                        <div className="exec-kpi exec-kpi--red"><span className="exec-kpi-number">{totalAtrasadas}</span><span className="exec-kpi-label">Atrasadas</span></div>
                    </div>
                    <h3 style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', color: '#374151' }}>Avance por Área</h3>
                    <ResponsiveContainer width="100%" height={240}><BarChart data={deptData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="departamento" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 12 }} /><YAxis domain={[0,100]} tickFormatter={v => `${v}%`} /><Tooltip formatter={v => `${v}%`} /><Bar dataKey="porcentaje" fill="#0891b2" name="% Completado" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
                    <h3 style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', color: '#374151' }}>Eficiencia por Empleado (% entregado a tiempo)</h3>
                    <ResponsiveContainer width="100%" height={240}><BarChart data={eficienciaData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="empleado" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 11 }} /><YAxis domain={[0,100]} tickFormatter={v => `${v}%`} /><Tooltip formatter={v => `${v}%`} /><Bar dataKey="eficiencia" fill="#0f766e" name="Eficiencia" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
                </div>
            );
        }

        if (selectedReport === "eficiencia") {
            const empleados = calcularEficienciaOperativa();
            const deptos = calcularDeptEficiencia(empleados);
            const alto = empleados.filter(e => e.score >= 0.75).length;
            const medio = empleados.filter(e => e.score >= 0.50 && e.score < 0.75).length;
            const critico = empleados.filter(e => e.score < 0.50).length;
            const promedioGlobal = empleados.length > 0 ? Math.round((empleados.reduce((s,e) => s+e.score,0)/empleados.length)*100) : 0;
            const totalSum = empleados.reduce((s,e) => s+e.total,0);
            const pctATiempo = totalSum > 0 ? Math.round(empleados.reduce((s,e) => s+e.aTiempo,0)/totalSum*100) : 0;
            const pctReprocesos = totalSum > 0 ? Math.round(empleados.reduce((s,e) => s+e.reprocesos,0)/totalSum*100) : 0;
            return (
                <div className="rdm-report-content tab-content">
                    <div className="eficiencia-filtros">
                        <label className="eficiencia-filtro-label">Desde<input type="date" className="eficiencia-filtro-input" value={eficienciaStart} onChange={e => setEficienciaStart(e.target.value)} /></label>
                        <label className="eficiencia-filtro-label">Hasta<input type="date" className="eficiencia-filtro-input" value={eficienciaEnd} onChange={e => setEficienciaEnd(e.target.value)} /></label>
                        <label className="eficiencia-filtro-label">Empleado<select className="eficiencia-filtro-input" value={eficienciaFilterEmpleado} onChange={e => setEficienciaFilterEmpleado(e.target.value)}><option value="">Todos</option>{[...new Set(datosEficiencia.map(t => t.nombre_empleado).filter(Boolean))].sort().map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                        <button className="eficiencia-filtro-clear" onClick={() => { setEficienciaStart(''); setEficienciaEnd(''); setEficienciaFilterArea(''); setEficienciaFilterEmpleado(''); }}>Limpiar</button>
                        {loadingEficiencia && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Cargando...</span>}
                    </div>
                    <div className="executive-kpis" style={{ marginBottom: '1.5rem' }}>
                        <div className="exec-kpi exec-kpi--green"><span className="exec-kpi-number">{alto}</span><span className="exec-kpi-label">🟢 Alto</span></div>
                        <div className="exec-kpi exec-kpi--orange"><span className="exec-kpi-number">{medio}</span><span className="exec-kpi-label">🟡 Medio</span></div>
                        <div className="exec-kpi exec-kpi--red"><span className="exec-kpi-number">{critico}</span><span className="exec-kpi-label">🔴 Crítico</span></div>
                        <div className="exec-kpi exec-kpi--blue"><span className="exec-kpi-number">{promedioGlobal}%</span><span className="exec-kpi-label">Eficiencia promedio</span></div>
                        <div className="exec-kpi" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}><span className="exec-kpi-number" style={{ color: '#16a34a' }}>{pctATiempo}%</span><span className="exec-kpi-label">A tiempo</span></div>
                        <div className="exec-kpi" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}><span className="exec-kpi-number" style={{ color: '#dc2626' }}>{pctReprocesos}%</span><span className="exec-kpi-label">Reprocesos</span></div>
                    </div>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>Ranking por Empleado</h3>
                    <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                        <table className="eficiencia-ranking-table"><thead><tr><th>#</th><th>Nombre</th><th>Cargo</th><th>Área</th><th>Nivel</th><th>Score</th><th>Completadas</th><th>A tiempo</th><th>Reprocesos</th></tr></thead>
                            <tbody>{empleados.map((emp, idx) => (
                                <tr key={emp.nombre} className={emp.score < 0.50 ? 'eficiencia-row-critico' : ''}>
                                    <td style={{ fontWeight:700, color:'#6b7280' }}>{idx+1}</td>
                                    <td style={{ fontWeight:600 }}>{emp.nombre}</td>
                                    <td style={{ color:'#6b7280', fontSize:'0.85rem' }}>{emp.cargo}</td>
                                    <td style={{ color:'#6b7280', fontSize:'0.85rem' }}>{emp.departamento}</td>
                                    <td><span className={`eficiencia-nivel-badge ${emp.score>=0.75?'badge-alto':emp.score>=0.50?'badge-medio':'badge-critico'}`}>{emp.nivel}</span></td>
                                    <td><div className="eficiencia-score-bar-wrap"><div className="eficiencia-score-bar" style={{ width:`${emp.score*100}%`, background:emp.score>=0.75?'#16a34a':emp.score>=0.50?'#f97316':'#dc2626' }}/><span className="eficiencia-score-num">{emp.score.toFixed(2)}</span></div></td>
                                    <td style={{ textAlign:'center' }}>{emp.completadas}/{emp.total}</td>
                                    <td style={{ textAlign:'center' }}>{emp.aTiempo}</td>
                                    <td style={{ textAlign:'center', color:emp.reprocesos>0?'#dc2626':'#16a34a' }}>{emp.reprocesos}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    <div className="eficiencia-insights">
                        {critico > 0 && <div className="insight-card insight-card--alert"><strong>⚠ {critico} empleado{critico>1?'s':''} en zona crítica:</strong> {empleados.filter(e=>e.score<0.50).map(e=>e.nombre).join(', ')}</div>}
                        {deptos.filter(d=>d.scorePromedio<0.60).map(d => <div key={d.departamento} className="insight-card insight-card--alert">⚠ Área <strong>{d.departamento}</strong> con score {d.scorePromedio.toFixed(2)}</div>)}
                        {deptos.length > 0 && <div className="insight-card insight-card--ok">✅ Mejor empleado: <strong>{empleados[0]?.nombre}</strong> (score {empleados[0]?.score.toFixed(2)})</div>}
                        <div className="insight-card insight-card--info">📊 {pctATiempo}% de tareas entregadas a tiempo</div>
                        <div className="insight-card insight-card--info">📊 Índice de reprocesos: {pctReprocesos}%</div>
                        {critico === 0 && <div className="insight-card insight-card--ok">✅ Todos los empleados están en niveles aceptables o superiores</div>}
                    </div>
                </div>
            );
        }

        if (selectedReport === "proyectos") {
            const proyectosFiltrados = datosProyectos.filter(p => {
                if (proyectoFiltro && p.id !== parseInt(proyectoFiltro)) return false;
                if (proyectoEstadoFiltro && p.estado?.toUpperCase() !== proyectoEstadoFiltro.toUpperCase()) return false;
                if (proyectoStartDate || proyectoEndDate) { const td = (p.tareas||[]).some(t => (!proyectoStartDate||t.fecha_pactada>=proyectoStartDate)&&(!proyectoEndDate||t.fecha_pactada<=proyectoEndDate)); if (!td) return false; }
                return true;
            });
            const estadosUnicos = [...new Set(datosProyectos.map(p => p.estado).filter(Boolean))];
            return (
                <div className="rdm-report-content tab-content">
                    <div className="eficiencia-filtros">
                        <RangosFecha startDate={proyectoStartDate} setStartDate={setProyectoStartDate} endDate={proyectoEndDate} setEndDate={setProyectoEndDate} />
                        <label className="eficiencia-filtro-label">Proyecto<select className="eficiencia-filtro-input" value={proyectoFiltro} onChange={e => setProyectoFiltro(e.target.value)}><option value="">Todos</option>{datosProyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
                        <label className="eficiencia-filtro-label">Estado<select className="eficiencia-filtro-input" value={proyectoEstadoFiltro} onChange={e => setProyectoEstadoFiltro(e.target.value)}><option value="">Todos</option>{estadosUnicos.map(e => <option key={e} value={e}>{e}</option>)}</select></label>
                        <button className="eficiencia-filtro-clear" onClick={() => { setProyectoFiltro(''); setProyectoEstadoFiltro(''); setProyectoStartDate(''); setProyectoEndDate(''); }}>Limpiar</button>
                        {loadingProyectos && <span style={{ color:'#6b7280', fontSize:'0.85rem' }}>Cargando...</span>}
                    </div>
                    {proyectosFiltrados.length === 0 && !loadingProyectos && <p style={{ color:'#9ca3af', textAlign:'center', padding:'2rem' }}>No hay proyectos para mostrar.</p>}
                    {proyectosFiltrados.map(proyecto => {
                        const st = calcularProyecto(proyecto, { startDate: proyectoStartDate, endDate: proyectoEndDate });
                        const estadoColor = {ACTIVO:'#7c3aed',COMPLETADO:'#16a34a',PAUSADO:'#f59e0b',CANCELADO:'#dc2626'}[proyecto.estado?.toUpperCase()]||'#6b7280';
                        const barColor = st.avance>=80?'#16a34a':st.avance>=40?'#f59e0b':'#dc2626';
                        return (
                            <div key={proyecto.id} className="proy-card">
                                <div className="proy-card-header"><div><h3 className="proy-card-nombre">{proyecto.nombre}</h3><span className="proy-card-fechas">{proyecto.fecha_inicio||'—'} → {proyecto.fecha_fin_estimada||'—'}</span></div><span className="proy-estado-badge" style={{ background:estadoColor+'22',color:estadoColor,border:`1px solid ${estadoColor}55` }}>{proyecto.estado||'—'}</span></div>
                                <div className="proy-avance-wrap"><div className="proy-avance-bar"><div className="proy-avance-fill" style={{ width:`${st.avance}%`,background:barColor }}/></div><span className="proy-avance-pct">{st.avance}%</span></div>
                                <div className="proy-kpis">
                                    <div className="proy-kpi"><span className="proy-kpi-num">{st.total}</span><span className="proy-kpi-lbl">Total</span></div>
                                    <div className="proy-kpi proy-kpi--ok"><span className="proy-kpi-num">{st.completadas}</span><span className="proy-kpi-lbl">✅ Completadas</span></div>
                                    <div className="proy-kpi proy-kpi--blue"><span className="proy-kpi-num">{st.enProceso}</span><span className="proy-kpi-lbl">⏳ En Proceso</span></div>
                                    <div className="proy-kpi proy-kpi--orange"><span className="proy-kpi-num">{st.pendientes}</span><span className="proy-kpi-lbl">⌛ Pendientes</span></div>
                                    {st.pausadas > 0 && <div className="proy-kpi" style={{background:'#fff7ed',color:'#ea580c'}}><span className="proy-kpi-num">{st.pausadas}</span><span className="proy-kpi-lbl">⏸️ Pausadas</span></div>}
                                    <div className="proy-kpi proy-kpi--red"><span className="proy-kpi-num">{st.atrasadas}</span><span className="proy-kpi-lbl">⚠️ Atrasadas</span></div>
                                    <div className="proy-kpi proy-kpi--purple"><span className="proy-kpi-num">{st.aTiempo}</span><span className="proy-kpi-lbl">🕐 A tiempo</span></div>
                                </div>
                                {st.empleados.length > 0 && <div className="proy-equipo"><span className="proy-equipo-titulo">Equipo:</span>{st.empleados.map(emp => <span key={emp} className="proy-emp-chip">{emp}</span>)}</div>}
                                {proyecto.tareas.length > 0 && (
                                    <div style={{ overflowX:'auto', marginTop:'1rem' }}>
                                        <table className="eficiencia-ranking-table"><thead><tr><th>#</th><th>Tarea</th><th>Empleado</th><th>Estado</th><th>Fecha pactada</th><th>Entregada</th><th>¿A tiempo?</th></tr></thead>
                                            <tbody>{proyecto.tareas.map((t,idx) => { const at=t.estado==='Completada'&&t.fecha_entregada&&t.fecha_entregada<=t.fecha_pactada; const st2={'Completada':{color:'#16a34a',fontWeight:600},'En Proceso':{color:'#2563eb'},'Pendiente':{color:'#f97316'}}[t.estado]||{}; return <tr key={t.id}><td style={{ color:'#9ca3af',fontSize:'0.8rem' }}>{idx+1}</td><td style={{ fontWeight:500 }}>{t.titulo||'—'}</td><td style={{ color:'#6b7280',fontSize:'0.85rem' }}>{t.empleado||'—'}</td><td><span style={st2}>{t.estado}</span></td><td style={{ fontSize:'0.85rem' }}>{cambiarFormatoFecha(t.fecha_pactada)}</td><td style={{ fontSize:'0.85rem' }}>{t.fecha_entregada?cambiarFormatoFecha(t.fecha_entregada):'—'}</td><td style={{ textAlign:'center' }}>{t.estado==='Completada'?(at?'✅':'❌'):'—'}</td></tr>; })}</tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (selectedReport === "reporteGeneral") {
            const hoy = new Date().toISOString().split('T')[0];

            const pausadasActivas = tareas.filter(t => isPausada(t));
            const enProceso = tareas.filter(t => t.estado === 'En Proceso' && !isPausada(t));
            const pendientesActivas = tareas.filter(t => t.estado === 'Pendiente' && !isPausada(t));
            const completadasPeriodo = tareas.filter(t =>
                t.estado === 'Completada' && t.fecha_entregada &&
                t.fecha_entregada >= rGStart && t.fecha_entregada <= rGEnd
            );
            const totalKpi = enProceso.length + pendientesActivas.length + pausadasActivas.length + completadasPeriodo.length;
            const tasa = (enProceso.length + completadasPeriodo.length) > 0
                ? Math.round(completadasPeriodo.length / (enProceso.length + completadasPeriodo.length) * 100)
                : 0;
            const empleadosUnicos = [...new Set(tareas.map(t => t.empleado).filter(Boolean))];

            const produccionMensual = {};
            tareas.filter(t => t.estado === 'Completada' && t.fecha_entregada).forEach(t => {
                const d = new Date(t.fecha_entregada + 'T12:00:00');
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                produccionMensual[key] = (produccionMensual[key] || 0) + 1;
            });
            const mesesOrdenados = Object.keys(produccionMensual).sort();
            const mesNombre = (key) => {
                const [yr, mo] = key.split('-');
                return `${'Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic'.split(' ')[parseInt(mo)-1]} ${yr}`;
            };

            const diasRestantes = (fp) => fp ? Math.round((new Date(fp+'T12:00:00') - new Date(hoy+'T12:00:00')) / 86400000) : null;
            const diffDias = (p, e) => (p && e) ? Math.round((new Date(e+'T12:00:00') - new Date(p+'T12:00:00')) / 86400000) : null;

            const rendimientoEmp = empleadosUnicos.map(emp => {
                const tt = tareas.filter(t => t.empleado === emp);
                const ttActivo = tt.filter(t => !isPausada(t));
                return {
                    nombre: emp,
                    cargo: tt[0]?.cargo || '',
                    total: tt.length,
                    completadas: tt.filter(t => t.estado === 'Completada').length,
                    completadasPeriodo: completadasPeriodo.filter(t => t.empleado === emp).length,
                    enProceso: ttActivo.filter(t => t.estado === 'En Proceso').length,
                    pausadas: tt.filter(t => isPausada(t)).length,
                };
            }).sort((a, b) => b.total - a.total);

            const thS = { color:'#fff', padding:'10px 12px', textAlign:'left', fontWeight:600, fontSize:'11px', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap' };
            const tdS = { padding:'9px 12px', verticalAlign:'top', fontSize:'12px' };
            const bc = (p) => p === 'Alta' ? { bg:'#fee2e2', color:'#b91c1c' } : p === 'Media' ? { bg:'#fef3c7', color:'#92400e' } : { bg:'#dcfce7', color:'#166534' };
            const SH = ({ icon, bg, title, sub }) => (
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px', paddingBottom:'10px', borderBottom:'2px solid #e5e7eb' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'8px', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>{icon}</div>
                    <div><div style={{ fontSize:'17px', fontWeight:700, color:'#1a3a5c' }}>{title}</div>{sub&&<div style={{ fontSize:'12px', color:'#6b7280', marginTop:'2px' }}>{sub}</div>}</div>
                </div>
            );

            return (
                <>
                    <div className="eficiencia-filtros" style={{ marginBottom:'1rem', background:'#fff', padding:'0.75rem 1rem', borderRadius:'8px', border:'1px solid #e5e7eb', flexShrink:0 }}>
                        <label className="eficiencia-filtro-label">Desde<input type="date" className="eficiencia-filtro-input" value={rGStart} onChange={e => setRGStart(e.target.value)} /></label>
                        <label className="eficiencia-filtro-label">Hasta<input type="date" className="eficiencia-filtro-input" value={rGEnd} onChange={e => setRGEnd(e.target.value)} /></label>
                        <button className="eficiencia-filtro-clear" onClick={() => { setRGStart(fmt(firstDay)); setRGEnd(fmt(lastDay)); }}>Este mes</button>
                    </div>

                    <div className="rdm-report-content tab-content" style={{ background:'#f1f5f9', padding:'1.5rem', borderRadius:'12px' }}>
                        {tareas.length === 0 && <p style={{ color:'#9ca3af', textAlign:'center', padding:'2rem' }}>Cargando datos...</p>}
                        {tareas.length > 0 && (<>

                            {/* HEADER */}
                            <div style={{ background:'linear-gradient(135deg,#1a3a5c 0%,#0f2744 100%)', color:'#fff', padding:'32px 40px', borderRadius:'12px', marginBottom:'24px' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'16px' }}>
                                    <div>
                                        <h2 style={{ fontSize:'22px', fontWeight:700, margin:0, letterSpacing:'-.5px' }}>Informe de Actividades</h2>
                                        <p style={{ fontSize:'14px', opacity:.85, margin:'6px 0 0' }}>Período {cambiarFormatoFecha(rGStart)} – {cambiarFormatoFecha(rGEnd)}</p>
                                        <span style={{ display:'inline-block', marginTop:'12px', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'20px', padding:'3px 14px', fontSize:'11px', letterSpacing:'1px', textTransform:'uppercase' }}>Uso interno</span>
                                    </div>
                                    <div style={{ textAlign:'right', fontSize:'12px', opacity:.75, lineHeight:1.9 }}>
                                        <strong style={{ display:'block', color:'#93c5fd', fontSize:'13px', opacity:1, marginBottom:'4px' }}>Generado el {cambiarFormatoFecha(hoy)}</strong>
                                        Empleados activos: {empleadosUnicos.length}
                                    </div>
                                </div>
                            </div>

                            {/* KPIs */}
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'14px', marginBottom:'28px' }}>
                                {[
                                    { label:'Total tareas', value:totalKpi, sub:'Período seleccionado', color:'#2563eb' },
                                    { label:'En Proceso', value:enProceso.length, sub:'Activas actualmente', color:'#d97706' },
                                    ...(pausadasActivas.length > 0 ? [{ label:'Pausadas', value:pausadasActivas.length, sub:'En espera de reanudación', color:'#ca8a04' }] : []),
                                    { label:'Completadas', value:completadasPeriodo.length, sub:'En el período', color:'#16a34a' },
                                    { label:'Tasa completitud', value:`${tasa}%`, sub:`${completadasPeriodo.length} de ${enProceso.length + completadasPeriodo.length}`, color:'#0891b2' },
                                    { label:'Empleados', value:empleadosUnicos.length, sub:'Con tareas asignadas', color:'#7c3aed' },
                                ].map(kpi => (
                                    <div key={kpi.label} style={{ background:'#fff', borderRadius:'12px', padding:'18px 14px 14px', boxShadow:'0 1px 3px rgba(0,0,0,.12)', borderTop:`4px solid ${kpi.color}`, textAlign:'center' }}>
                                        <div style={{ fontSize:'34px', fontWeight:800, color:kpi.color, lineHeight:1, marginBottom:'5px' }}>{kpi.value}</div>
                                        <div style={{ fontSize:'11px', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', color:'#6b7280' }}>{kpi.label}</div>
                                        <div style={{ fontSize:'10px', color:'#9ca3af', marginTop:'3px' }}>{kpi.sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Tareas En Proceso */}
                            {enProceso.length > 0 && (
                                <div style={{ marginBottom:'32px' }}>
                                    <SH icon="⚙️" bg="#fef3c7" title="Tareas En Proceso" sub={`${enProceso.length} tareas activas al ${cambiarFormatoFecha(hoy)}`} />
                                    <div style={{ overflowX:'auto', borderRadius:'10px', boxShadow:'0 1px 3px rgba(0,0,0,.12)' }}>
                                        <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', fontSize:'12px' }}>
                                            <thead><tr style={{ background:'#1a3a5c' }}>{['Empleado / Cargo','Tarea','Prioridad','Fecha Pactada','Estado'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                                            <tbody>{enProceso.map((t,i) => {
                                                const dr = diasRestantes(t.fecha_pactada);
                                                const b = bc(t.prioridad);
                                                return <tr key={t.id} style={{ borderBottom:'1px solid #e5e7eb', background:i%2===0?'#fff':'#f9fafb' }}>
                                                    <td style={tdS}><div style={{ fontWeight:600 }}>{t.empleado}</div><div style={{ fontSize:'11px', color:'#64748b' }}>{t.cargo||''}</div></td>
                                                    <td style={{ ...tdS, maxWidth:'260px' }}><div style={{ fontWeight:500 }}>{t.titulo}</div>{t.descripcion&&<div style={{ fontSize:'11px', color:'#64748b', marginTop:'2px', lineHeight:1.4 }}>{t.descripcion.substring(0,80)}...</div>}</td>
                                                    <td style={tdS}><span style={{ display:'inline-flex', padding:'2px 9px', borderRadius:'20px', fontSize:'10px', fontWeight:600, textTransform:'uppercase', background:b.bg, color:b.color }}>{t.prioridad||'N/A'}</span></td>
                                                    <td style={tdS}>{cambiarFormatoFecha(t.fecha_pactada)}</td>
                                                    <td style={tdS}>{dr===null?'—':dr<0?<span style={{ color:'#dc2626', fontWeight:700 }}>⚠ {Math.abs(dr)}d atrasada</span>:dr===0?<span style={{ color:'#dc2626', fontWeight:700 }}>⚠ Vence HOY</span>:<span style={{ color:'#16a34a', fontWeight:700 }}>{dr} días restantes</span>}</td>
                                                </tr>;
                                            })}</tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Tareas Pausadas */}
                            {pausadasActivas.length > 0 && (
                                <div style={{ marginBottom:'32px' }}>
                                    <SH icon="⏸️" bg="#fefce8" title="Tareas Pausadas" sub={`${pausadasActivas.length} tareas en espera de reanudación`} />
                                    <div style={{ overflowX:'auto', borderRadius:'10px', boxShadow:'0 1px 3px rgba(0,0,0,.12)' }}>
                                        <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', fontSize:'12px' }}>
                                            <thead><tr style={{ background:'#92400e' }}>{['Empleado / Cargo','Tarea','Prioridad','Fecha Pactada','Motivo de pausa'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                                            <tbody>{pausadasActivas.map((t,i) => {
                                                const b = bc(t.prioridad);
                                                return <tr key={t.id} style={{ borderBottom:'1px solid #e5e7eb', background:i%2===0?'#fefce8':'#fef9c3' }}>
                                                    <td style={tdS}><div style={{ fontWeight:600 }}>{t.empleado}</div><div style={{ fontSize:'11px', color:'#64748b' }}>{t.cargo||''}</div></td>
                                                    <td style={{ ...tdS, maxWidth:'260px' }}><div style={{ fontWeight:500 }}>{t.titulo}</div></td>
                                                    <td style={tdS}><span style={{ display:'inline-flex', padding:'2px 9px', borderRadius:'20px', fontSize:'10px', fontWeight:600, textTransform:'uppercase', background:b.bg, color:b.color }}>{t.prioridad||'N/A'}</span></td>
                                                    <td style={tdS}>{cambiarFormatoFecha(t.fecha_pactada)}</td>
                                                    <td style={{ ...tdS, maxWidth:'200px', color:'#92400e' }}>{t.motivo_reprogramacion || '—'}</td>
                                                </tr>;
                                            })}</tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Completadas en el período */}
                            {completadasPeriodo.length > 0 && (
                                <div style={{ marginBottom:'32px' }}>
                                    <SH icon="✅" bg="#dcfce7" title={`Tareas Completadas — ${cambiarFormatoFecha(rGStart)} al ${cambiarFormatoFecha(rGEnd)}`} sub={`${completadasPeriodo.length} tareas entregadas`} />
                                    <div style={{ overflowX:'auto', borderRadius:'10px', boxShadow:'0 1px 3px rgba(0,0,0,.12)' }}>
                                        <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', fontSize:'12px' }}>
                                            <thead><tr style={{ background:'#1a3a5c' }}>{['Empleado','Tarea','Prioridad','Fecha Pactada','Fecha Entregada','Cumplimiento'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                                            <tbody>{[...completadasPeriodo].sort((a,b)=>(a.fecha_entregada||'').localeCompare(b.fecha_entregada||'')).map((t,i) => {
                                                const diff = diffDias(t.fecha_pactada, t.fecha_entregada);
                                                const b2 = bc(t.prioridad);
                                                return <tr key={t.id} style={{ borderBottom:'1px solid #e5e7eb', background:i%2===0?'#fff':'#f9fafb' }}>
                                                    <td style={tdS}><div style={{ fontWeight:600 }}>{t.empleado}</div><div style={{ fontSize:'11px', color:'#64748b' }}>{t.cargo||''}</div></td>
                                                    <td style={{ ...tdS, maxWidth:'240px', fontWeight:500 }}>{t.titulo}</td>
                                                    <td style={tdS}><span style={{ display:'inline-flex', padding:'2px 9px', borderRadius:'20px', fontSize:'10px', fontWeight:600, textTransform:'uppercase', background:b2.bg, color:b2.color }}>{t.prioridad||'N/A'}</span></td>
                                                    <td style={tdS}>{cambiarFormatoFecha(t.fecha_pactada)}</td>
                                                    <td style={tdS}>{cambiarFormatoFecha(t.fecha_entregada)}</td>
                                                    <td style={tdS}>{diff===null?'—':diff<0?<span style={{ color:'#2563eb', fontWeight:700 }}>✓ {Math.abs(diff)}d antes</span>:diff===0?<span style={{ color:'#16a34a', fontWeight:700 }}>✓ A tiempo</span>:diff<=7?<span style={{ color:'#d97706', fontWeight:700 }}>⚡ {diff}d tarde</span>:<span style={{ color:'#dc2626', fontWeight:700 }}>✗ {diff}d tarde</span>}</td>
                                                </tr>;
                                            })}</tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Producción histórica */}
                            {mesesOrdenados.length > 0 && (
                                <div style={{ marginBottom:'32px' }}>
                                    <SH icon="📊" bg="#dbeafe" title="Producción Histórica — Entregas por Mes" sub="Cantidad de tareas completadas por fecha de entrega" />
                                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:'10px' }}>
                                        {mesesOrdenados.map(mes => {
                                            const maxVal = Math.max(...Object.values(produccionMensual));
                                            const count = produccionMensual[mes];
                                            const isPeak = count === maxVal && maxVal > 0;
                                            const isPeriodo = mes >= rGStart.substring(0,7) && mes <= rGEnd.substring(0,7);
                                            return (
                                                <div key={mes} style={{ background:isPeriodo?'#fffbeb':'#fff', borderRadius:'8px', padding:'12px', boxShadow:'0 1px 3px rgba(0,0,0,.12)', textAlign:'center', borderTop:`3px solid ${isPeak?'#f59e0b':isPeriodo?'#16a34a':'#e5e7eb'}` }}>
                                                    <div style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'.5px', color:'#6b7280', fontWeight:600 }}>{mesNombre(mes)}{isPeak?' ★':''}</div>
                                                    <div style={{ fontSize:'26px', fontWeight:800, lineHeight:1.1, color:isPeak?'#d97706':isPeriodo?'#16a34a':'#9ca3af' }}>{count}</div>
                                                    <div style={{ fontSize:'10px', color:'#6b7280' }}>entregas</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Desempeño por empleado */}
                            <div style={{ marginBottom:'32px' }}>
                                <SH icon="👥" bg="#ede9fe" title="Desempeño por Empleado" sub="Distribución y análisis individual del equipo" />
                                {rendimientoEmp.map((emp, idx) => (
                                    <div key={idx} style={{ background:'#fff', borderRadius:'10px', padding:'18px 20px', boxShadow:'0 1px 3px rgba(0,0,0,.12)', marginBottom:'12px' }}>
                                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                                            <div>
                                                <div style={{ fontSize:'14px', fontWeight:700, color:'#1a3a5c' }}>{emp.nombre}</div>
                                                {emp.cargo && <div style={{ fontSize:'11px', color:'#6b7280', marginTop:'2px' }}>{emp.cargo}</div>}
                                            </div>
                                            <div style={{ fontSize:'24px', fontWeight:800, color:'#2563eb' }}>{emp.total}</div>
                                        </div>
                                        {[
                                            { lbl:'Completadas (histórico)', val:emp.completadas, c1:'#16a34a', c2:'#22c55e' },
                                            { lbl:`Completadas (período)`, val:emp.completadasPeriodo, c1:'#2563eb', c2:'#60a5fa' },
                                            { lbl:'En Proceso', val:emp.enProceso, c1:'#d97706', c2:'#f59e0b' },
                                        ].map(bar => (
                                            <div key={bar.lbl} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                                                <span style={{ width:'170px', fontSize:'11px', fontWeight:500, flexShrink:0 }}>{bar.lbl}</span>
                                                <div style={{ flex:1, height:'10px', background:'#f3f4f6', borderRadius:'5px', overflow:'hidden' }}>
                                                    <div style={{ height:'100%', borderRadius:'5px', width:`${emp.total>0?Math.min(bar.val/emp.total*100,100):0}%`, background:`linear-gradient(90deg,${bar.c1},${bar.c2})` }} />
                                                </div>
                                                <span style={{ fontSize:'11px', fontWeight:700, width:'24px', textAlign:'right' }}>{bar.val}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div style={{ marginTop:'16px', padding:'16px 20px', background:'#fff', borderRadius:'10px', boxShadow:'0 1px 3px rgba(0,0,0,.12)', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'11px', color:'#6b7280', flexWrap:'wrap', gap:'8px' }}>
                                <div><strong>Work Board</strong> — Reporte General por Período</div>
                                <div>Generado el <strong>{cambiarFormatoFecha(hoy)}</strong> &nbsp;|&nbsp; Período: {cambiarFormatoFecha(rGStart)} – {cambiarFormatoFecha(rGEnd)}</div>
                            </div>
                        </>)}
                    </div>
                </>
            );
        }

        return null;
    };

    // ── Report title map ──────────────────────────────────────────────────────

    const reportTitles = {
        ejecutivo: 'Informe Ejecutivo',
        productividad: 'Informe de Productividad',
        tiempo: 'Informe de Tiempo',
        avance: 'Informe de Avance',
        cumplimiento: 'Cumplimiento de Tareas',
        tareasPorEmpleado: 'Tareas por Empleado',
        eficiencia: 'Eficiencia Operativa',
        proyectos: 'Proyectos',
        reporteGeneral: 'Reporte General por Período',
    };

    const exportButtons = {
        tareasPorEmpleado: <button className="excel-button" onClick={exportarExcel}><FaChartBar /> Excel</button>,
        eficiencia: (() => { const emps = calcularEficienciaOperativa(); const dpts = calcularDeptEficiencia(emps); return <button className="excel-button" onClick={() => exportarEficienciaExcel(emps, dpts)}><FaChartBar /> Excel</button>; })(),
        proyectos: <button className="excel-button" onClick={() => { const pf = datosProyectos.filter(p => { if (proyectoFiltro && p.id !== parseInt(proyectoFiltro)) return false; if (proyectoEstadoFiltro && p.estado?.toUpperCase() !== proyectoEstadoFiltro.toUpperCase()) return false; return true; }); exportarProyectosExcel(pf, { startDate: proyectoStartDate, endDate: proyectoEndDate }); }}><FaChartBar /> Excel</button>,
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-report rdm-modal-wrap">
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {selectedReport && (
                            <button className="rdm-back-btn" onClick={() => setSelectedReport(null)}>
                                <FaArrowLeft /> Reportes
                            </button>
                        )}
                        <h2 style={{ margin: 0 }}>
                            {selectedReport ? reportTitles[selectedReport] : 'Reportes del Departamento'}
                        </h2>
                    </div>
                    <div className="header-actions">
                        {selectedReport && (
                            <button className="pdf-button" onClick={() => generarPDF(reportTitles[selectedReport] || 'Reporte')} disabled={pdfLoading}>
                                <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                            </button>
                        )}
                        {selectedReport && exportButtons[selectedReport]}
                        <button className="close-button" onClick={onClose}><FaTimes /></button>
                    </div>
                </div>

                <div className="rdm-body">
                    {!selectedReport ? (
                        <div className="parameters-grid rdm-cards-grid">
                            {reportCards.map(card => (
                                <div key={card.id + card.title} className="parameter-card" onClick={card.onClick} style={{ cursor: 'pointer' }}>
                                    <div className="card-icon" style={{ color: card.color }}>{card.icon}</div>
                                    <div className="card-content">
                                        <h3>{card.title}</h3>
                                        <p>{card.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        renderReportContent()
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportesDepartamentoModal;
