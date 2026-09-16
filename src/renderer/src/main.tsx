import './theme.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.js'
import { FloatingDeskPet } from './components/FloatingDeskPet.js'
import { ErrorBoundary } from './components/ErrorBoundary.js'
import './index.css'

const isFloatingPet =
  typeof window !== 'undefined' &&
  (window.location.hash.includes('pet-floating') ||
    window.location.search.includes('view=pet-floating'))

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        {isFloatingPet ? <FloatingDeskPet /> : <App />}
      </ErrorBoundary>
    </React.StrictMode>
  )
}
