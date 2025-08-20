import { nunjucksEnvironment } from './nunjucks.js'

describe('nunjucks environment', () => {
  test('should register globals and filters', () => {
    expect(typeof nunjucksEnvironment.getFilter('formatDate')).toBe('function')
    expect(typeof nunjucksEnvironment.getFilter('formatCurrency')).toBe(
      'function'
    )
    expect(typeof nunjucksEnvironment.getGlobal('getAssetPath')).toBe(
      'function'
    )
    expect(typeof nunjucksEnvironment.getGlobal('buildUrl')).toBe('function')
  })
})
