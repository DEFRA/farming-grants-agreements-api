import { vi } from 'vitest'

class Consumer {
  constructor(options) {
    this.options = options
    this.isRunning = false
    this.handlers = new Map()
    this.calls = []
  }

  on = vi.fn((event, handler) => {
    this.handlers.set(event, handler)
  })

  start = vi.fn(() => {
    this.isRunning = true
  })

  stop = vi.fn(() => {
    this.isRunning = false
    return Promise.resolve()
  })
}

Consumer.create = vi.fn((options) => {
  return new Consumer(options)
})

export { Consumer }
