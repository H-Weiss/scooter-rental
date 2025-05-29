import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hardcoded admin credentials
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'benben'
}

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState(null)

  // Check if user is already logged in when app starts
  useEffect(() => {
    const checkAuth = () => {
      try {
        const storedAuth = localStorage.getItem('chapo_auth')
        const storedUser = localStorage.getItem('chapo_user')
        
        if (storedAuth === 'true' && storedUser) {
          setIsAuthenticated(true)
          setUser(JSON.parse(storedUser))
        }
      } catch (error) {
        console.error('Error checking authentication:', error)
        // Clear invalid stored data
        localStorage.removeItem('chapo_auth')
        localStorage.removeItem('chapo_user')
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (username, password) => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500))

      // Check credentials
      if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const userData = {
          id: 1,
          username: 'admin',
          name: 'Administrator',
          role: 'admin',
          loginTime: new Date().toISOString()
        }

        setIsAuthenticated(true)
        setUser(userData)
        
        // Store in localStorage
        localStorage.setItem('chapo_auth', 'true')
        localStorage.setItem('chapo_user', JSON.stringify(userData))
        
        return { success: true }
      } else {
        return { 
          success: false, 
          error: 'Invalid username or password' 
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Login failed. Please try again.' 
      }
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUser(null)
    
    // Clear localStorage
    localStorage.removeItem('chapo_auth')
    localStorage.removeItem('chapo_user')
    
  }

  const value = {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}