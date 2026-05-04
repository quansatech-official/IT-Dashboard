import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css';
import { installTelemetry } from './telemetry/telemetry'

installTelemetry({ buildTag: '2026-05-04-telemetry' })

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
