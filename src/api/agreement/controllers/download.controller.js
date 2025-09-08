import Boom from '@hapi/boom'
import { config } from '~/src/config/index.js'
import { getPdfStream } from '~/src/api/common/helpers/s3-client.js'

export const downloadController = async (request, h) => {
  const { agreementId, version } = request.params

  const bucket = config.get('files.s3.bucket')
  if (!bucket) {
    request.logger?.warn('FILES_S3_BUCKET not set - returning 503')
    throw Boom.serverUnavailable('Agreement PDF bucket not configured')
  }

  const prefix = config.get('files.s3.prefix')
  const filename = `${agreementId}-${version}.pdf`
  const key = [prefix, agreementId, version, filename].filter(Boolean).join('/')

  try {
    request.logger?.info(
      { agreementId, version, key, bucket },
      'Attempting agreement PDF download'
    )

    const stream = await getPdfStream({ bucket, key })

    if (!stream) {
      request.logger?.info(
        { agreementId, version, key },
        'Agreement PDF not found in S3'
      )
      throw Boom.notFound('Agreement PDF not found')
    }

    return h
      .response(stream)
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
  } catch (err) {
    if (err.isBoom) {
      throw err
    }

    request.logger?.error(
      { err, agreementId, version, key, bucket },
      'Error retrieving agreement PDF from S3'
    )
    throw Boom.badImplementation('Error retrieving agreement PDF')
  }
}
