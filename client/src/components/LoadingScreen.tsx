import React from 'react'

export const LoadingScreen: React.FC = () => {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      color: '#0f0',
      fontSize: 24,
      fontFamily: 'monospace',
    }}>
      CHARGEMENT...
    </div>
  )
}
