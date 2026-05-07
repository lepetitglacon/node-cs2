import { createContext, useContext, type ReactNode } from 'react'
import axios, { type AxiosInstance } from 'axios'

interface ApiContextType {
  api: AxiosInstance
}

const ApiContext = createContext<ApiContextType | undefined>(undefined)

export const ApiProvider = ({ children }: { children: ReactNode }) => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  const api = axios.create({
    baseURL: API_URL,
  })

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  return <ApiContext.Provider value={{ api }}>{children}</ApiContext.Provider>
}

export const useApi = () => {
  const context = useContext(ApiContext)
  if (!context) {
    throw new Error('useApi must be used within ApiProvider')
  }
  return context
}
