import { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** PDF del informe abierto (la ventana «.modal-report»), tal como se ve. */
export default function usePdfInforme() {
    const [pdfLoading, setPdfLoading] = useState(false);

    const generarPDF = async (titulo) => {
        const element = document.querySelector('.modal-report');
        if (!element) return;
        setPdfLoading(true);

        // Se despliega todo lo que tiene desplazamiento, para capturarlo entero.
        const guardados = [];
        [element, ...element.querySelectorAll('*')].forEach((el) => {
            const cs = window.getComputedStyle(el);
            const conScroll = [cs.overflow, cs.overflowX, cs.overflowY].some((v) => ['auto', 'scroll'].includes(v));
            if (!conScroll && !(cs.maxHeight && cs.maxHeight !== 'none')) return;
            const { overflow, overflowX, overflowY, maxHeight, height } = el.style;
            guardados.push({ el, estilos: { overflow, overflowX, overflowY, maxHeight, height } });
            Object.assign(el.style, { overflow: 'visible', overflowX: 'visible', overflowY: 'visible', maxHeight: 'none', height: 'auto' });
        });
        await new Promise((r) => setTimeout(r, 200));

        try {
            const canvas = await html2canvas(element, {
                scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff',
                scrollX: 0, scrollY: -window.scrollY,
                width: element.scrollWidth, height: element.scrollHeight,
                windowWidth: document.documentElement.scrollWidth, windowHeight: document.documentElement.scrollHeight,
            });
            const imagen = canvas.toDataURL('image/jpeg', 0.92);
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const ancho = pdf.internal.pageSize.getWidth();
            const alto = pdf.internal.pageSize.getHeight();
            const altoTotal = canvas.height * (ancho / canvas.width);
            for (let y = 0; y < altoTotal; y += alto) {
                if (y > 0) pdf.addPage();
                pdf.addImage(imagen, 'JPEG', 0, -y, ancho, altoTotal);
            }
            pdf.save(`${titulo.replace(/\s+/g, '-').toLowerCase()}-${hoy()}.pdf`);
        } catch (e) {
            console.error('Error generando PDF:', e);
            window.alert('No fue posible generar el PDF. Inténtalo de nuevo.');
        } finally {
            guardados.forEach(({ el, estilos }) => Object.assign(el.style, estilos));
            setPdfLoading(false);
        }
    };

    return { generarPDF, pdfLoading };
}
