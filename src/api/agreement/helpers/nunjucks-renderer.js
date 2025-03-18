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

// Add a custom currency formatter filter
nunjucksEnv.addFilter('formatCurrency', function (number) {
  if (typeof number !== 'number') {
    number = parseFloat(number) || 0
  }
  return number.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
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
