import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow phones and other devices on the same LAN to open the dev server.
    host: "0.0.0.0",
  },
})
