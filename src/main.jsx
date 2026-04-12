import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import CtApp from './ct/CtApp.jsx'
import MplApp from './mpl/MplApp.jsx'
import './index.css'

const mode = new URLSearchParams(window.location.search).get('mode')
const Root = mode === 'ct-widget' ? CtApp
           : mode === 'mpl-widget' ? MplApp
           : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
