import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SearchOperatorLeadsDto {
  @ApiProperty({ example: 'Cusco' })
  @IsString()
  city!: string;

  @ApiProperty({ example: 'Peru' })
  @IsString()
  country!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  queries?: string[];
}
