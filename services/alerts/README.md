# Alerts Service

Alerts microservice built with NestJS. It manages alert subscriptions, schedules pricing checks, and publishes notifications.

## Local development

```bash
pnpm install
pnpm build
PORT=3000 pnpm start
```

Set `PRICING_URL`, `DATABASE_URL`, and `REDIS_URL` before starting if the service needs to reach external systems.

## Docker

From the repository root:

```bash
docker build -f wadatrip-platform/services/alerts/Dockerfile -t wadatrip-alerts .
docker run -p 3000:3000 --env PORT=3000 wadatrip-alerts
```

## Deploy to Render (git push flow)

1. Stage and push the deployment files to the branch tracked by Render:
   ```bash
   git add wadatrip-platform/services/alerts
   git commit -m "chore(alerts): add Render deployment files"
   git push origin main
   ```
2. In the Render dashboard create a new **Web Service** and connect it to the repository/branch you just pushed.
3. Under **Advanced** set the root directory to `wadatrip-platform/services/alerts`.
4. Configure the build and start commands:
   - Build command: `pnpm install && pnpm build`
   - Start command: `pnpm start`
5. Choose **Runtime: Node** and specify **Node Version: 20**.
6. Add environment variables:
   - `ALERTS_PORT=3000` (Render also injects `PORT` automatically.)
   - Any secrets the service needs, such as `PRICING_URL`, `DATABASE_URL`, or `REDIS_URL`.
7. Click **Create Web Service**. Every future `git push` to the tracked branch will trigger a deployment.

### Blueprint option

You can launch the same configuration with the bundled blueprint (requires the Render CLI):

```bash
render blueprint launch wadatrip-platform/services/alerts/render.yaml
```

This approach keeps the Render configuration in version control alongside the service.
