import { jest } from '@jest/globals'
import nunjucks from 'nunjucks'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('sfi-agreement.njk template', () => {
  let env

  beforeEach(() => {
    env = nunjucks.configure(__dirname, {
      autoescape: true
    })

    // Add the formatCurrency filter
    env.addFilter('formatCurrency', function (number) {
      if (typeof number !== 'number') {
        number = parseFloat(number) || 0
      }
      return number.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    })
  })

  test('should show accept button and hide acceptance message when agreement is not accepted', () => {
    // Arrange
    const mockData = {
      agreementNumber: 'SFI987654321',
      agreementName: 'Test Agreement',
      company: 'Test Farm Ltd',
      signatureDate: null,
      payments: {
        activities: [],
        totalAnnualPayment: 0,
        yearlyBreakdown: {
          details: [],
          annualTotals: {
            year1: 0,
            year2: 0,
            year3: 0
          },
          totalAgreementPayment: 0
        }
      }
    }

    // Act
    const result = env.render('sfi-agreement.njk', mockData)

    // Assert
    expect(result).toContain(
      'This Agreement will be electronically signed when you click the "Accept Agreement" button below'
    )
    expect(result).toContain("button.style.display = 'block'")
    expect(result).toContain("message.style.display = 'none'")
  })

  test('should hide accept button and show acceptance message when agreement is accepted', () => {
    // Arrange
    const signatureDate = '2024-03-20T12:00:00.000Z'
    const mockData = {
      agreementNumber: 'SFI987654321',
      agreementName: 'Test Agreement',
      company: 'Test Farm Ltd',
      username: 'John Smith',
      signatureDate,
      payments: {
        activities: [],
        totalAnnualPayment: 0,
        yearlyBreakdown: {
          details: [],
          annualTotals: {
            year1: 0,
            year2: 0,
            year3: 0
          },
          totalAgreementPayment: 0
        }
      }
    }

    // Act
    const result = env.render('sfi-agreement.njk', mockData)

    // Assert
    expect(result).toContain(
      `The Agreement comprising this Agreement Document, the Terms and Conditions and the Actions has been accepted by ${mockData.username} - ${mockData.company} on ${signatureDate}`
    )
    expect(result).toContain("button.style.display = 'none'")
    expect(result).toContain("message.style.display = 'block'")
  })

  test('should handle POST request to accept endpoint correctly', () => {
    // Arrange
    const mockData = {
      agreementNumber: 'SFI987654321',
      payments: {
        activities: [],
        totalAnnualPayment: 0,
        yearlyBreakdown: {
          details: [],
          annualTotals: {
            year1: 0,
            year2: 0,
            year3: 0
          },
          totalAgreementPayment: 0
        }
      }
    }

    // Act
    const result = env.render('sfi-agreement.njk', mockData)

    // Assert
    expect(result).toContain("method: 'POST'")
    expect(result).toContain('headers: {')
    expect(result).toContain("'Content-Type': 'application/json'")
    expect(result).toContain(`fetch(\`/api/agreement/\${agreementId}/accept\``)
  })

  test('should handle errors during acceptance gracefully', () => {
    // Arrange
    const mockData = {
      agreementNumber: 'SFI987654321',
      payments: {
        activities: [],
        totalAnnualPayment: 0,
        yearlyBreakdown: {
          details: [],
          annualTotals: {
            year1: 0,
            year2: 0,
            year3: 0
          },
          totalAgreementPayment: 0
        }
      }
    }

    // Act
    const result = env.render('sfi-agreement.njk', mockData)

    // Assert
    expect(result).toContain("console.error('Error accepting agreement:'")
    expect(result).toContain(
      "alert('Failed to accept agreement. Please try again.')"
    )
    expect(result).toContain('button.disabled = false')
  })
})
