import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own long-lived chunks so they
        // cache independently of app code. chart.js only ships in the "charts"
        // chunk, which is pulled in by the lazy chart pages — never the entry.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('chart.js') || id.includes('react-chartjs-2'))
            return 'charts'
          if (id.includes('react-datepicker') || id.includes('date-fns'))
            return 'datepicker'
          if (id.includes('@fortawesome')) return 'icons'
          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('/react/') ||
            id.includes('scheduler')
          )
            return 'react-vendor'
        },
      },
    },
  },
})
