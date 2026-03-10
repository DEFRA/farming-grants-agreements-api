// Shim for environments where `node:inspector/promises` is not available (e.g., Node < 20)
// Provides minimal async no-op implementations that satisfy Vitest's import needs.

export async function open() {
  // no-op in test env
}

export async function close() {
  // no-op in test env
}

// Provide a dummy Session class in case it's referenced
export class Session {
  constructor() {}
  async post() {}
  async connect() {}
  async disconnect() {}
}

export default { open, close, Session }
