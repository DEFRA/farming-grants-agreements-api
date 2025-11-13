import { jest } from '@jest/globals'
import { handleCreateAgreementEvent } from './create-agreement.js'
import { processMessage } from '../sqs-client.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'

jest.mock('~/src/api/agreement/helpers/create-offer.js')

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() }
    createOffer.mockResolvedValue({
      agreementNumber: 'SFI123456789'
    })
  })

  describe('processMessage', () => {
    it('should process valid SNS message', async () => {
      const mockPayload = {
        type: 'gas-backend.agreement.create',
        data: { id: '123' }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(handleCreateAgreementEvent, message, mockLogger)

      expect(createOffer).toHaveBeenCalledWith(
        'aws-message-id',
        mockPayload.data,
        mockLogger
      )
    })

    it('should handle invalid JSON in message body', async () => {
      const message = {
        Body: 'invalid json'
      }

      await expect(
        processMessage(handleCreateAgreementEvent, message, mockLogger)
      ).rejects.toThrow('Invalid message format')
    })

    it('should info log non-SyntaxError', async () => {
      const message = {
        Body: JSON.stringify({ type: 'invalid.type' })
      }

      await processMessage(handleCreateAgreementEvent, message, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS create offer event: invalid.type'
      )
    })
  })

  describe('handleEvent', () => {
    it('should create agreement for application-approved events', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.create',
        data: { id: '123', status: 'approved' }
      }

      await handleCreateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating agreement from event')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Full incoming message payload (as received):')
      )
      expect(createOffer).toHaveBeenCalledWith(
        'aws-message-id',
        mockPayload.data,
        mockLogger
      )
    })

    it('should not call info when logger does not have info method', async () => {
      const loggerWithoutInfo = { error: jest.fn() }
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.create',
        data: { id: '123', status: 'approved' }
      }

      await handleCreateAgreementEvent(
        'aws-message-id',
        mockPayload,
        loggerWithoutInfo
      )

      expect(createOffer).toHaveBeenCalled()
      expect(loggerWithoutInfo.error).not.toHaveBeenCalled()
    })

    it('should handle JSON.stringify errors gracefully', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.create',
        data: { id: '123', status: 'approved' }
      }

      // Create a circular reference to cause JSON.stringify to fail
      const circularPayload = { ...mockPayload }
      circularPayload.circular = circularPayload

      // Mock JSON.stringify to throw
      const originalStringify = JSON.stringify
      JSON.stringify = jest.fn(() => {
        throw new Error('Circular reference')
      })

      await handleCreateAgreementEvent(
        'aws-message-id',
        circularPayload,
        mockLogger
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating agreement from event')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Unable to stringify payload]')
      )
      expect(createOffer).toHaveBeenCalled()

      // Restore
      JSON.stringify = originalStringify
    })

    it('should log an info for non-application-approved events', async () => {
      const mockPayload = {
        type: 'some-other-event',
        data: { id: '123' }
      }

      await handleCreateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(createOffer).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS create offer event: some-other-event'
      )
    })

    it('should log an info for non-application-approved events with missing type', async () => {
      const mockPayload = {
        noType: 'missing.type',
        data: { id: '123' }
      }

      await handleCreateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(createOffer).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS create offer event: {"noType":"missing.type","data":{"id":"123"}}'
      )
    })

    it('should log empty messages', async () => {
      await handleCreateAgreementEvent('aws-message-id', undefined, mockLogger)

      expect(createOffer).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS create offer event: undefined'
      )
    })

    it('should handle empty data', async () => {
      const mockPayload = {
        type: 'empty data'
      }

      await handleCreateAgreementEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(createOffer).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No action required for GAS create offer event: empty data'
      )
    })
  })
})
