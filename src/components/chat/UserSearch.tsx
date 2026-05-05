import type React from 'react'
import { useState, useEffect } from 'react'
import { searchUsers } from '../../api/users.ts'
import type { UserSearchResult } from '../../types/index.ts'
import useChatStore from '../../store/chatStore.ts'

export default function UserSearch(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const { setActiveConversation, upsertConversation } = useChatStore()

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setSearching(true)
        const result = await searchUsers(query)
        if (result.ok) {
          setResults(result.data)
        }
        setSearching(false)
      } else {
        setResults([])
      }
    }, 300)

    return () => {
      clearTimeout(delayDebounceFn)
    }
  }, [query])

  const handleSelectUser = (user: UserSearchResult): void => {
    upsertConversation(user.id, user.username, user.display_name)
    setActiveConversation(user.id)
    setQuery('')
    setResults([])
  }

  return (
    <div className="relative p-4 border-b border-gray-800">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          placeholder="Search users..."
          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
        />
        {searching && (
          <div className="absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute left-4 right-4 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900 shadow-xl">
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                handleSelectUser(user)
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 font-bold text-gray-300">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-100">{user.display_name}</p>
                <p className="text-xs text-gray-500">@{user.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
