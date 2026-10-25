module.exports = {
  apps: [
    {
      name: "harborline",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "800M",
      autorestart: true,
    },
  ],
};