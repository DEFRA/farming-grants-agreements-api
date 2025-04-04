document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('accept-agreement-form')
  const submitButton = document.getElementById('accept-agreement-button')
  const checkBox = document.getElementById('accept-agreement-checkbox')
  const errorMessageElement = document.getElementById('accept-agreement-error')

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault()

      if (submitButton) {
        submitButton.disabled = true
        submitButton.textContent = 'Processing...'
      }

      // Make a request to the API to accept the agreement
      fetch(`/api/agreement/${form.agreementNumber.value}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to accept agreement')
          }

          return response.json()
        })
        .then((data) => {
          if (data.message === 'Agreement accepted') {
            window.location.href = `/agreement/${form.agreementNumber.value}`
          } else {
            throw new Error(data.message)
          }

          return true
        })
        .catch((error) => {
          if (submitButton) {
            submitButton.disabled = false
            submitButton.textContent = 'Accept Agreement'
          }

          errorMessageElement.innerHTML = error.message
        })
    })
  }
})
