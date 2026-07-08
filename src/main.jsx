import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const manifestUrl =
      document.querySelector('link[rel="manifest"]')?.href ??
      new URL('manifest.webmanifest', window.location.href).toString()

    navigator.serviceWorker.register(new URL('sw.js', manifestUrl))
  })
}
