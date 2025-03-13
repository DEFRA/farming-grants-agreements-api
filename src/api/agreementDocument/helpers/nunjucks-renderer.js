import nunjucks from 'nunjucks'
import { join } from 'path'

const viewsPath = join(
  process.cwd(),
  'src',
  'api',
  'agreementDocument',
  'views'
)

const nunjucksEnv = nunjucks.configure(viewsPath, {
  autoescape: true,
  noCache: process.env.NODE_ENV !== 'production'
})

/**
 * Renders a template with the given data
 * @param {string} templatePath - The path to the template file
 * @param {object} data - The data to render the template with
 * @returns {string} The rendered HTML
 */
function renderTemplate(templatePath, data) {
  return nunjucksEnv.render(templatePath, data)
}

export { renderTemplate }
