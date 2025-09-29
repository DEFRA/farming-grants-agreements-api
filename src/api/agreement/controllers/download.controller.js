import Boom from '@hapi/boom'
import { config } from '~/src/config/index.js'
import { getPdfStream } from '~/src/api/common/helpers/s3-client.js'

export const downloadController = async (request, h) => {
  const agreementData = request.auth.credentials?.agreementData
  const { agreementNumber: agreementId } = agreementData || {}
  const { version } = request.params

  if (!agreementId) {
    request.logger?.error(
      'No agreement data found in authenticated credentials'
    )
    throw Boom.unauthorized('No agreement data available for download')
  }

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
      `Attempting agreement PDF download: ${JSON.stringify({ agreementId, version, key, bucket })}`
    )

    const stream = await getPdfStream({ bucket, key })

    if (!stream) {
      request.logger?.error(
        `Agreement PDF not found in S3 ${JSON.stringify({ agreementId, version, key, bucket })}`
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
      err,
      `Error retrieving agreement PDF from S3 ${JSON.stringify({ agreementId, version, key, bucket })}`
    )
    throw Boom.badImplementation('Error retrieving agreement PDF')
  }
}
