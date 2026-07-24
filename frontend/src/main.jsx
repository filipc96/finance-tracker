import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// chart.js registration moved to utils/chartTheme.js so chart.js loads lazily
// with the first chart route instead of sitting in the entry bundle.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
