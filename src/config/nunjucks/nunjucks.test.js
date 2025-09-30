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
    expect(typeof nunjucksEnvironment.getGlobal('govukRebrand')).toBe('boolean')
    expect(typeof nunjucksEnvironment.getGlobal('gaTrackingId')).toBe('string')
  })

  test('getAssetPath should return joined path with fallback', () => {
    const getAssetPath = nunjucksEnvironment.getGlobal('getAssetPath')
    const result = getAssetPath('/base', 'my-asset.js')
    expect(result).toContain('/base')
    expect(result).toContain('my-asset.js')
  })

  test('buildUrl should join paths correctly', () => {
    const buildUrl = nunjucksEnvironment.getGlobal('buildUrl')
    expect(buildUrl('/a', 'b', 'c')).toBe('/a/b/c')
  })

  test('govukRebrand global should be true', () => {
    expect(nunjucksEnvironment.getGlobal('govukRebrand')).toBe(true)
  })

  test('gaTrackingId should default to an empty string when not configured', () => {
    const gaTrackingId = nunjucksEnvironment.getGlobal('gaTrackingId')
    expect(typeof gaTrackingId).toBe('string')
    expect(gaTrackingId).toBe('')
  })
})
