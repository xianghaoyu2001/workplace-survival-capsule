# Workplace Survival Capsule

"职场生存舱"多智能体测评系统。项目分为 `backend` 和 `frontend`。

## 新手本地启动

本地开发已经改为 SQLite，不需要 Docker，也不需要安装 PostgreSQL。数据库只是一个本地文件：

```text
backend/prisma/dev.db
```

操作步骤：

1. 双击项目根目录的 `setup-local.bat`。
2. 等它显示 `Setup completed.`。
3. 双击 `start-dev.bat`。
4. 浏览器打开 `http://localhost:5173`。

如果聊天卡住或报错，双击 `tail-backend-log.bat` 查看后端实时日志。

`setup-local.bat` 会自动完成：

- 创建 `backend/.env`。
- 安装依赖。
- 生成 Prisma Client。
- 创建 SQLite 数据库表。
- 写入默认场景和 6 个 Agent 提示词。

## DeepSeek 配置

默认使用本地 mock Agent，不消耗 API：

```env
USE_MOCK_LLM="true"
```

拿到 DeepSeek API Key 后，修改 `backend/.env`：

```env
DEEPSEEK_API_KEY=""
USE_MOCK_LLM="false"
```

## 命令行方式

```powershell
cd D:\job_project\workplace-survival-capsule
npm run setup:local
npm run backend:dev
npm run frontend:dev
```

前端地址：`http://localhost:5173`

后端地址：`http://localhost:3000`

后端日志文件：

```text
D:\job_project\workplace-survival-capsule\backend\logs\backend.log
```

也可以访问：

```text
http://localhost:3000/debug/log-path
```

## 说明

SQLite 适合你现在本地体验和开发。以后正式部署时，再把 Prisma datasource 切回 PostgreSQL。
