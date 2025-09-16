import { contentSecurityPolicyHandlerPlugin as plugin } from './content-security-policy-handler.js' // <-- adjust path

describe('contentSecurityPolicyHandlerPlugin', () => {
  let fakeServer
  let onPreResponse

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    onPreResponse = null
    fakeServer = {
      ext: jest.fn((event, fn) => {
        if (event === 'onPreResponse') onPreResponse = fn
      })
    }

    // Register plugin (captures onPreResponse)
    plugin.register(fakeServer)
  })

  test('registers an onPreResponse handler', () => {
    expect(fakeServer.ext).toHaveBeenCalledWith(
      'onPreResponse',
      expect.any(Function)
    )
    expect(typeof onPreResponse).toBe('function')
  })

  test('sets CSP header and nonce on a normal (non-Boom) response', async () => {
    const header = jest.fn()
    const request = {
      app: {},
      response: { isBoom: false, variety: 'plain', header }
    }
    const h = { continue: Symbol('continue') }

    const response = await onPreResponse(request, h)

    expect(header).toHaveBeenCalledWith(
      'content-security-policy',
      expect.stringMatching(
        /script-src 'self' 'strict-dynamic' 'nonce-[A-Za-z0-9+/=]+'; object-src 'none'; base-uri 'self'/
      )
    )
    expect(request.app.cspNonce).toEqual(
      expect.stringMatching(/^[A-Za-z0-9+/=]+$/)
    )
    expect(response).toBe(h.continue)
  })

  test('sets CSP header on Boom responses', async () => {
    const request = {
      app: {},
      response: { isBoom: true, output: { headers: {} } }
    }
    const h = { continue: Symbol('continue') }

    await onPreResponse(request, h)

    const csp = request.response.output.headers['content-security-policy']
    expect(csp).toMatch(
      /script-src 'self' 'strict-dynamic' 'nonce-[A-Za-z0-9+/=]+'/
    )
    expect(csp).toMatch(/object-src 'none'; base-uri 'self'/)
    expect(request.app.cspNonce).toBeDefined()
  })

  test('injects cspNonce into view context without clobbering existing context', async () => {
    const header = jest.fn()
    const request = {
      app: {},
      response: {
        isBoom: false,
        variety: 'view',
        header,
        source: { context: { existing: 'kept' } }
      }
    }
    const h = { continue: Symbol('continue') }

    await onPreResponse(request, h)

    expect(header).toHaveBeenCalledWith(
      'content-security-policy',
      expect.stringMatching(/nonce-/)
    )
    expect(request.response.source.context.cspNonce).toBeDefined()
    expect(request.response.source.context.existing).toBe('kept')
  })

  test('generates a fresh nonce per response', async () => {
    const header = jest.fn()
    const h = { continue: Symbol('continue') }

    const req1 = {
      app: {},
      response: { isBoom: false, variety: 'plain', header }
    }
    await onPreResponse(req1, h)
    const nonce1 = req1.app.cspNonce

    const req2 = {
      app: {},
      response: { isBoom: false, variety: 'plain', header }
    }
    await onPreResponse(req2, h)
    const nonce2 = req2.app.cspNonce

    expect(nonce1).toBeDefined()
    expect(nonce2).toBeDefined()
    expect(nonce1).not.toEqual(nonce2)
  })
})
