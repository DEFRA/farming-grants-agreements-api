const renderTemplate = jest.fn((templatePath, data) => {
  if (templatePath === 'views/unauthorized.njk') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unauthorized - ${data.serviceName || 'Service'}</title>
</head>
<body>
    <div class="govuk-width-container">
        <main class="govuk-main-wrapper" id="main-content" role="main">
            <div class="govuk-grid-row">
                <div class="govuk-grid-column-two-thirds">
                    <h1 class="govuk-heading-xl">
                        You are not authorized to access this page
                    </h1>
                    ${data.errorMessage ? `<div class="govuk-inset-text"><p class="govuk-body"><strong>Error details:</strong> ${data.errorMessage}</p></div>` : ''}
                    <p class="govuk-body">
                        Your session may have expired or you may not have the necessary permissions to view this content.
                    </p>
                    <p class="govuk-body">
                        Please check your credentials and try again.
                    </p>
                    <div class="govuk-button-group">
                        <a href="javascript:history.back()" class="govuk-button govuk-button--secondary">
                            Go back
                        </a>
                    </div>
                </div>
            </div>
        </main>
    </div>
</body>
</html>`
  }
  if (templatePath === 'views/accept-agreement.njk') {
    return `<html><body>Test accept agreement HTML with ${data.agreementNumber}</body></html>`
  }
  if (templatePath === 'views/view-offer.njk') {
    return `<html><body>Test view offer HTML with ${data.agreementNumber}</body></html>`
  }
  if (templatePath === 'views/accept-offer.njk') {
    return `<html><body>Test accept offer HTML with ${data.agreementNumber}</body></html>`
  }
  if (templatePath === 'views/offer-accepted.njk') {
    return `<html><body>Test offer accepted HTML with ${data.agreementNumber}</body></html>`
  }
  if (templatePath === 'views/sfi-agreement.njk') {
    return `<html><body>Test SFI agreement HTML with ${data.agreementNumber}</body></html>`
  }
  // Default fallback for any other templates
  return `<html><body>Test HTML with ${data.agreementNumber || 'default'}</body></html>`
})

export { renderTemplate }
