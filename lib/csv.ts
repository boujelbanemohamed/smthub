/**
 * Utilitaires CSV minimalistes (sans dépendance externe).
 */

function escapeField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Construit un CSV à partir d'en-têtes et de lignes d'objets. */
export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.map(escapeField).join(",")
  const body = rows.map((row) => headers.map((h) => escapeField(row[h])).join(",")).join("\n")
  return `${head}\n${body}`
}

/** Parse un CSV (gère les guillemets et les virgules échappées). Renvoie un tableau d'objets. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  const content = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  for (let i = 0; i < content.length; i++) {
    const c = content[i]
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += c
    }
  }
  // Dernière valeur / ligne
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""))
  if (nonEmpty.length === 0) return []

  const headers = nonEmpty[0].map((h) => h.trim())
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim()
    })
    return obj
  })
}
