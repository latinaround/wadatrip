import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get } from "@nestjs/common";

@Controller()
class HealthController {
  @Get("health")
  getHealth() {
    return { status: "ok" };
  }
}

@Module({
  controllers: [HealthController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.ALERTS_PORT || process.env.PORT || 3013);
  await app.listen(port, "0.0.0.0");
  console.log(`[alerts] listening on :${port}`);
}

bootstrap();
