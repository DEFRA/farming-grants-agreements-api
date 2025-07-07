const renderTemplate = jest.fn(
  (_templatePath, data) =>
    `<html><body>Test HTML with ${data.agreementNumber}</body></html>`
)

const formatCurrency = jest.fn((num) =>
  typeof num === 'number'
    ? num.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    : '0.00'
)

export { renderTemplate, formatCurrency }
