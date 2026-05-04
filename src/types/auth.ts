export interface UserProfile {
  id: string
  username: string
  display_name: string
  public_key: string
  wrapped_private_key: string
  pbkdf2_salt: string
  created_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface AuthResponse extends AuthTokens {
  user: UserProfile
}

export interface RefreshResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  display_name: string
  password: string
  public_key: string
  wrapped_private_key: string
  pbkdf2_salt: string
}
