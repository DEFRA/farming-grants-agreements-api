import {
  calculateFirstPaymentForParcelItem,
  calculateSubsequentPaymentForParcelItem,
  calculateFirstPaymentForAgreementLevelItem,
  calculateSubsequentPaymentForAgreementLevelItem,
  calculateTotalFirstPayment,
  calculateTotalSubsequentPayment
} from './payment-calculations.js'

describe('payment calculations', () => {
  const mockFirstPayment = {
    lineItems: [
      { parcelItemId: 1, paymentPence: 1000 },
      { parcelItemId: 2, paymentPence: 2000 },
      { agreementLevelItemId: 10, paymentPence: 5000 }
    ]
  }

  const mockSubsequentPayment = {
    lineItems: [
      { parcelItemId: 1, paymentPence: 1200 },
      { parcelItemId: 2, paymentPence: 2400 },
      { agreementLevelItemId: 10, paymentPence: 6000 }
    ]
  }

  describe('calculateFirstPaymentForParcelItem', () => {
    it('should return the payment amount for an existing parcel item', () => {
      expect(calculateFirstPaymentForParcelItem(mockFirstPayment, '1')).toBe(
        1000
      )
      expect(calculateFirstPaymentForParcelItem(mockFirstPayment, '2')).toBe(
        2000
      )
    })

    it('should return 0 for non-existing parcel item', () => {
      expect(calculateFirstPaymentForParcelItem(mockFirstPayment, '999')).toBe(
        0
      )
    })

    it('should return 0 when payment is null', () => {
      expect(calculateFirstPaymentForParcelItem(null, '1')).toBe(0)
    })

    it('should return 0 when payment is undefined', () => {
      expect(calculateFirstPaymentForParcelItem(undefined, '1')).toBe(0)
    })

    it('should return 0 when lineItems is missing', () => {
      expect(calculateFirstPaymentForParcelItem({}, '1')).toBe(0)
    })
  })

  describe('calculateSubsequentPaymentForParcelItem', () => {
    it('should return the payment amount for an existing parcel item', () => {
      expect(
        calculateSubsequentPaymentForParcelItem(mockSubsequentPayment, '1')
      ).toBe(1200)
      expect(
        calculateSubsequentPaymentForParcelItem(mockSubsequentPayment, '2')
      ).toBe(2400)
    })

    it('should return 0 for non-existing parcel item', () => {
      expect(
        calculateSubsequentPaymentForParcelItem(mockSubsequentPayment, '999')
      ).toBe(0)
    })

    it('should return 0 when payment is null', () => {
      expect(calculateSubsequentPaymentForParcelItem(null, '1')).toBe(0)
    })
  })

  describe('calculateFirstPaymentForAgreementLevelItem', () => {
    it('should return the payment amount for an existing agreement level item', () => {
      expect(
        calculateFirstPaymentForAgreementLevelItem(mockFirstPayment, '10')
      ).toBe(5000)
    })

    it('should return 0 for non-existing agreement level item', () => {
      expect(
        calculateFirstPaymentForAgreementLevelItem(mockFirstPayment, '999')
      ).toBe(0)
    })

    it('should return 0 when payment is null', () => {
      expect(calculateFirstPaymentForAgreementLevelItem(null, '10')).toBe(0)
    })
  })

  describe('calculateSubsequentPaymentForAgreementLevelItem', () => {
    it('should return the payment amount for an existing agreement level item', () => {
      expect(
        calculateSubsequentPaymentForAgreementLevelItem(
          mockSubsequentPayment,
          '10'
        )
      ).toBe(6000)
    })

    it('should return 0 for non-existing agreement level item', () => {
      expect(
        calculateSubsequentPaymentForAgreementLevelItem(
          mockSubsequentPayment,
          '999'
        )
      ).toBe(0)
    })

    it('should return 0 when payment is null', () => {
      expect(calculateSubsequentPaymentForAgreementLevelItem(null, '10')).toBe(
        0
      )
    })
  })

  describe('calculateTotalFirstPayment', () => {
    const mockPayments = [
      { firstPaymentPence: 1000 },
      { firstPaymentPence: 2000 },
      { firstPaymentPence: 1500 }
    ]

    it('should sum all first payments', () => {
      expect(calculateTotalFirstPayment(mockPayments)).toBe(4500)
    })

    it('should handle missing firstPaymentPence values', () => {
      const paymentsWithMissing = [
        { firstPaymentPence: 1000 },
        {},
        { firstPaymentPence: 2000 }
      ]
      expect(calculateTotalFirstPayment(paymentsWithMissing)).toBe(3000)
    })

    it('should handle empty array', () => {
      expect(calculateTotalFirstPayment([])).toBe(0)
    })
  })

  describe('calculateTotalSubsequentPayment', () => {
    const mockPayments = [
      { subsequentPaymentPence: 1200 },
      { subsequentPaymentPence: 2400 },
      { subsequentPaymentPence: 1800 }
    ]

    it('should sum all subsequent payments', () => {
      expect(calculateTotalSubsequentPayment(mockPayments)).toBe(5400)
    })

    it('should handle missing subsequentPaymentPence values', () => {
      const paymentsWithMissing = [
        { subsequentPaymentPence: 1200 },
        {},
        { subsequentPaymentPence: 2400 }
      ]
      expect(calculateTotalSubsequentPayment(paymentsWithMissing)).toBe(3600)
    })

    it('should handle empty array', () => {
      expect(calculateTotalSubsequentPayment([])).toBe(0)
    })
  })
})
