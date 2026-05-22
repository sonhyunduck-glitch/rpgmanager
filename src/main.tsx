import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import AuthProvider from './components/auth/AuthProvider'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      {(user) => <App userId={user.id} />}
    </AuthProvider>
  </StrictMode>,
)
