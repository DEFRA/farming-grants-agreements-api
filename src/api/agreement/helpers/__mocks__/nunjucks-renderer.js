const renderTemplate = jest.fn(
  (templatePath, data) =>
    `<html><body>Test HTML with ${data.agreementNumber}</body></html>`
)

export { renderTemplate }
