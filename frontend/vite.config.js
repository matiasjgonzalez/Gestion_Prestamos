import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/clientes': 'http://localhost:8000',
      '/prestamos': 'http://localhost:8000',
      '/pagos': 'http://localhost:8000',
      '/mora': 'http://localhost:8000',
    }
  }
})
