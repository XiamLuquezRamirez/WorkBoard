import './bootstrap';
import React from 'react';
import ReactDOM from 'react-dom/client';
import DashBoard from './components/dashBoard';
import './css/employeeModal.css';
import './css/userModal.css';

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <DashBoard />
    </React.StrictMode>
);
