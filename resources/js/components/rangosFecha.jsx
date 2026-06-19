import { useState } from "react";

const RangosFecha = ({ startDate, setStartDate, endDate, setEndDate }) => {

    return (
        <>
       
        <label className="eficiencia-filtro-label">
            Desde
        <input
            type="date"
            className="eficiencia-filtro-input"
            placeholder="Fecha de inicio"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
        />
      </label>
        <label className="eficiencia-filtro-label">
            Hasta
        <input
                type="date"
                className="eficiencia-filtro-input"
                placeholder="Fecha de fin"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
            />
        </label>
       
        </>
    );
};

export default RangosFecha;
