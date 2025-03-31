const renderTemplate = jest.fn((templatePath, data) => {
  // Mock rendering logic
  return `<html><body>Test HTML with ${data.agreementNumber}</body></html>`
})

export { renderTemplate }
