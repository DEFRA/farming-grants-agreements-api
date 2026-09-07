import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { getPdfStream, checkFileExists } from './s3-client.js'
import { statusCodes } from '#~/api/common/constants/status-codes.js'

vi.mock('@aws-sdk/client-s3', () => {
  const S3Client = vi.fn()
  S3Client.prototype.send = vi.fn()
  return {
    S3Client,
    GetObjectCommand: vi.fn(),
    HeadObjectCommand: vi.fn()
  }
})

describe('s3-client helper', () => {
  const bucket = 'test-bucket'
  const key = 'test-key'
  let s3ClientInstance

  beforeEach(() => {
    vi.clearAllMocks()
    s3ClientInstance = S3Client.prototype
  })

  describe('getPdfStream', () => {
    it('should return the body stream when file exists', async () => {
      const mockStream = { pipe: vi.fn() }
      s3ClientInstance.send.mockResolvedValueOnce({ Body: mockStream })

      const result = await getPdfStream({ bucket, key })

      expect(result).toBe(mockStream)
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key
      })
      expect(s3ClientInstance.send).toHaveBeenCalledWith(
        expect.any(GetObjectCommand)
      )
    })

    it('should return null when file does not exist (NoSuchKey)', async () => {
      const error = new Error('NoSuchKey')
      error.name = 'NoSuchKey'
      s3ClientInstance.send.mockRejectedValueOnce(error)

      const result = await getPdfStream({ bucket, key })

      expect(result).toBeNull()
    })

    it('should return null when file does not exist (404 status)', async () => {
      const error = new Error('NotFound')
      error.$metadata = { httpStatusCode: statusCodes.notFound }
      s3ClientInstance.send.mockRejectedValueOnce(error)

      const result = await getPdfStream({ bucket, key })

      expect(result).toBeNull()
    })

    it('should throw error for other failures', async () => {
      const error = new Error('S3 Error')
      s3ClientInstance.send.mockRejectedValueOnce(error)

      await expect(getPdfStream({ bucket, key })).rejects.toThrow('S3 Error')
    })
  })

  describe('checkFileExists', () => {
    it('should return true when file exists', async () => {
      s3ClientInstance.send.mockResolvedValueOnce({})

      const result = await checkFileExists({ bucket, key })

      expect(result).toBe(true)
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key
      })
      expect(s3ClientInstance.send).toHaveBeenCalledWith(
        expect.any(HeadObjectCommand)
      )
    })

    it('should return false when file does not exist (NoSuchKey)', async () => {
      const error = new Error('NoSuchKey')
      error.name = 'NoSuchKey'
      s3ClientInstance.send.mockRejectedValueOnce(error)

      const result = await checkFileExists({ bucket, key })

      expect(result).toBe(false)
    })

    it('should return false when file does not exist (NotFound name)', async () => {
      const error = new Error('NotFound')
      error.name = 'NotFound'
      s3ClientInstance.send.mockRejectedValueOnce(error)

      const result = await checkFileExists({ bucket, key })

      expect(result).toBe(false)
    })

    it('should return false when file does not exist (404 status)', async () => {
      const error = new Error('NotFound')
      error.$metadata = { httpStatusCode: statusCodes.notFound }
      s3ClientInstance.send.mockRejectedValueOnce(error)

      const result = await checkFileExists({ bucket, key })

      expect(result).toBe(false)
    })

    it('should throw error for other failures', async () => {
      const error = new Error('S3 Error')
      s3ClientInstance.send.mockRejectedValueOnce(error)

      await expect(checkFileExists({ bucket, key })).rejects.toThrow('S3 Error')
    })
  })
})
