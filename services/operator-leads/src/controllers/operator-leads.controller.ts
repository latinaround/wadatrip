import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ListOperatorLeadsDto } from '../dto/list-operator-leads.dto';
import { SearchOperatorLeadsDto } from '../dto/search-operator-leads.dto';
import { OperatorLeadsService } from '../services/operator-leads.service';

@ApiTags('operator-leads')
@Controller()
export class OperatorLeadsController {
  constructor(private readonly operatorLeadsService: OperatorLeadsService) {}

  @Post('operator-leads/search')
  async search(@Body() body: SearchOperatorLeadsDto) {
    return this.operatorLeadsService.search(body);
  }

  @Get('operator-leads')
  async list(@Query() query: ListOperatorLeadsDto) {
    return this.operatorLeadsService.list(query);
  }

  @Get('operator-leads/export')
  async exportCsv(@Query() query: ListOperatorLeadsDto, @Res() res: Response) {
    const csv = await this.operatorLeadsService.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="operator-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.status(200).send(csv);
  }
}
