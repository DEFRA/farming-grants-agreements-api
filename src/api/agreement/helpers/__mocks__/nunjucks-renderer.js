const renderTemplate = jest.fn(
  (_templatePath, data) =>
    `<html><body>Test HTML with ${data.agreementNumber}</body></html>`
)

export { renderTemplate }
