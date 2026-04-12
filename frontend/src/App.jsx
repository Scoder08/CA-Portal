import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import InvoiceGenerator from './pages/InvoiceGenerator'
import InvoiceHistory from './pages/InvoiceHistory'
import TaxCalculator from './pages/TaxCalculator'
import AdminPanel from './pages/AdminPanel'
import Navbar from './components/Navbar'
import ChatWidget from './components/ChatWidget'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('ca_token')
  return token ? children : <Navigate to="/login" replace />
}

// Evaluated fresh on every route render — avoids stale isLoggedIn from App closure
function HomeRoute() {
  const token = localStorage.getItem('ca_token')
  return token ? (
    <>
      <Navbar />
      <Dashboard />
    </>
  ) : (
    <Landing />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "'DM Sans', sans-serif",
            background: '#1e1a14',
            color: '#f5f4f0',
            border: '1px solid #332d23',
            borderRadius: '6px',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#e8b84b', secondary: '#1e1a14' } },
          error:   { iconTheme: { primary: '#e05c5c', secondary: '#fff' } },
        }}
      />
      <ChatWidget />
      <Routes>
        <Route path="/" element={<HomeRoute />} />

        <Route path="/login" element={<Login />} />

        <Route path="/invoices" element={
          <PrivateRoute>
            <Navbar />
            <InvoiceGenerator />
          </PrivateRoute>
        } />
        <Route path="/history" element={
          <PrivateRoute>
            <Navbar />
            <InvoiceHistory />
          </PrivateRoute>
        } />
        <Route path="/tax" element={
          <PrivateRoute>
            <Navbar />
            <TaxCalculator />
          </PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute>
            <Navbar />
            <AdminPanel />
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
