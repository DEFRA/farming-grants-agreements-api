// Agreement acceptance functionality
function setupAgreementManager(agreementId) {
  console.log('Setting up agreement manager with ID:', agreementId)
  const acceptButton = document.getElementById('accept-agreement-button')
  const acceptMessage = document.getElementById('acceptance-message')
  
  console.log('Found elements:', { acceptButton, acceptMessage })

  function setupInitialState() {
    // Check if agreement is already signed by looking for the signature date in the page
    const allParagraphs = document.querySelectorAll('p')
    const isSigned = Array.from(allParagraphs).some(p => 
      p.textContent.includes('has been accepted by') && 
      p.textContent.includes('on')
    )
    console.log('Agreement signed status:', isSigned)
    if (isSigned) {
      updateUIAfterAcceptance()
    }
  }

  function setupEventListeners() {
    if (acceptButton) {
      console.log('Setting up click listener for accept button')
      acceptButton.addEventListener('click', handleAcceptance)
    } else {
      console.error('Accept button not found in DOM')
    }
  }

  function findCompanyName() {
    // Find all table cells
    const cells = document.querySelectorAll('td')
    // Find the "Agreement Holder:" cell
    const holderCell = Array.from(cells).find(cell => cell.textContent.trim() === 'Agreement Holder:')
    // Get the next cell which contains the company name
    return holderCell ? holderCell.nextElementSibling.textContent.trim() : ''
  }

  async function handleAcceptance() {
    console.log('Accept button clicked')
    try {
      acceptButton.disabled = true
      console.log('Making API call to accept agreement')
      const response = await fetch(`/api/agreement/${agreementId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to accept agreement')
      }

      const data = await response.json()
      console.log('Agreement accepted successfully:', data)
      
      // Update the signature text in section 9
      const sections = document.querySelectorAll('section')
      const signatureSection = Array.from(sections).find(section => 
        section.querySelector('h2')?.textContent === 'Electronic signature'
      )
      
      if (signatureSection) {
        const signatureText = signatureSection.querySelector('p')
        if (signatureText) {
          // Get the company name and username
          const company = findCompanyName()
          const username = document.querySelector('meta[name="username"]')?.content || ''
          
          // Format the date in the same way as the backend
          const now = new Date()
          const formattedDate = now.toISOString()
          
          console.log('Updating signature with:', { username, company, formattedDate })
          signatureText.textContent = `The Agreement comprising this Agreement Document, the Terms and Conditions and the Actions has been accepted by ${username} - ${company} on ${formattedDate}`
        }
      }

      updateUIAfterAcceptance()
    } catch (error) {
      console.error('Error accepting agreement:', error)
      alert('Failed to accept agreement. Please try again.')
      acceptButton.disabled = false
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
  console.log('DOM loaded, looking for agreement ID')
  const agreementId = document.getElementById('agreement-id')?.value
  if (agreementId) {
    setupAgreementManager(agreementId)
  } else {
    console.error('No agreement ID found in DOM')
  }
}) 