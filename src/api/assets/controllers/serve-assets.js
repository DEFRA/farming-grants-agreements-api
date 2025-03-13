import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { join } from 'path'
import fs from 'fs'

// Get the directory path of the assets
const assetsPath = join(process.cwd(), 'src', 'api', 'assets', 'public')

/**
 * Controller to serve static assets like images, CSS, etc.
 * Can handle both direct files and nested paths.
 * Includes security against directory traversal and prevents directory listing.
 * @satisfies {Partial<ServerRoute>}
 */
const serveAssetsController = {
  handler: (request, h) => {
    try {
      // Get the filename or path parameter depending on which route was matched
      const pathParam = request.params.filename || request.params.param || ''

      // Create a safe path - prevent path traversal attacks
      const safePath = pathParam
        .split('/')
        .filter(
          (segment) => segment !== '..' && segment !== '.' && segment !== ''
        )
        .join('/')

      const filePath = join(assetsPath, safePath)

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return h
          .response({ message: 'Asset not found' })
          .code(statusCodes.notFound)
      }

      // Check if it's a directory
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) {
        return h
          .response({ message: 'Cannot list directory contents' })
          .code(statusCodes.forbidden)
      }

      // Read the file
      const fileContent = fs.readFileSync(filePath)

      // Determine content type based on file extension
      const ext = safePath.split('.').pop().toLowerCase()
      const contentTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        pdf: 'application/pdf',
        css: 'text/css',
        js: 'application/javascript'
      }
      const contentType = contentTypes[ext] || 'application/octet-stream'

      // Return the file
      return h.response(fileContent).type(contentType).code(statusCodes.ok)
    } catch (error) {
      request.logger.error(`Error serving asset: ${error.message}`)
      return h
        .response({ message: 'Failed to serve asset', error: error.message })
        .code(statusCodes.internalServerError)
    }
  }
}

export { serveAssetsController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
