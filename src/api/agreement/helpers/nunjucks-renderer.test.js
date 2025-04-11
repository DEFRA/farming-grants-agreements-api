import { jest } from '@jest/globals'

import nunjucks from 'nunjucks'
import {
  formatCurrency,
  formatDate,
  renderTemplate
} from './nunjucks-renderer.js'

jest.mock('nunjucks', () => {
  const mockRender = jest.fn()
  const mockAddFilter = jest.fn()
  const mockDateFilter = jest.fn()
  const mockConfigure = jest.fn().mockReturnValue({
    render: mockRender,
    addFilter: mockAddFilter,
    dateFilter: mockDateFilter
  })

  return {
    configure: mockConfigure,
    __mocks: {
      render: mockRender,
      addFilter: mockAddFilter,
      dateFilter: mockDateFilter,
      configure: mockConfigure
    }
  }
})

describe('nunjucks-renderer', () => {
  const {
    render: mockRender,
    addFilter: mockAddFilter,
    dateFilter: mockDateFilter
  } = nunjucks.__mocks

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

  describe('formatDate filter', () => {
    beforeAll(() => {
      mockDateFilter.mockImplementation((name, fn) => {
        if (name === 'formatDate') {
          mockDateFilter.formatDate = fn
        }
      })

      mockDateFilter('formatDate', formatDate)
    })

    test('should format date correctly en-GB standard format', () => {
      const filter = mockDateFilter.formatDate
      expect(filter(1744360860000)).toBe('11/04/2025')
    })
  })
})
