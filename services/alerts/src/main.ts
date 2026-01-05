import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.ALERTS_PORT || 3013);
  await app.listen(port, "0.0.0.0");
  console.log(`[svc-alerts] listening on :${port}`);
}
bootstrap();
