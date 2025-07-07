const renderTemplate = jest.fn((templatePath, data) => {
  if (templatePath === 'views/accept-agreement.njk') {
    return `<html><body>Test accept agreement HTML with ${data.agreementNumber}</body></html>`
  }
  return `<html><body>Test HTML with ${data.agreementNumber}</body></html>`
})

export { renderTemplate }
