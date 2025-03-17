import { jest } from '@jest/globals'

import nunjucks from 'nunjucks'
import { renderTemplate } from './nunjucks-renderer.js'

jest.mock('nunjucks', () => {
  const mockRender = jest.fn()
  const mockAddFilter = jest.fn()
  const mockConfigure = jest.fn().mockReturnValue({
    render: mockRender,
    addFilter: mockAddFilter
  })

  return {
    configure: mockConfigure,
    __mocks: {
      render: mockRender,
      addFilter: mockAddFilter,
      configure: mockConfigure
    }
  }
})

describe('nunjucks-renderer', () => {
  const { render: mockRender, addFilter: mockAddFilter } = nunjucks.__mocks

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('renderTemplate', () => {
    test('should render template with provided data', () => {
      // Arrange
      const templatePath = 'test-template.njk'
      const data = { test: 'data' }
      const expectedHtml = '<div>Test HTML</div>'
      mockRender.mockReturnValue(expectedHtml)

      // Act
      const result = renderTemplate(templatePath, data)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(templatePath, data)
      expect(result).toBe(expectedHtml)
    })
  })

  describe('formatCurrency filter', () => {
    const formatCurrency = (value) => {
      const num = parseFloat(value) || 0
      return num.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    beforeAll(() => {
      mockAddFilter.mockImplementation((name, fn) => {
        if (name === 'formatCurrency') {
          mockAddFilter.formatCurrencyFilter = fn
        }
      })

      mockAddFilter('formatCurrency', formatCurrency)
    })

    test('should format number with 2 decimal places', () => {
      const filter = mockAddFilter.formatCurrencyFilter
      expect(filter(1234.5678)).toBe('1,234.57')
      expect(filter(1000)).toBe('1,000.00')
      expect(filter(0)).toBe('0.00')
    })

    test('should handle string numbers', () => {
      const filter = mockAddFilter.formatCurrencyFilter
      expect(filter('1234.5678')).toBe('1,234.57')
      expect(filter('1000')).toBe('1,000.00')
      expect(filter('0')).toBe('0.00')
    })

    test('should handle invalid input', () => {
      const filter = mockAddFilter.formatCurrencyFilter
      expect(filter('invalid')).toBe('0.00')
      expect(filter(null)).toBe('0.00')
      expect(filter(undefined)).toBe('0.00')
    })
  })
})
