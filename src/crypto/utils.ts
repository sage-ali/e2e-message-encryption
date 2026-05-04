export function bufferToBase64(input: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

// Returns Uint8Array<ArrayBuffer> — the concrete buffer type Web Crypto expects.
// new Uint8Array(n) always creates a regular ArrayBuffer, never a SharedArrayBuffer.
export function base64ToBuffer(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
