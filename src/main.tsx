import './mobile'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'
import './glass.css'
import './refined.css'
import './readable-form.css'
import './quota-history.css'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
if ('serviceWorker' in navigator && !import.meta.env.DEV && (location.protocol === 'https:' || location.hostname === '127.0.0.1')) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
