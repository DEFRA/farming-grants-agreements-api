import { createServer } from '~/src/api/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import fs from 'fs'

jest.mock('fs')

describe('serveAssetsController', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server

  // Mock file content
  const mockImageContent = Buffer.from('fake image content')

  // Mock logger for the server
  const mockLogger = {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }

  // Mock stats for directory check
  const mockFileStats = {
    isDirectory: jest.fn().mockReturnValue(false)
  }

  const mockDirStats = {
    isDirectory: jest.fn().mockReturnValue(true)
  }

  beforeAll(async () => {
    server = await createServer()
    // Add mock logger to the request object for tests
    server.ext('onRequest', (request, h) => {
      request.logger = mockLogger
      return h.continue
    })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    fs.existsSync.mockReset()
    fs.readFileSync.mockReset()
    fs.statSync.mockReset()
    mockLogger.error.mockReset()
    mockFileStats.isDirectory.mockReturnValue(false)
    mockDirStats.isDirectory.mockReturnValue(true)
  })

  // Test to ensure the serve assets route is registered
  test('Assets route should be properly registered', () => {
    // Act
    const route = server
      .table()
      .find((r) => r.path === '/assets/{param*}' && r.method === 'get')

    // Assert
    expect(route).toBeTruthy()
  })

  // Test file handling with 404
  test('Should return 404 for non-existent files', async () => {
    // Arrange
    const filename = 'does-not-exist.jpg'
    fs.existsSync.mockReturnValue(false)

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/assets/${filename}`
    })

    // Assert
    expect(response.statusCode).toBe(statusCodes.notFound)
    expect(response.result).toEqual({ message: 'Asset not found' })
  })

  // Test error handling
  test('Should handle errors during file reading', async () => {
    // Arrange
    const filename = 'error-file.jpg'
    const errorMessage = 'Error reading file'

    fs.existsSync.mockReturnValue(true)
    fs.statSync.mockReturnValue(mockFileStats)
    fs.readFileSync.mockImplementation(() => {
      throw new Error(errorMessage)
    })

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/assets/${filename}`
    })

    // Assert
    expect(response.statusCode).toBe(statusCodes.internalServerError)
    expect(response.result).toEqual({
      message: 'Failed to serve asset',
      error: errorMessage
    })
    expect(mockLogger.error).toHaveBeenCalled()
  })

  // Test serving a file from a nested directory
  test('Should serve file from nested directory correctly', async () => {
    // Arrange
    const filepath = 'images/defra-logo.png'

    fs.existsSync.mockReturnValue(true)
    fs.statSync.mockReturnValue(mockFileStats)
    fs.readFileSync.mockReturnValue(mockImageContent)

    // Act
    const { statusCode, headers, payload } = await server.inject({
      method: 'GET',
      url: `/assets/${filepath}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['content-type']).toBe('image/png')
    expect(payload).toEqual(mockImageContent.toString())
    expect(fs.existsSync).toHaveBeenCalledWith(
      expect.stringContaining(filepath)
    )
    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining(filepath)
    )
  })

  // Test for directory traversal prevention
  test('Should prevent directory traversal attacks', async () => {
    const maliciousPath = '../../../etc/passwd'

    fs.existsSync.mockReturnValue(true)
    fs.statSync.mockReturnValue(mockFileStats)
    fs.readFileSync.mockReturnValue(Buffer.from('file content'))

    const response = await server.inject({
      method: 'GET',
      url: `/assets/${maliciousPath}`
    })

    expect(response.statusCode).not.toBe(statusCodes.internalServerError)

    const allCalls = JSON.stringify([
      ...fs.existsSync.mock.calls,
      ...fs.readFileSync.mock.calls,
      ...fs.statSync.mock.calls
    ])

    expect(allCalls).not.toContain('../')
  })

  // Test for forbidding access to directories
  test('Should forbid access to directories', async () => {
    // Arrange
    const dirPath = 'images'

    fs.existsSync.mockReturnValue(true)
    fs.statSync.mockReturnValue(mockDirStats)

    // Act
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: `/assets/${dirPath}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.forbidden)
    expect(result).toEqual({ message: 'Cannot list directory contents' })
  })

  // Test for deep paths
  test('Should handle files with multiple directory levels', async () => {
    // Arrange
    const deepFilePath = 'images/subfolder/another/file.png'

    fs.existsSync.mockReturnValue(true)
    fs.statSync.mockReturnValue(mockFileStats)
    fs.readFileSync.mockReturnValue(mockImageContent)

    // Act
    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/assets/${deepFilePath}`
    })

    // Assert
    expect(statusCode).toBe(statusCodes.ok)
    expect(fs.existsSync).toHaveBeenCalledWith(
      expect.stringContaining('images/subfolder/another/file.png')
    )
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
