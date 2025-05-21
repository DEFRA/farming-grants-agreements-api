class Consumer {
  constructor(options) {
    this.options = options
    this.isRunning = false
    this.handlers = new Map()
    this.calls = []
  }

  on = jest.fn((event, handler) => {
    this.handlers.set(event, handler)
  })

  start = jest.fn(() => {
    this.isRunning = true
  })

  stop = jest.fn(() => {
    this.isRunning = false
    return Promise.resolve()
  })
}

Consumer.create = jest.fn((options) => {
  return new Consumer(options)
})

export { Consumer }
