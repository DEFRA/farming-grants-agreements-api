import sampleData from './agreements.js'
import { agreementSchema } from '~/src/api/common/models/agreements.js'

describe('Agreements Sample Data', () => {
  test.each(sampleData)(
    'should match the MongoDB agreements model schema',
    (data) => {
      expect(() => agreementSchema.strict().parse(data)).not.toThrow()
    }
  )
})
