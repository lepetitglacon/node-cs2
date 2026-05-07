import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GamesList } from '@/components/GamesList'
import { GameDetail } from '@/components/GameDetail'
import { SocketProvider } from '@/contexts/SocketContext'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<GamesList />} />
            <Route path="/game/:id" element={<GameDetail />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </QueryClientProvider>
  )
}

export default App
