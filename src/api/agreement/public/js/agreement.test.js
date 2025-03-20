import { jest } from '@jest/globals'
import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetchMock from 'jest-fetch-mock'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('AgreementManager', () => {
  let dom
  let document
  let window
  let AgreementManager

  beforeEach(() => {
    // Create a new DOM environment for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <input type="hidden" id="agreement-id" value="SFI123456789">
          <button id="accept-agreement-button" class="govuk-button">Accept Agreement</button>
          <div id="acceptance-message" style="display: none;">
            <p>The Agreement has been accepted</p>
          </div>
        </body>
      </html>
    `)
    document = dom.window.document
    window = dom.window

    // Reset fetch mock before each test
    fetchMock.resetMocks()
    
    // Mock document methods
    document.getElementById = jest.fn((id) => {
      const elements = {
        'agreement-id': { value: 'SFI123456789' },
        'accept-agreement-button': {
          style: { display: 'block' },
          disabled: false,
          addEventListener: jest.fn()
        },
        'acceptance-message': {
          style: { display: 'none' }
        }
      }
      return elements[id]
    })

    // Mock console and alert
    console.error = jest.fn()
    window.alert = jest.fn()

    // Import the AgreementManager class
    const scriptContent = fs.readFileSync(path.join(__dirname, 'agreement.js'), 'utf8')
    eval(scriptContent)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('should initialize with correct elements', () => {
    const manager = new AgreementManager('SFI123456789')
    expect(manager.agreementId).toBe('SFI123456789')
    expect(manager.acceptButton).toBeTruthy()
    expect(manager.acceptMessage).toBeTruthy()
  })

  test('should handle successful agreement acceptance', async () => {
    // Arrange
    fetchMock.mockResponseOnce(JSON.stringify({ success: true }))
    const button = document.getElementById('accept-agreement-button')
    const message = document.getElementById('acceptance-message')

    // Act
    const clickEvent = new Event('click')
    button.addEventListener.mock.calls[0][1](clickEvent)

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agreement/SFI123456789/accept',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    )
    expect(button.style.display).toBe('none')
    expect(message.style.display).toBe('block')
  })

  test('should handle failed agreement acceptance', async () => {
    // Arrange
    fetchMock.mockResponseOnce(JSON.stringify({ success: false }), { status: 400 })
    const button = document.getElementById('accept-agreement-button')

    // Act
    const clickEvent = new Event('click')
    button.addEventListener.mock.calls[0][1](clickEvent)

    // Assert
    expect(console.error).toHaveBeenCalledWith('Error accepting agreement:', expect.any(Error))
    expect(window.alert).toHaveBeenCalledWith('Failed to accept agreement. Please try again.')
    expect(button.disabled).toBe(false)
  })

  test('should handle network errors during acceptance', async () => {
    // Arrange
    fetchMock.mockRejectOnce(new Error('Network error'))
    const button = document.getElementById('accept-agreement-button')

    // Act
    const clickEvent = new Event('click')
    button.addEventListener.mock.calls[0][1](clickEvent)

    // Assert
    expect(console.error).toHaveBeenCalledWith('Error accepting agreement:', expect.any(Error))
    expect(window.alert).toHaveBeenCalledWith('Failed to accept agreement. Please try again.')
    expect(button.disabled).toBe(false)
  })

  test('should initialize on DOMContentLoaded', () => {
    // Arrange
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener')
    const getElementByIdSpy = jest.spyOn(document, 'getElementById')

    // Act
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded'))

    // Assert
    expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))
    expect(getElementByIdSpy).toHaveBeenCalledWith('agreement-id')
  })
}) 