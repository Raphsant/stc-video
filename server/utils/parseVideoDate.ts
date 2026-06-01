const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

const ENGLISH_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, oct: 10, nov: 11, dec: 12,
}

function normalizeYear(y: number): number {
  if (y < 100) return y < 50 ? 2000 + y : 1900 + y
  return y
}

function toDate(day: number, month: number, year: number): number | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  return new Date(year, month - 1, day).getTime()
}

export function parseVideoDate(name: string): number | null {
  const lower = name.toLowerCase()

  // Spanish month names: "12 octubre 2026" or "octubre 12 2026"
  for (const [month, monthNum] of Object.entries(SPANISH_MONTHS)) {
    const idx = lower.indexOf(month)
    if (idx === -1) continue

    const before = lower.slice(0, idx).match(/(\d{1,2})\s*$/)
    const after = lower.slice(idx + month.length).match(/^\s*[\s,]*(\d{2,4})/)
    if (before && after) {
      const result = toDate(parseInt(before[1]), monthNum, normalizeYear(parseInt(after[1])))
      if (result) return result
    }

    const afterParts = lower.slice(idx + month.length).match(/^\s*[\s,]*(\d{1,2})[\s,]+(\d{2,4})/)
    if (afterParts) {
      const result = toDate(parseInt(afterParts[1]), monthNum, normalizeYear(parseInt(afterParts[2])))
      if (result) return result
    }
  }

  // English month names: "oct/12/2026", "oct 12 2026", "12 oct 2026"
  for (const [month, monthNum] of Object.entries(ENGLISH_MONTHS)) {
    const sepPattern = '[/\\-\\s,]+'
    const monthDD = new RegExp(`\\b${month}\\b${sepPattern}(\\d{1,2})${sepPattern}(\\d{2,4})`, 'i')
    const m1 = lower.match(monthDD)
    if (m1) {
      const result = toDate(parseInt(m1[1]), monthNum, normalizeYear(parseInt(m1[2])))
      if (result) return result
    }

    const DDmonth = new RegExp(`(\\d{1,2})${sepPattern}\\b${month}\\b${sepPattern}(\\d{2,4})`, 'i')
    const m2 = lower.match(DDmonth)
    if (m2) {
      const result = toDate(parseInt(m2[1]), monthNum, normalizeYear(parseInt(m2[2])))
      if (result) return result
    }
  }

  // Numeric: DD/MM/YYYY or DD/MM/YY — default to DD/MM (European/Spanish convention)
  const numeric = lower.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
  if (numeric) {
    const a = parseInt(numeric[1])
    const b = parseInt(numeric[2])
    const year = normalizeYear(parseInt(numeric[3]))
    // If first > 12 it must be the day
    if (a > 12) return toDate(a, b, year)
    // If second > 12 it must be the day (MM/DD)
    if (b > 12) return toDate(b, a, year)
    // Default: DD/MM
    return toDate(a, b, year)
  }

  return null
}
