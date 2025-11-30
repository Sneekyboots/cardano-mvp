import { Routes, Route, useNavigate } from 'react-router-dom'
import { WalletProvider } from './providers/WalletProvider'
import { ToastProvider } from './contexts/ToastContext'
import { Layout } from './components/Layout'
import { RealDashboard } from './pages/RealDashboard'
import { VaultDetails } from './pages/VaultDetails'
import { CreateVault } from './pages/CreateVault'
import { VaultManagement } from './pages/VaultManagement'
import { MasumiAgentPanel } from './components/MasumiAgentPanel'
import { DemoRebalance } from './components/DemoRebalance'
import { MidnightDemo } from './midnight-integration'

function App() {
  const navigate = useNavigate()

  return (
    <WalletProvider>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<RealDashboard />} />
            <Route path="/vault/:vaultId" element={<VaultDetails />} />
            <Route path="/create" element={<CreateVault />} />
            <Route path="/manage" element={<VaultManagement />} />
            <Route path="/ai-agent" element={
              <div className="container mx-auto px-4 py-8 max-w-4xl">
                <MasumiAgentPanel />
              </div>
            } />
            <Route path="/demo" element={
              <div className="container mx-auto px-4 py-8 max-w-6xl">
                <DemoRebalance 
                  isOpen={true} 
                  onClose={() => navigate('/')}
                />
              </div>
            } />
            <Route path="/midnight" element={
              <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
                <MidnightDemo />
              </div>
            } />
          </Routes>
        </Layout>
      </ToastProvider>
    </WalletProvider>
  )
}

export default App