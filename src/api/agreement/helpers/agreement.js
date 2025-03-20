// Agreement acceptance functionality
function setupAgreementManager(agreementId) {
  const acceptButton = document.getElementById('accept-agreement-button')
  const acceptMessage = document.getElementById('acceptance-message')

  function setupInitialState() {
    // Check if agreement is already signed by looking for the signature date in the page
    const allParagraphs = document.querySelectorAll('p')
    const isSigned = Array.from(allParagraphs).some(
      (p) =>
        p.textContent.includes('has been accepted by') &&
        p.textContent.includes('on')
    )
    if (isSigned) {
      updateUIAfterAcceptance()
    }
  }

  function setupEventListeners() {
    if (acceptButton) {
      acceptButton.addEventListener('click', handleAcceptance)
    }
  }

  function findCompanyName() {
    // Find all table cells
    const cells = document.querySelectorAll('td')
    // Find the "Agreement Holder:" cell
    const holderCell = Array.from(cells).find(
      (cell) => cell.textContent.trim() === 'Agreement Holder:'
    )
    // Get the next cell which contains the company name
    return holderCell ? holderCell.nextElementSibling.textContent.trim() : ''
  }

  async function handleAcceptance() {
    try {
      const username = document.querySelector('meta[name="username"]')?.content
      if (!username) {
        throw new Error('Username not found')
      }

      const response = await fetch(`/api/agreement/${agreementId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      })

      if (!response.ok) {
        throw new Error('Failed to accept agreement')
      }

      // Update UI to show accepted state
      const acceptButton = document.getElementById('accept-agreement')
      if (acceptButton) {
        acceptButton.disabled = true
        acceptButton.textContent = 'Agreement Accepted'
        acceptButton.classList.add('govuk-button--disabled')
      }

      // Update signature text in section 9
      const sections = document.querySelectorAll('.govuk-section-break')
      const signatureSection = Array.from(sections).find(
        (section) => section.textContent.trim() === 'Electronic signature'
      )

      if (signatureSection) {
        const sectionContent = signatureSection.closest(
          '.govuk-section-break'
        ).nextElementSibling
        const paragraph = sectionContent.querySelector('p')

        if (paragraph) {
          paragraph.textContent = `I, ${username}, confirm that I have read and agree to the terms and conditions of this agreement.`
        }
      }

      // Refresh the page after a short delay to ensure all updates are visible
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Error accepting agreement:', error)
      const acceptButton = document.getElementById('accept-agreement')
      if (acceptButton) {
        acceptButton.disabled = false
        acceptButton.textContent = 'Accept Agreement'
        acceptButton.classList.remove('govuk-button--disabled')
      }
    }
  }

  function updateUIAfterAcceptance() {
    if (acceptButton) {
      acceptButton.style.display = 'none'
    }
    if (acceptMessage) {
      acceptMessage.style.display = 'block'
    }
  }

  // Initialize the manager
  setupInitialState()
  setupEventListeners()
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const agreementId = document.getElementById('agreement-id')?.value
  if (agreementId) {
    setupAgreementManager(agreementId)
  }
})
