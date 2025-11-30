import React, { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '../providers/WalletProvider'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { isConnected, address, connectWallet, disconnectWallet, isLoading, walletName } = useWallet()
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-2">
                  <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="ml-3 text-xl font-bold text-white">Yield Safe</span>
              </Link>
              
              <div className="hidden md:block ml-10">
                <div className="flex items-baseline space-x-4">
                  <Link
                    to="/"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      isActive('/') 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/create"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      isActive('/create') 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    Create Vault
                  </Link>
                  <Link
                    to="/manage"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      isActive('/manage') 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    🚨 Manage Vaults
                  </Link>
                  <Link
                    to="/ai-agent"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      isActive('/ai-agent') 
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' 
                        : 'text-gray-300 hover:text-white hover:bg-purple-700'
                    }`}
                  >
                    🤖 AI Agent
                  </Link>
                   <Link
                     to="/demo"
                     className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                       isActive('/demo')
                         ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                         : 'text-gray-300 hover:text-white hover:bg-blue-700'
                     }`}
                   >
                     🧠 AI Demo
                   </Link>
                   <Link
                     to="/midnight"
                     className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                       isActive('/midnight')
                         ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                         : 'text-gray-300 hover:text-white hover:bg-purple-700'
                     }`}
                   >
                     🌙 Midnight
                   </Link>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {isConnected && address && (
                <div className="text-sm text-gray-300">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-3">
                    {walletName}
                  </span>
                  <span className="font-medium">Connected:</span>
                  <span className="ml-2 font-mono text-blue-400">
                    {address.slice(0, 12)}...{address.slice(-8)}
                  </span>
                </div>
              )}
              
              <button
                onClick={isConnected ? disconnectWallet : connectWallet}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </div>
                ) : isConnected ? (
                  'Disconnect Eternl'
                ) : (
                  'Connect Eternl Wallet'
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {children}
        </div>
      </main>
    </div>
  )
}