import { initAll } from '@defra/forms-engine-plugin/shared.js'

initAll()

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.gem-c-print-link__button')
  if (!btn) {
    return
  }
  btn.type = 'button'
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    window.print()
  })
})
