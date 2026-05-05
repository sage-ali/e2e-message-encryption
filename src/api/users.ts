import type { Result, UserSearchResult, UserPublicKeyResponse } from '../types/index.ts'
import { get } from './client.ts'

export async function searchUsers(query: string): Promise<Result<UserSearchResult[]>> {
  const encoded = encodeURIComponent(query)
  return get<UserSearchResult[]>(`/users/search?q=${encoded}`)
}

export async function getUserPublicKey(userId: string): Promise<Result<UserPublicKeyResponse>> {
  return get<UserPublicKeyResponse>(`/users/${encodeURIComponent(userId)}/public-key`)
}
