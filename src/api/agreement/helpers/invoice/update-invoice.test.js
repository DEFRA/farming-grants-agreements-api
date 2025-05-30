import { jest } from '@jest/globals'
import Boom from '@hapi/boom'
import { updateInvoice } from './update-invoice.js'
import invoicesModel from '~/src/api/common/models/invoices.js'

// Mock dependencies
jest.mock('@hapi/boom')
jest.mock('~/src/api/common/models/invoices.js')

describe('updateInvoice', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock the updateOne method to return a promise directly
    invoicesModel.updateOne.mockImplementation(() => ({
      catch: jest.fn().mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1
      })
    }))
  })

  describe('Successful Updates', () => {
    it('should update an invoice with valid data', async () => {
      const invoiceNumber = 'FRPS0000'
      const updateData = { amount: 1000, status: 'paid' }
      const expectedResult = { acknowledged: true, modifiedCount: 1 }

      const result = await updateInvoice(invoiceNumber, updateData)

      expect(invoicesModel.updateOne).toHaveBeenCalledWith(
        { invoiceNumber: 'FRPS0000' },
        { $set: { amount: 1000, status: 'paid' } }
      )
      expect(result).toEqual(expectedResult)
    })

    it('should handle partial updates', async () => {
      const invoiceNumber = 'FRPS0000'
      const updateData = { status: 'pending' }

      await updateInvoice(invoiceNumber, updateData)

      expect(invoicesModel.updateOne).toHaveBeenCalledWith(
        { invoiceNumber: 'FRPS0000' },
        { $set: { status: 'pending' } }
      )
    })

    it('should handle empty update data', async () => {
      const invoiceNumber = 'FRPS0000'
      const updateData = {}

      await updateInvoice(invoiceNumber, updateData)

      expect(invoicesModel.updateOne).toHaveBeenCalledWith(
        { invoiceNumber: 'FRPS0000' },
        { $set: {} }
      )
    })

    it('should handle complex update data with nested objects', async () => {
      const invoiceNumber = 'FRPS0000'
      const updateData = {
        amount: 2500,
        details: {
          description: 'Updated invoice',
          items: ['item1', 'item2']
        },
        metadata: {
          updatedBy: 'user123',
          updatedAt: new Date()
        }
      }

      await updateInvoice(invoiceNumber, updateData)

      expect(invoicesModel.updateOne).toHaveBeenCalledWith(
        { invoiceNumber: 'FRPS0000' },
        { $set: updateData }
      )
    })

    it('should return result even when modifiedCount is 0', async () => {
      // Current function behavior - it doesn't check modifiedCount
      invoicesModel.updateOne.mockImplementation(() => ({
        catch: jest.fn().mockResolvedValue({
          acknowledged: true,
          modifiedCount: 0
        })
      }))

      const result = await updateInvoice('NO-MATCH', { amount: 100 })

      expect(result).toEqual({ acknowledged: true, modifiedCount: 0 })
    })
  })

  describe('Not Found Cases', () => {
    it('should throw Boom.notFound when invoice result is null', async () => {
      invoicesModel.updateOne.mockImplementation(() => ({
        catch: jest.fn().mockResolvedValue(null)
      }))
      Boom.notFound.mockReturnValue(new Error('Invoice not found'))

      await expect(
        updateInvoice('NONEXISTENT', { amount: 100 })
      ).rejects.toThrow('Invoice not found')

      expect(Boom.notFound).toHaveBeenCalledWith(
        'Invoice not found for Invoice Number NONEXISTENT'
      )
    })

    it('should throw Boom.notFound when invoice result is undefined', async () => {
      invoicesModel.updateOne.mockImplementation(() => ({
        catch: jest.fn().mockResolvedValue(undefined)
      }))
      Boom.notFound.mockReturnValue(new Error('Invoice not found'))

      await expect(updateInvoice(undefined, { amount: 100 })).rejects.toThrow(
        'Invoice not found'
      )

      expect(Boom.notFound).toHaveBeenCalledWith(
        'Invoice not found for Invoice Number undefined'
      )
    })
  })

  describe('Error Handling', () => {
    it('should throw Boom.internal when database operation fails', async () => {
      const boomError = new Error('Internal server error')

      invoicesModel.updateOne.mockImplementation(() => ({
        catch: jest.fn().mockRejectedValue(boomError)
      }))

      Boom.internal.mockReturnValue(boomError)

      await expect(updateInvoice('FRPS0000', { amount: 100 })).rejects.toThrow(
        'Internal server error'
      )
    })

    it('should handle MongoDB validation errors', async () => {
      const boomError = new Error('Internal server error')

      invoicesModel.updateOne.mockImplementation(() => ({
        catch: jest.fn().mockRejectedValue(boomError)
      }))

      Boom.internal.mockReturnValue(boomError)

      await expect(
        updateInvoice('FRPS0000', { amount: 'invalid' })
      ).rejects.toThrow('Internal server error')
    })

    it('should handle network timeout errors', async () => {
      const boomError = new Error('Internal server error')

      invoicesModel.updateOne.mockImplementation(() => ({
        catch: jest.fn().mockRejectedValue(boomError)
      }))

      Boom.internal.mockReturnValue(boomError)

      await expect(
        updateInvoice('FRPSTIMEOUT', { amount: 100 })
      ).rejects.toThrow('Internal server error')
    })
  })

  describe('Input Validation', () => {
    it('should handle special characters in invoice number', async () => {
      const invoiceNumber = 'FRPS123@#$%'
      const updateData = { amount: 500 }

      await updateInvoice(invoiceNumber, updateData)

      expect(invoicesModel.updateOne).toHaveBeenCalledWith(
        { invoiceNumber: 'FRPS123@#$%' },
        { $set: { amount: 500 } }
      )
    })

    it('should handle very long invoice numbers', async () => {
      const longInvoiceNumber = 'A'.repeat(100)
      const updateData = { status: 'processed' }

      await updateInvoice(longInvoiceNumber, updateData)

      expect(invoicesModel.updateOne).toHaveBeenCalledWith(
        { invoiceNumber: longInvoiceNumber },
        { $set: { status: 'processed' } }
      )
    })

    it('should handle null values in update data', async () => {
      const invoiceNumber = 'FRPSNULL'
      const updateData = {
        amount: null,
        description: null,
        status: 'cancelled'
      }

      await updateInvoice(invoiceNumber, updateData)

      expect(invoicesModel.updateOne).toHaveBeenCalledWith(
        { invoiceNumber: 'FRPSNULL' },
        { $set: updateData }
      )
    })
  })

  describe('Return Value Validation', () => {
    it('should return the exact result from updateOne operation', async () => {
      const expectedResult = {
        acknowledged: true,
        modifiedCount: 1,
        matchedCount: 1,
        upsertedId: null
      }

      invoicesModel.updateOne.mockImplementation(() => ({
        catch: jest.fn().mockResolvedValue(expectedResult)
      }))

      const result = await updateInvoice('FRPSRETURN', { amount: 750 })

      expect(result).toEqual(expectedResult)
    })

    it('should preserve all properties from MongoDB updateOne result', async () => {
      const mongoResult = {
        acknowledged: true,
        modifiedCount: 1,
        matchedCount: 1,
        upsertedId: null,
        upsertedCount: 0
      }

      invoicesModel.updateOne.mockImplementation(() => ({
        catch: jest.fn().mockResolvedValue(mongoResult)
      }))

      const result = await updateInvoice('FRPSPROPS', { amount: 1250 })

      expect(result).toStrictEqual(mongoResult)
      expect(Object.keys(result)).toEqual(Object.keys(mongoResult))
    })
  })
})
