import { promises as fs } from "fs"
import path from "path"

// Ordre PERSONNEL des applications par utilisateur (glisser-déposer). Stocké
// par utilisateur : { [userId]: number[] (ids d'applications, dans l'ordre) }.
const FILE = path.join(process.cwd(), "data", "user-app-order.json")

async function readAll(): Promise<Record<string, number[]>> {
  try {
    const d = JSON.parse(await fs.readFile(FILE, "utf-8"))
    return d && typeof d === "object" ? d : {}
  } catch {
    return {}
  }
}

async function writeAll(data: Record<string, number[]>): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(data, null, 2))
}

export async function getOrder(userId: number): Promise<number[]> {
  const all = await readAll()
  const arr = all[String(userId)]
  return Array.isArray(arr) ? arr.map(Number).filter((n) => !Number.isNaN(n)) : []
}

export async function setOrder(userId: number, ids: number[]): Promise<void> {
  const all = await readAll()
  all[String(userId)] = Array.from(new Set(ids.map(Number).filter((n) => !Number.isNaN(n))))
  await writeAll(all)
}

export async function clearOrder(userId: number): Promise<void> {
  const all = await readAll()
  delete all[String(userId)]
  await writeAll(all)
}
