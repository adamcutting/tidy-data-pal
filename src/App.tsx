
import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import Index from '@/pages/Index'
import Jobs from '@/pages/Jobs'
import NotFound from '@/pages/NotFound'
import './App.css'

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </Router>
    </ThemeProvider>
  )
}

export default App
