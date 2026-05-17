import { Client } from '@colyseus/sdk'

const isProd = import.meta.env.PROD
const endpoint = isProd 
  ? `${window.location.protocol.replace('http', 'ws')}//${window.location.host}` 
  : 'ws://localhost:2567'

export const client = new Client(endpoint)
