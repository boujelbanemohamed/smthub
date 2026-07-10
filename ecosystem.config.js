// Configuration PM2 pour SMT HUB en production.
//
// ⚠️ IMPORTANT — mode d'exécution et persistance :
// Cette application stocke ses données dans des fichiers JSON (dossier `data/`).
// Un stockage fichier n'est PAS compatible avec plusieurs processus qui écrivent
// en parallèle (mode cluster) : cela provoquerait des corruptions de données.
// On force donc UNE SEULE instance en mode « fork ».
//
// 👉 Si (et seulement si) vous basculez sur PostgreSQL (DATABASE_URL défini),
//    vous pouvez repasser en cluster : instances: 'max', exec_mode: 'cluster'.
module.exports = {
  apps: [
    {
      name: "smt-hub",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/var/www/smt-hub",

      // Une seule instance tant que la persistance est en fichiers JSON.
      instances: 1,
      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        // Next.js écoute sur le port fourni par PORT (surchargeable par le système).
        PORT: process.env.PORT || 4000,
      },
      // Les secrets et la config sont lus depuis ce fichier (voir .env.production.example).
      env_file: ".env.production",

      error_file: "/var/log/smt-hub/error.log",
      out_file: "/var/log/smt-hub/out.log",
      log_file: "/var/log/smt-hub/combined.log",
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Redémarrage automatique en cas de crash ou de fuite mémoire.
      max_memory_restart: "1G",
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",
      node_args: "--max-old-space-size=1024",
    },
  ],
}
