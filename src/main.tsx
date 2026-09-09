import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/dm-mono/300.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
