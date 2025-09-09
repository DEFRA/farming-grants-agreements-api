import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { config } from '~/src/config/index.js'
import { statusCodes } from '~/src/api/common/constants/status-codes.js'

const endpoint = config.get('files.s3.endpoint') ?? undefined

const s3Client = new S3Client({
  region: config.get('files.s3.region'),
  endpoint,
  forcePathStyle: !!endpoint // LocalStack needs this
})

export const getPdfStream = async ({ bucket, key }) => {
  try {
    const res = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    )
    return res.Body
  } catch (err) {
    if (
      err?.name === 'NoSuchKey' ||
      err?.$metadata?.httpStatusCode === statusCodes.notFound
    ) {
      return null
    }
    throw err
  }
}
