import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { config } from '#~/config/index.js'
import { statusCodes } from '#~/api/common/constants/status-codes.js'

const s3Client = new S3Client(
  process.env.NODE_ENV === 'development'
    ? {
        region: config.get('files.s3.region'),
        endpoint: config.get('files.s3.endpoint'),
        credentials: {
          accessKeyId: config.get('aws.accessKeyId'),
          secretAccessKey: config.get('aws.secretAccessKey')
        },
        forcePathStyle: true
      }
    : // Production will automatically use the default credentials
      {}
)

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
