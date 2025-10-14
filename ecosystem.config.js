module.exports = {
  apps: [
    {
      name: 'smt-hub',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/smt-hub',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      env_file: '.env.production',
      error_file: '/var/log/smt-hub/error.log',
      out_file: '/var/log/smt-hub/out.log',
      log_file: '/var/log/smt-hub/combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      // Configuration pour le monitoring
      pmx: true,
      // Configuration pour les logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Configuration pour les performances
      node_args: '--max-old-space-size=1024',
    },
  ],
} 