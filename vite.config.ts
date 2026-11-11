import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
export default defineConfig({ plugins: [react()], base: './', build: { rollupOptions: { input: { main: path.resolve('index.html'), widget: path.resolve('desktop-studio.html') } } }, server: { host: '127.0.0.1', port: 5173, strictPort: true } })
