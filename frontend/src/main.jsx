import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n' // initialize i18next before anything renders

// chart.js registration moved to utils/chartTheme.js so chart.js loads lazily
// with the first chart route instead of sitting in the entry bundle.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
