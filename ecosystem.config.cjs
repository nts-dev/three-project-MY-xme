module.exports = {
  apps: [
    {
      name: "three-project-editor",
      script: "npm",
      args: "run dev",
      cwd: __dirname,
      env_file: ".env",
      env: {
        NODE_ENV: "development",
      },
      watch: false,
      autorestart: true,
      restart_delay: 1000,
      max_restarts: 10,
      log_file: "./logs/pm2.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      time: true,
    },
  ],
};
