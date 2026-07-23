import React from 'react'
import ReactDOM from 'react-dom/client'
import { Chart as ChartJS, registerables } from 'chart.js'
import App from './App.jsx'
import './index.css'

// Register every chart.js controller/element/scale once, app-wide. The typed
// react-chartjs-2 components (<Line>, <Pie>) auto-register their own
// controller, but the generic <Chart type="bar"> does not — without this the
// mixed bar/line chart on Analytics throws "bar is not a registered
// controller" and blanks the page in a production build.
ChartJS.register(...registerables)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
