import type React from 'react'

interface InputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'password' | 'email'
  placeholder?: string
  error?: string | undefined
  autoComplete?: string
  disabled?: boolean
}

export default function Input({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  autoComplete,
  disabled = false,
}: InputProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-400">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className={`rounded-lg border bg-gray-800 px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
          error ? 'border-red-500' : 'border-gray-700'
        }`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
