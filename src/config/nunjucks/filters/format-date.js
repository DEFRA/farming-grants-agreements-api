import { format, isDate, parseISO } from 'date-fns'

/**
 * @param {string | Date} value
 * @param {string} formattedDateStr
 */
export function formatDate(value, formattedDateStr = 'EEE do MMMM yyyy') {
  if (!value) {
    return ''
  }

  try {
    const date = isDate(value) ? value : parseISO(String(value))
    return format(date, formattedDateStr)
  } catch {
    return ''
  }
}
