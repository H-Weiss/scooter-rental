import { useState, useRef, useEffect } from 'react'

export default function CategoryAutocomplete({ value, onChange, categories }) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value || '')
  const wrapperRef = useRef(null)

  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = categories.filter(cat =>
    cat.toLowerCase().includes(inputValue.toLowerCase())
  )

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    onChange(e.target.value)
    setIsOpen(true)
  }

  const handleSelect = (category) => {
    setInputValue(category)
    onChange(category)
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder="Type or select category..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(category => (
            <li
              key={category}
              onClick={() => handleSelect(category)}
              className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm"
            >
              {category}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
