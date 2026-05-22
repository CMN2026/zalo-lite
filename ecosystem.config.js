module.exports = {
  apps: [
    {
      name: "gateway",
      cwd: "/home/ubuntu/server/zalo-lite",
      script: "npm",
      args: "run start --prefix backend/api-gateway",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "user-service",
      cwd: "/home/ubuntu/server/zalo-lite",
      script: "npm",
      args: "run start --prefix backend/services/user-service",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "chat-service",
      cwd: "/home/ubuntu/server/zalo-lite",
      script: "npm",
      args: "run start --prefix backend/services/chat-service",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "chatbot-service",
      cwd: "/home/ubuntu/server/zalo-lite",
      script: "npm",
      args: "run start --prefix backend/services/chatbot-service",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "frontend",
      cwd: "/home/ubuntu/server/zalo-lite",
      script: "npm",
      args: "run start --prefix frontend/web",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
