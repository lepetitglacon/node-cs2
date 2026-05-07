import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GamesList } from '@/components/GamesList'
import { GameDetail } from '@/components/GameDetail'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GamesList />} />
          <Route path="/game/:id" element={<GameDetail />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
