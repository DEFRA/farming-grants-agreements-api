import * as filters from './filters.js'

describe('nunjucks filters export', () => {
  test('should export formatDate and formatCurrency functions', () => {
    expect(typeof filters.formatDate).toBe('function')
    expect(typeof filters.formatCurrency).toBe('function')
  })
})
