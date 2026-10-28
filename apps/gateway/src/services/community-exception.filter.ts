import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

@Catch()
export class CommunityExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      response.status(error.getStatus()).json(typeof body === 'string' ? { statusCode: error.getStatus(), message: body } : body);
      return;
    }
    // ORM exceptions can embed query arguments and public posts containing PII.
    // Do not forward them to the framework logger, response, or another logger.
    console.error(JSON.stringify({ operation: 'community_request', result: 'retryable', error_category: 'community_dependency_unavailable' }));
    response.status(503).json({ statusCode: 503, message: 'Community is unavailable. Please try again.' });
  }
}
