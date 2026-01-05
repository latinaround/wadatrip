import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PRICING_PORT || 3012);
  await app.listen(port, "0.0.0.0");
  console.log(`[svc-pricing] listening on :${port}`);
}
bootstrap();
