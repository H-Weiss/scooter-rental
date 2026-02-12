import { XCircle, ArrowRightCircle } from 'lucide-react'

const WaitingListMatchModal = ({ matches, onConvert, onClose }) => {
  if (!matches || matches.length === 0) return null

  const getSizeLabel = (size) => {
    switch (size) {
      case 'small':
        return { text: 'Small', className: 'bg-purple-100 text-purple-800' }
      case 'large':
        return { text: 'Large', className: 'bg-indigo-100 text-indigo-800' }
      default:
        return { text: 'Any', className: 'bg-gray-100 text-gray-800' }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Waiting List Matches
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {matches.length} customer{matches.length !== 1 ? 's' : ''} on the waiting list {matches.length !== 1 ? 'match' : 'matches'} the freed-up dates.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {matches.map((entry) => {
            const sizeInfo = getSizeLabel(entry.sizePreference)
            const startDate = new Date(entry.startDate)
            const endDate = new Date(entry.endDate)
            const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))

            return (
              <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:border-amber-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-gray-900">{entry.customerName}</div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${sizeInfo.className}`}>
                    {sizeInfo.text}
                  </span>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                  <span className="ml-2 text-blue-600 font-medium">
                    ({days} day{days !== 1 ? 's' : ''})
                  </span>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  WhatsApp: {entry.whatsappCountryCode} {entry.whatsappNumber}
                </div>

                {entry.notes && (
                  <div className="text-xs text-gray-500 italic mb-3">
                    Note: {entry.notes}
                  </div>
                )}

                <button
                  onClick={() => onConvert(entry)}
                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                >
                  <ArrowRightCircle className="h-4 w-4 mr-2" />
                  Create Reservation
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

export default WaitingListMatchModal
