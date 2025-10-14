import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin } from "@/lib/auth"

const ACCESS_FILE = path.join(process.cwd(), "data", "user_access.json")

interface UserAccess {
  utilisateur_id: number
  application_id: number
}

async function readUserAccess(): Promise<UserAccess[]> {
  try {
    const data = await fs.readFile(ACCESS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeUserAccess(access: UserAccess[]) {
  const dataDir = path.dirname(ACCESS_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  await fs.writeFile(ACCESS_FILE, JSON.stringify(access, null, 2))
}

export async function GET() {
  try {
    const userAccess = await readUserAccess()
    return NextResponse.json(userAccess)
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la lecture" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const { utilisateur_id, application_id, grant_access } = await request.json()

    if (!utilisateur_id || !application_id || grant_access === undefined) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
    }

    const userAccess = await readUserAccess()
    const existingIndex = userAccess.findIndex(
      (access) => access.utilisateur_id === utilisateur_id && access.application_id === application_id,
    )

    if (grant_access) {
      // Grant access
      if (existingIndex === -1) {
        userAccess.push({ utilisateur_id, application_id })
      }
    } else {
      // Revoke access
      if (existingIndex !== -1) {
        userAccess.splice(existingIndex, 1)
      }
    }

    await writeUserAccess(userAccess)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la modification" }, { status: 500 })
  }
}
