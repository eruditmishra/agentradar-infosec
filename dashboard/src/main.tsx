import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import useStore from './store/useStore'

// Clickjacking defense: Ensure the application is not framed
if (window.self !== window.top) {
  try {
    if (window.top) {
      window.top.location.href = window.self.location.href;
    }
  } catch {
    window.location.replace('about:blank');
  }
}

// Initialize auth state
useStore.getState().checkSession();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
