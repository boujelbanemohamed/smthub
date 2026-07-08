import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, authErrorResponse } from "@/lib/auth"
import { toCsv } from "@/lib/csv"

const DATA_FILE = path.join(process.cwd(), "data", "applications.json")

// GET → CSV des applications. Le logo (image_url) est exclu s'il s'agit d'un
// data URI base64 (trop volumineux pour un CSV) ; les URL sont conservées.
export async function GET() {
  try {
    await requireAdmin()
    let apps: any[] = []
    try {
      apps = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"))
    } catch {
      apps = []
    }
    apps.sort((a, b) => a.ordre_affichage - b.ordre_affichage)

    const rows = apps.map((a) => ({
      nom: a.nom,
      app_url: a.app_url,
      image_url: typeof a.image_url === "string" && a.image_url.startsWith("data:") ? "" : a.image_url || "",
      ordre_affichage: a.ordre_affichage,
      category: a.category || "",
    }))
    const csv = toCsv(["nom", "app_url", "image_url", "ordre_affichage", "category"], rows)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="applications.csv"`,
      },
    })
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
