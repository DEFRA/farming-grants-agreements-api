import { vi } from 'vitest'
import { config } from '#~/config/index.js'
import { fetchWithTimeout } from './fetch.js'

vi.mock('undici', () => ({
  ProxyAgent: vi.fn()
}))

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

describe('fetch helpers', () => {
  const mockUrl = 'http://example.com'
  const mockOptions = { method: 'GET' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    fetch.resetMocks()
    fetch.mockResponse(JSON.stringify({ ok: true }))

    config.get.mockImplementation((key) => {
      if (key === 'fetchTimeout') return 5000
      if (key === 'httpProxy') return null
      return null
    })
  })

  describe('fetchWithTimeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should call fetch with the correct arguments and signal', async () => {
      await fetchWithTimeout(mockUrl, mockOptions)

      expect(fetch).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          ...mockOptions,
          signal: expect.any(AbortSignal)
        })
      )
    })

    it('should abort the request when timeout is reached', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

      // Mock fetch to hang until aborted
      fetch.mockImplementationOnce((url, options) => {
        return new Promise((resolve, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new Error('Aborted request'))
            })
          }
        })
      })

      const fetchPromise = fetchWithTimeout(mockUrl, mockOptions)

      vi.advanceTimersByTime(6000)

      await expect(fetchPromise).rejects.toThrow('Aborted request')

      expect(fetch).toHaveBeenCalled()
      expect(abortSpy).toHaveBeenCalledWith(expect.any(Error))
      expect(abortSpy.mock.calls[0][0].message).toBe(
        'Network timed out while fetching data'
      )
    })

    it('should clear the timeout on success', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

      await fetchWithTimeout(mockUrl, mockOptions)

      // Advance time past the timeout
      vi.advanceTimersByTime(6000)

      expect(fetch).toHaveBeenCalled()
      // Abort should not have been called because the timer should have been cleared
      expect(abortSpy).not.toHaveBeenCalled()
    })
  })
})
