import { useState, useEffect, useMemo } from 'react'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/en-gb' // English locale
import { Plus, Eye, DollarSign, Clock, Calendar as CalendarIcon } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'
import AvailabilityChecker from './AvailabilityChecker'

// Force English locale
moment.locale('en-gb')
const localizer = momentLocalizer(moment)

// Define custom formats in English only
const customFormats = {
  dateFormat: 'DD',
  dayFormat: (date, culture, localizer) => 
    localizer.format(date, 'DD', culture),
  dayHeaderFormat: (date, culture, localizer) =>
    window.innerWidth < 768 
      ? localizer.format(date, 'ddd', culture) // Mon, Tue, etc.
      : localizer.format(date, 'dddd M/D', culture), // Monday 1/15
  dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
    window.innerWidth < 768
      ? `${localizer.format(start, 'M/D', culture)} - ${localizer.format(end, 'M/D', culture)}`
      : `${localizer.format(start, 'MMMM DD', culture)} - ${localizer.format(end, 'MMMM DD', culture)}`,
  monthHeaderFormat: (date, culture, localizer) => 
    localizer.format(date, 'MMMM YYYY', culture), // January 2025
  weekdayFormat: (date, culture, localizer) => 
    localizer.format(date, 'dddd', culture), // Monday
  timeGutterFormat: (date, culture, localizer) => 
    localizer.format(date, 'HH:mm', culture),
  eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
    `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`
}

const RentalCalendar = ({ rentals = [], scooters = [], onNewRental, onViewRental }) => {
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDayDetails, setShowDayDetails] = useState(false)

  // Debug logs להבנת המידע שמגיע
  useEffect(() => {
    console.log('=== RentalCalendar Debug ===')
    console.log('Rentals received:', rentals)
    console.log('Scooters received:', scooters)
    console.log('Rentals count:', rentals?.length || 0)
    console.log('Scooters count:', scooters?.length || 0)
    console.log('Rentals type:', Array.isArray(rentals))
    console.log('Scooters type:', Array.isArray(scooters))
  }, [rentals, scooters])

  // Guard against invalid data
  const validRentals = useMemo(() => {
    if (!Array.isArray(rentals)) {
      console.warn('Rentals is not an array:', rentals)
      return []
    }
    return rentals
  }, [rentals])

  const validScooters = useMemo(() => {
    if (!Array.isArray(scooters)) {
      console.warn('Scooters is not an array:', scooters)
      return []
    }
    return scooters
  }, [scooters])

  // Color mapping for scooters (English colors only)
  const colorMapping = {
    // English colors only
    'red': '#EF4444',
    'blue': '#3B82F6',
    'green': '#10B981',
    'yellow': '#F59E0B',
    'purple': '#8B5CF6',
    'pink': '#EC4899',
    'orange': '#F97316',
    'brown': '#A3A3A3',
    'black': '#374151',
    'white': '#6B7280',
    'gray': '#6B7280',
    'grey': '#6B7280',
    'turquoise': '#06B6D4',
    'beige': '#D4B683',
    'lime': '#84CC16',
    'cyan': '#06B6D4',
    'navy': '#1E40AF',
    'maroon': '#7C2D12',
    'gold': '#F59E0B',
    'silver': '#9CA3AF',
    'crimson': '#DC143C',
    'violet': '#7C3AED',
    'indigo': '#4F46E5',
    'teal': '#14B8A6',
    'olive': '#84CC16',
    'coral': '#FF7F50',
    'salmon': '#FA8072',
    'khaki': '#F0E68C'
  }

  // Function to get color for scooter
  const getScooterColor = (scooter) => {
    if (!scooter || !scooter.color) {
      return '#6B7280' // Default gray
    }
    
    const colorLower = scooter.color.toLowerCase().trim()
    
    // Direct search
    if (colorMapping[colorLower]) {
      return colorMapping[colorLower]
    }
    
    // Partial search - if color contains a keyword
    for (const [key, value] of Object.entries(colorMapping)) {
      if (colorLower.includes(key.toLowerCase()) || key.toLowerCase().includes(colorLower)) {
        return value
      }
    }
    
    // If no match found, generate consistent color from string
    return generateColorFromString(scooter.color)
  }

  // Function to generate consistent color from text
  const generateColorFromString = (str) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    
    // Generate brighter color for better readability
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 70%, 50%)`
  }

  // Generate colors for scooters based on their color field
  const scooterColors = useMemo(() => {
    const colorMap = {}
    if (validScooters && Array.isArray(validScooters)) {
      validScooters.forEach((scooter) => {
        colorMap[scooter.id] = getScooterColor(scooter)
      })
    }
    return colorMap
  }, [validScooters])

  // Convert rentals to calendar events
  const events = useMemo(() => {
    console.log('=== Converting rentals to events ===')
    
    if (!validRentals || validRentals.length === 0) {
      console.log('No rentals to convert')
      return []
    }

    if (!validScooters || validScooters.length === 0) {
      console.log('No scooters available')
      return []
    }

    const calendarEvents = validRentals.map(rental => {
      console.log('Processing rental:', rental)
      
      // Find matching scooter
      const scooter = validScooters.find(s => s.id === rental.scooterId)
      const baseColor = scooterColors[rental.scooterId] || '#6B7280'
      
      // Validate dates
      if (!rental.startDate || !rental.endDate) {
        console.warn('Missing dates in rental:', rental)
        return null
      }

      // Create dates - simple approach without hours
      let startDateTime, endDateTime
      
      try {
        // Simply use dates only with default hours
        const startDateOnly = rental.startDate.split('T')[0] // Take only the date
        const endDateOnly = rental.endDate.split('T')[0]     // Take only the date
        
        // Create dates with default hours (9:00 and 18:00)
        startDateTime = new Date(`${startDateOnly}T09:00:00`)
        endDateTime = new Date(`${endDateOnly}T18:00:00`)

        // Validate that dates are valid
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          console.error('Invalid dates for rental:', rental)
          return null
        }

        console.log('Created valid dates:', { 
          start: startDateTime, 
          end: endDateTime,
          startDateOnly,
          endDateOnly
        })

      } catch (error) {
        console.error('Error parsing dates for rental:', rental, error)
        return null
      }
      
      const event = {
        id: rental.id,
        title: `${rental.scooterLicense || 'Unknown'} - ${rental.customerName}`,
        start: startDateTime,
        end: endDateTime,
        allDay: false, // Not an all-day event
        resource: {
          rental,
          scooter,
          color: baseColor,
          isPaid: rental.paid || false,
          isActive: rental.status === 'active',
          startTime: rental.startTime || '09:00',
          endTime: rental.endTime || '18:00'
        }
      }

      console.log('Created event:', event)
      return event
    }).filter(event => event !== null) // Filter failed events

    console.log('Final events:', calendarEvents)
    return calendarEvents
  }, [validRentals, validScooters, scooterColors])

  // Custom event style
  const eventStyleGetter = (event) => {
    const { color, isPaid, isActive } = event.resource
    
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        opacity: isPaid ? 1 : 0.7,
        border: isPaid ? `2px solid ${color}` : `2px dashed ${color}`,
        borderRadius: '4px',
        color: 'white',
        fontSize: '12px',
        fontWeight: '500'
      }
    }
  }

  // Handle slot selection (for new rental)
  const handleSelectSlot = ({ start, end }) => {
    if (onNewRental) {
      onNewRental({ startDate: start, endDate: end })
    }
  }

  // Handle event selection (view rental)
  const handleSelectEvent = (event) => {
    if (onViewRental) {
      onViewRental(event.resource.rental)
    }
  }

  // Get rentals for selected day
  const getRentalsForDay = (date) => {
    return events.filter(event => {
      const eventStart = moment(event.start).startOf('day')
      const eventEnd = moment(event.end).startOf('day')
      const selectedDay = moment(date).startOf('day')
      
      return selectedDay.isBetween(eventStart, eventEnd, null, '[]')
    })
  }

  // Handle day click for details
  const handleDayClick = (date) => {
    const dayRentals = getRentalsForDay(date)
    if (dayRentals.length > 0) {
      setSelectedDate(date)
      setShowDayDetails(true)
    }
  }

  // Debug render
  console.log('=== Rendering Calendar ===')
  console.log('Events to display:', events.length)
  console.log('Valid Scooters available:', validScooters?.length || 0)
  console.log('Valid Rentals available:', validRentals?.length || 0)

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          Rental Calendar
        </h2>
        
        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-500 bg-blue-500 rounded"></div>
            <span>Paid</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-dashed border-blue-500 bg-blue-500 opacity-70 rounded"></div>
            <span>Unpaid</span>
          </div>
        </div>
      </div>

      {/* Quick Availability Checker */}
      <AvailabilityChecker 
        scooters={validScooters} 
        rentals={validRentals}
      />
  
      {/* Scooter Legend - mobile optimized */}
      {validScooters && validScooters.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Scooters:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {validScooters.map(scooter => (
              <div key={scooter.id} className="flex items-center space-x-2 text-xs sm:text-sm bg-gray-50 px-2 py-1 rounded-full">
                <div 
                  className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-gray-300 flex-shrink-0" 
                  style={{ backgroundColor: scooterColors[scooter.id] }}
                ></div>
                <span className="font-medium truncate">{scooter.licensePlate}</span>
                <span className="text-gray-500 truncate">({scooter.color})</span>
              </div>
            ))}
          </div>
        </div>
      )}
  
      {/* Calendar Container - עם גובה מוגדל ל-4 אירועים */}
      <div className="calendar-container" style={{ 
        height: window.innerWidth < 480 ? '500px' : window.innerWidth < 768 ? '600px' : '800px',
        maxHeight: window.innerWidth < 480 ? '550px' : window.innerWidth < 768 ? '650px' : '900px',
        overflow: 'hidden',
        marginBottom: '2rem'
      }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          eventPropGetter={eventStyleGetter}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onNavigate={(date) => console.log('Navigate to:', date)}
          selectable
          popup
          views={['month', 'week', 'day']}
          defaultView="month"
          step={60}
          showMultiDayTimes
          formats={customFormats}
          culture="en-gb"
          style={{ 
            height: '100%', 
            maxHeight: '100%',
            overflow: 'hidden'
          }}
          // שיפור תצוגת האירועים
          dayLayoutAlgorithm="no-overlap"
          // הגדרת מספר מקסימלי של אירועים לפני "show more" - 4 בדסקטופ
          max={4}
          components={{
            event: ({ event }) => (
              <div className="flex items-center justify-between text-xs overflow-hidden h-full">
                <span className="truncate flex-1 mr-1 leading-tight">{event.title}</span>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <Clock className="w-2 h-2" />
                  {event.resource.isPaid ? (
                    <DollarSign className="w-2 h-2 sm:w-3 sm:h-3 text-green-200" />
                  ) : (
                    <span className="text-red-200 text-xs">!</span>
                  )}
                </div>
              </div>
            ),
            // הוספת קומפוננט מותאם אישית ל-month
            month: {
              // שיפור תצוגת הימים
              dateHeader: ({ date, label }) => (
                <div className="rbc-date-cell">
                  <span className={`
                    ${moment(date).isSame(moment(), 'day') ? 'bg-blue-100 text-blue-800 rounded-full px-2 py-1' : ''}
                    ${moment(date).isSame(moment(), 'month') ? '' : 'text-gray-400'}
                  `}>
                    {label}
                  </span>
                </div>
              )
            }
          }}
          messages={{
            date: 'Date',
            time: 'Time',
            event: 'Event',
            allDay: 'All Day',
            week: 'Week',
            work_week: 'Work Week',
            day: 'Day',
            month: 'Month',
            previous: 'Back',
            next: 'Next',
            yesterday: 'Yesterday',
            tomorrow: 'Tomorrow',
            today: 'Today',
            agenda: 'Agenda',
            noEventsInRange: 'There are no events in this range.',
            showMore: total => `+${total} more`
          }}
        />
      </div>

      {/* Empty State */}
      {events.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No rentals to display</p>
          <p className="text-sm">Create a new rental to see it on the calendar</p>
        </div>
      )}
  
      {/* Day Details Modal */}
      {showDayDetails && selectedDate && (
        <DayDetailsModal
          date={selectedDate}
          rentals={getRentalsForDay(selectedDate)}
          onClose={() => setShowDayDetails(false)}
          onViewRental={onViewRental}
          onNewRental={onNewRental}
        />
      )}
    </div>
  )
}

// Day Details Modal Component
const DayDetailsModal = ({ date, rentals, onClose, onViewRental, onNewRental }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-lg font-medium">
            {moment(date).format('MMMM D, YYYY')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl p-1"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <span className="text-sm text-gray-600">
              {rentals.length} rental{rentals.length !== 1 ? 's' : ''} today
            </span>
            <button
              onClick={() => {
                onNewRental?.({ startDate: date })
                onClose()
              }}
              className="flex items-center justify-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Rental
            </button>
          </div>

          {rentals.map(event => {
            const { rental } = event.resource
            return (
              <div
                key={rental.id}
                className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => {
                  onViewRental?.(rental)
                  onClose()
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div 
                      className="w-4 h-4 rounded-full border border-gray-300 mt-0.5 flex-shrink-0" 
                      style={{ backgroundColor: event.resource.color }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {rental.scooterLicense}
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {rental.customerName}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {rental.startTime} - {rental.endTime}
                      </div>
                      <div className="text-xs text-gray-500">
                        {moment(rental.startDate).format('MMM D')} - {moment(rental.endDate).format('MMM D')}
                      </div>
                      {rental.whatsappNumber && (
                        <div className="text-xs text-blue-600">
                          WhatsApp: {rental.whatsappCountryCode} {rental.whatsappNumber}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    {rental.paid ? (
                      <DollarSign className="w-4 h-4 text-green-600" />
                    ) : (
                      <span className="text-xs text-red-600 font-medium">Unpaid</span>
                    )}
                    <Eye className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default RentalCalendar