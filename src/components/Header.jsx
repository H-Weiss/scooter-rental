import { useState } from 'react'
import { LogOut, User, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.jpg'

// Logout Confirmation Dialog
function LogoutDialog({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg max-w-sm w-full">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-orange-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Confirm Logout</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Are you sure you want to log out? You will need to sign in again to access the system.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

const Header = () => {
  const { user, logout } = useAuth()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  const handleLogout = () => {
    logout()
    setShowLogoutDialog(false)
  }

  return (
    <>
      <header className="bg-white shadow">
        <div className="w-full py-4 px-4 sm:px-8">
          {/* Main Header Row */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <img 
                src={logo} 
                alt="Chapo-Samui Logo" 
                className="h-12 sm:h-20 w-auto object-contain"
              />
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-800 leading-tight">
                Chapo-Samui Scooter Rental Management
              </h1>
            </div>
            
            {/* User Info and Actions */}
            <div className="flex items-center space-x-3">
              {/* User Info */}
              {user && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <User className="h-4 w-4 text-gray-600" />
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.role}</p>
                  </div>
                  <span className="sm:hidden text-sm font-medium text-gray-900">
                    {user.name}
                  </span>
                </div>
              )}

              {/* Logout Button */}
              <button
                onClick={() => setShowLogoutDialog(true)}
                className="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Dialog */}
      <LogoutDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleLogout}
      />
    </>
  )
}

export default Header