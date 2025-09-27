import { jest } from '@jest/globals'
import { handleEvent, processMessage } from './sqs-message-processor.js'
import { createOffer } from '~/src/api/agreement/helpers/create-offer.js'
import { config } from '~/src/config/index.js'

jest.mock('~/src/api/agreement/helpers/create-offer.js')
jest.mock('~/src/config/index.js')

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = { info: jest.fn(), error: jest.fn() }
    createOffer.mockResolvedValue({
      agreementNumber: 'SFI123456789'
    })

    // Mock config values
    config.get = jest.fn((key) => {
      const configValues = {
        'files.s3.bucket': 'test-bucket',
        'files.s3.region': 'eu-west-2'
      }
      return configValues[key]
    })
  })

  describe('processMessage', () => {
    it('should process valid SNS message for application.approved', async () => {
      const mockPayload = {
        type: 'gas-backend.agreement.create',
        data: { id: '123' }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(message, mockLogger)

      expect(createOffer).toHaveBeenCalledWith(
        'aws-message-id',
        mockPayload.data,
        mockLogger
      )
    })

    it('should process valid SNS message for agreement.status.updated', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          status: 'accepted',
          agreementNumber: 'SFI123456789',
          agreementUrl: 'http://localhost:3555/SFI123456789'
        }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(message, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing agreement status update: aws-message-id'
      )
      expect(createOffer).not.toHaveBeenCalled()
    })

    it('should handle invalid JSON in message body', async () => {
      const message = {
        Body: 'invalid json'
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Invalid message format'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message,
          error: expect.any(String)
        }),
        expect.stringContaining('Error processing message')
      )
    })

    it('should handle non-SyntaxError with Boom.boomify', async () => {
      const message = {
        Body: JSON.stringify({
          Message: JSON.stringify({ type: 'invalid.type' })
        })
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Error processing SQS message'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message,
          error: expect.any(String)
        }),
        expect.stringContaining('Error processing message')
      )
    })
  })

  describe('handleEvent', () => {
    it('should create agreement for application-approved events', async () => {
      const mockPayload = {
        type: 'cloud.defra.test.fg-gas-backend.agreement.create',
        data: { id: '123', status: 'approved' }
      }

      await handleEvent('aws-message-id', mockPayload, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating agreement from event')
      )
      expect(createOffer).toHaveBeenCalledWith(
        'aws-message-id',
        mockPayload.data,
        mockLogger
      )
    })

    it('should throw an error for non-application-approved events', async () => {
      const mockPayload = {
        type: 'some-other-event',
        data: { id: '123' }
      }

      await expect(
        handleEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow('Unrecognized event type')

      expect(createOffer).not.toHaveBeenCalled()
    })

    it('should handle agreement status updated events with accepted status', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          status: 'accepted',
          agreementNumber: 'SFI123456789',
          agreementUrl: 'http://localhost:3555/SFI123456789'
        }
      }

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing agreement status update: aws-message-id'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'PDF generation triggered for agreement SFI123456789'
      )
      expect(result).toEqual(mockPayload.data)
    })

    it('should ignore agreement status updated events that are not accepted', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          status: 'offered',
          agreementNumber: 'SFI123456789',
          agreementUrl: 'http://localhost:3555/SFI123456789'
        }
      }

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing agreement status update: aws-message-id'
      )
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Agreement SFI123456789 accepted')
      )
      expect(result).toEqual(mockPayload.data)
    })

    it('should ignore agreement status updated events without agreementUrl', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          status: 'accepted',
          agreementNumber: 'SFI123456789'
          // agreementUrl is missing
        }
      }

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing agreement status update: aws-message-id'
      )
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Agreement SFI123456789 accepted')
      )
      expect(result).toEqual(mockPayload.data)
    })
  })
})
