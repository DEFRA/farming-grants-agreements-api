document.addEventListener('DOMContentLoaded', function () {
  const acceptForm = document.getElementById('acceptForm')
  if (acceptForm) {
    acceptForm.addEventListener('submit', function () {
      const button = document.getElementById('acceptButton')
      button.disabled = true
      button.textContent = 'Processing...'
    })
  }
})
