/* @jest-environment jsdom */
jest.mock('@defra/forms-engine-plugin/shared.js', () => ({
  initAll: jest.fn()
}))

describe('#application', () => {
  const importFreshApp = async () => {
    jest.resetModules()
    return import('./application.js')
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
    window.print = jest.fn()
  })

  test('calls initAll on all components', async () => {
    await importFreshApp()

    const { initAll } = await import('@defra/forms-engine-plugin/shared.js')
    expect(initAll).toHaveBeenCalledTimes(1)
  })

  test('does nothing when print button is absent', async () => {
    await importFreshApp()

    document.dispatchEvent(new Event('DOMContentLoaded'))

    const { initAll } = await import('@defra/forms-engine-plugin/shared.js')
    expect(initAll).toHaveBeenCalledTimes(1)
    expect(window.print).not.toHaveBeenCalled()
  })

  test('sets button type=button and calls window.print on click', async () => {
    document.body.innerHTML = `<button class="gem-c-print-link__button">Print</button>`

    await importFreshApp()
    document.dispatchEvent(new Event('DOMContentLoaded'))

    const btn = document.querySelector('.gem-c-print-link__button')
    expect(btn).not.toBeNull()
    expect(btn.type).toBe('button')

    const evt = new MouseEvent('click', { bubbles: true, cancelable: true })

    btn.dispatchEvent(evt)

    expect(window.print).toHaveBeenCalled()
  })
})
