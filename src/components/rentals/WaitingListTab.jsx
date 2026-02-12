import { PencilIcon, Trash2Icon, ArrowRightCircle } from 'lucide-react'

const WaitingListTab = ({ waitingList, onEdit, onDelete, onConvert }) => {
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

  if (waitingList.length === 0) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        <div className="text-center text-gray-500">
          No waiting list entries. Add one when a customer wants dates that are fully booked.
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Desired Dates
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Added
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {waitingList.map((entry) => {
              const sizeInfo = getSizeLabel(entry.sizePreference)
              const startDate = new Date(entry.startDate)
              const endDate = new Date(entry.endDate)
              const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))

              return (
                <tr key={entry.id}>
                  <td className="px-4 py-4 text-sm">
                    <div className="font-medium text-gray-900">{entry.customerName}</div>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <div className="text-xs text-gray-900">
                      {entry.whatsappCountryCode} {entry.whatsappNumber}
                    </div>
                    <div className="text-xs text-gray-500">WhatsApp</div>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <div>{startDate.toLocaleDateString()}</div>
                    <div>{endDate.toLocaleDateString()}</div>
                    <div className="text-xs text-blue-600 font-medium mt-1">
                      {days} day{days !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${sizeInfo.className}`}>
                      {sizeInfo.text}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {entry.notes || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => onEdit(entry)}
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => onDelete(entry)}
                        title="Delete"
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                      <button
                        className="text-green-600 hover:text-green-900 text-xs px-2 py-1 border border-green-300 rounded flex items-center"
                        onClick={() => onConvert(entry)}
                        title="Convert to Rental"
                      >
                        <ArrowRightCircle className="h-3 w-3 mr-1" />
                        Create Reservation
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {waitingList.map((entry) => {
          const sizeInfo = getSizeLabel(entry.sizePreference)
          const startDate = new Date(entry.startDate)
          const endDate = new Date(entry.endDate)
          const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))

          return (
            <div key={entry.id} className="bg-white shadow rounded-lg p-4 border-l-4 border-amber-500">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {entry.customerName}
                  </h3>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${sizeInfo.className}`}>
                  {sizeInfo.text}
                </span>
              </div>

              <div className="mb-3 pb-3 border-b border-gray-200">
                <p className="text-sm text-blue-600">
                  WhatsApp: {entry.whatsappCountryCode} {entry.whatsappNumber}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-gray-500">Start:</span>
                  <div className="font-medium">{startDate.toLocaleDateString()}</div>
                </div>
                <div>
                  <span className="text-gray-500">End:</span>
                  <div className="font-medium">{endDate.toLocaleDateString()}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Duration:</span>
                  <div className="font-medium text-blue-600">
                    {days} day{days !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {entry.notes && (
                <div className="mb-3 pb-3 border-b border-gray-200">
                  <span className="text-gray-500 text-sm">Notes:</span>
                  <p className="text-sm text-gray-700 mt-1">{entry.notes}</p>
                </div>
              )}

              <div className="text-xs text-gray-400 mb-3">
                Added: {new Date(entry.createdAt).toLocaleDateString()}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onEdit(entry)}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => onDelete(entry)}
                  className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                >
                  <Trash2Icon className="h-4 w-4 mr-1" />
                  Delete
                </button>
                <button
                  onClick={() => onConvert(entry)}
                  className="inline-flex items-center px-3 py-1 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50"
                >
                  <ArrowRightCircle className="h-4 w-4 mr-1" />
                  Create Reservation
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default WaitingListTab
