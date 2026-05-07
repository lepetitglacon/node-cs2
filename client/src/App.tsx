import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GamesList } from '@/components/GamesList'
import { GameDetail } from '@/components/GameDetail'
import { LoginRegister } from '@/pages/LoginRegister'
import { SocketProvider } from '@/contexts/SocketContext'
import { ApiProvider } from '@/contexts/ApiContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/contexts/AuthContext'

const queryClient = new QueryClient()

const AppRoutes = () => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginRegister />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GamesList />} />
        <Route path="/game/:id" element={<GameDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <AuthProvider>
          <SocketProvider>
            <AppRoutes />
          </SocketProvider>
        </AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
}

export default App
