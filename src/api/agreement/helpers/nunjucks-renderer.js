import { existsSync, readFileSync } from 'node:fs'
import { nunjucksEnvironment } from '~/src/config/nunjucks/nunjucks.js'

export { formatCurrency } from '~/src/config/nunjucks/filters/format-currency.js'
export { formatDate } from '~/src/config/nunjucks/filters/format-date.js'

/**
 * Renders a template with the given data
 * @param {string} templatePath - The path to the template file
 * @param {object} data - The data to render the template with
 * @returns {string} The rendered HTML
 */
function renderTemplate(templatePath, data) {
  return nunjucksEnvironment.render(templatePath, {
    ...data,
    gitHash: existsSync('.git-commit')
      ? readFileSync('.git-commit', 'utf-8').trim()
      : 'dev'
  })
}

export { renderTemplate }
