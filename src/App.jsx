import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'

import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Pipeline from '@/pages/Pipeline'
import Superadmin from '@/pages/Superadmin'
import Setup from '@/pages/Setup'
import Agent from '@/pages/Agent'
import Contacts from '@/pages/Contacts'
import Meetings from '@/pages/Meetings'
import Import from '@/pages/Import'
import Analytics from '@/pages/Analytics'
import ContentStudio from '@/pages/ContentStudio'
import Referrals from '@/pages/Referrals'
import LandingPages from '@/pages/LandingPages'
import Inbox from '@/pages/Inbox'
import ClientPortal from '@/pages/ClientPortal'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            borderRadius: '10px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          },
        }}
      />

      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup" element={<Setup />} />

        {/* Protected app */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/pipeline" replace />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="leads" element={<Contacts />} />
          <Route path="agent" element={<Agent />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="import" element={<Import />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="content" element={<ContentStudio />} />
          <Route path="referrals" element={<Referrals />} />
          <Route path="landing" element={<LandingPages />} />
          <Route path="inbox" element={<Inbox />} />
        </Route>

        {/* Superadmin */}
        <Route path="/superadmin" element={<Superadmin />} />

        {/* Public Portal */}
        <Route path="/portal" element={<ClientPortal />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/pipeline" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
