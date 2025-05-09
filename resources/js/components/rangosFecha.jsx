import { useState } from "react";

const RangosFecha = ({ startDate, setStartDate, endDate, setEndDate }) => {

    return (
        <div className="date-range">
            <label>Rango de fechas:</label>
        <input
            type="date"
            className="date-input"
            placeholder="Fecha de inicio"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
        />
        <input
                type="date"
                className="date-input"
                placeholder="Fecha de fin"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
            />
        </div>
    );
};

export default RangosFecha;
