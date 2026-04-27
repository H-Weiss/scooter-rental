import { useState } from 'react'
import { X } from 'lucide-react'

export default function Toast({ message, actionLabel, onAction, onDismiss }) {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  const handleAction = () => {
    setIsVisible(false)
    onAction?.()
  }

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-slide-in">
      <div className="bg-amber-50 border border-amber-300 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">{message}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {actionLabel && onAction && (
              <button
                onClick={handleAction}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 px-2 py-1 rounded hover:bg-amber-100"
              >
                {actionLabel}
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="text-amber-400 hover:text-amber-600 p-1 rounded hover:bg-amber-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
