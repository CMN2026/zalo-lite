module.exports = {
  apps: [
    {
      name: "gateway",
      cwd: __dirname,
      script: "/usr/bin/npm",
      args: "run start --prefix backend/api-gateway",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "user-service",
      cwd: __dirname,
      script: "/usr/bin/npm",
      args: "run start --prefix backend/services/user-service",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "chat-service",
      cwd: __dirname,
      script: "/usr/bin/npm",
      args: "run start --prefix backend/services/chat-service",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "chatbot-service",
      cwd: __dirname,
      script: "/usr/bin/npm",
      args: "run start --prefix backend/services/chatbot-service",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "frontend",
      cwd: __dirname,
      script: "/usr/bin/npm",
      args: "run start --prefix frontend/web",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
