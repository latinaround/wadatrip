import { Body, Controller, Get, Post, Query, Req, Res, HttpException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { getPrisma } from '@wadatrip/db';
import { requireAdmin, serviceHeaders } from '@wadatrip/common/security';
import { ListOperatorLeadsDto } from '../../../../services/operator-leads/src/dto/list-operator-leads.dto';
import { SearchOperatorLeadsDto } from '../../../../services/operator-leads/src/dto/search-operator-leads.dto';

@Controller('operator-leads')
export class OperatorLeadsController {
  private async call(req: any, res: any, operation: 'list' | 'search' | 'export', input: any) {
    res.setHeader('Cache-Control', 'no-store');
    await requireAdmin(req, getPrisma());
    if (process.env.ENABLE_OPERATOR_LEADS !== 'true') throw new ServiceUnavailableException('Operator leads is not enabled');
    if (operation === 'search' && process.env.ENABLE_OPERATOR_LEAD_SEARCH !== 'true') throw new ServiceUnavailableException('Operator acquisition search is not enabled');
    let target: URL;
    try {
      target = new URL(process.env.OPERATOR_LEADS_URL || 'http://127.0.0.1:3023');
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash || target.pathname !== '/') throw Error('Invalid internal origin');
    } catch { throw new ServiceUnavailableException('Operator leads service is not configured'); }
    const suffix = operation === 'list' ? '' : '/' + operation;
    try {
      const config = { headers: serviceHeaders(req), timeout: 15000, maxRedirects: 0, proxy: false as const, maxContentLength: 2 * 1024 * 1024, maxBodyLength: 16000,
        ...(operation === 'search' ? {} : { params: input }), ...(operation === 'export' ? { responseType: 'text' as const } : {}) };
      const result = operation === 'search'
        ? await axios.post(target.origin + '/operator-leads/search', input, config)
        : await axios.get(target.origin + '/operator-leads' + suffix, config);
      if (operation === 'export') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="operator-leads.csv"');
      }
      return result.data;
    } catch (error: any) {
      const status = error?.response?.status;
      if ([400, 401, 403, 429].includes(status)) throw new HttpException('Operator leads request was rejected', status);
      throw new ServiceUnavailableException('Operator leads is temporarily unavailable');
    }
  }
  @Get()
  list(@Req() req: any, @Res({ passthrough: true }) res: any, @Query() query: ListOperatorLeadsDto) { return this.call(req, res, 'list', query); }
  @Get('export')
  export(@Req() req: any, @Res({ passthrough: true }) res: any, @Query() query: ListOperatorLeadsDto) { return this.call(req, res, 'export', query); }
  @Post('search')
  search(@Req() req: any, @Res({ passthrough: true }) res: any, @Body() body: SearchOperatorLeadsDto) { return this.call(req, res, 'search', body); }
}
