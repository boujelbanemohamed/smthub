import bcrypt from "bcryptjs"

// Données simulées partagées entre toutes les APIs
const mockApplications = [
  {
    id: 1,
    nom: "Gmail",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg",
    app_url: "https://gmail.com",
    ordre_affichage: 1
  },
  {
    id: 2,
    nom: "Google Drive",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg",
    app_url: "https://drive.google.com",
    ordre_affichage: 2
  },
  {
    id: 3,
    nom: "Microsoft Teams",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg",
    app_url: "https://teams.microsoft.com",
    ordre_affichage: 3
  },
  {
    id: 4,
    nom: "Slack",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg",
    app_url: "https://slack.com",
    ordre_affichage: 4
  }
]

const mockUsers = [
  { id: 1, nom: "Admin User", email: "admin@smt.com", role: "admin", mot_de_passe: bcrypt.hashSync("admin123", 10) },
  { id: 2, nom: "John Doe", email: "user@smt.com", role: "utilisateur", mot_de_passe: bcrypt.hashSync("user123", 10) },
  { id: 3, nom: "Jane Smith", email: "jane@smt.com", role: "utilisateur", mot_de_passe: bcrypt.hashSync("user123", 10) },
  { id: 4, nom: "Bob Wilson", email: "bob@smt.com", role: "utilisateur", mot_de_passe: bcrypt.hashSync("user123", 10) }
]

const mockUserAccess = [
  { utilisateur_id: 2, application_id: 1 }, // John Doe -> Gmail
  { utilisateur_id: 2, application_id: 2 }, // John Doe -> Google Drive
  { utilisateur_id: 3, application_id: 1 }, // Jane Smith -> Gmail
  { utilisateur_id: 3, application_id: 3 }, // Jane Smith -> Teams
  { utilisateur_id: 4, application_id: 2 }, // Bob Wilson -> Google Drive
  { utilisateur_id: 4, application_id: 4 }, // Bob Wilson -> Slack
]

// Variables partagées
let applications = [...mockApplications]
let users = [...mockUsers]
let userAccess = [...mockUserAccess]
let nextAppId = 5

// Fonctions pour accéder aux données
export function getApplications() {
  return [...applications]
}

export function getUsers() {
  return [...users]
}

export function getUserAccess() {
  return [...userAccess]
}

export function getNextAppId() {
  return nextAppId++
}

// Fonctions pour modifier les données
export function setApplications(newApplications: any[]) {
  applications = [...newApplications]
}

export function setUserAccess(newUserAccess: any[]) {
  userAccess = [...newUserAccess]
}

export function addApplication(app: any) {
  applications.push(app)
}

export function updateApplication(id: number, updates: any) {
  const index = applications.findIndex(app => app.id === id)
  if (index !== -1) {
    applications[index] = { ...applications[index], ...updates }
  }
}

export function deleteApplication(id: number) {
  applications = applications.filter(app => app.id !== id)
}

export function addUserAccess(access: any) {
  userAccess.push(access)
}

export function removeUserAccess(userId: number, appId: number) {
  userAccess = userAccess.filter(
    access => !(access.utilisateur_id === userId && access.application_id === appId)
  )
}

// Fonction pour obtenir toutes les données partagées
export function getSharedData() {
  return {
    applications,
    users,
    userAccess
  }
}
