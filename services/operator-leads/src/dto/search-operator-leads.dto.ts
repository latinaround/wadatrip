import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchOperatorLeadsDto {
  @ApiProperty({ example: 'Cusco' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'Peru' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  country!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  queries?: string[];
}
