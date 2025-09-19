// services/provider-hub/src/dtos.ts
import { IsArray, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class CreateProviderDto {
  @IsEnum(['guide','operator'] as any)
  type!: 'guide'|'operator';

  @IsString() name!: string;
  @IsEmail() email!: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsArray()
  languages!: string[];

  @IsString() base_city!: string;
  @IsString() country_code!: string;
}

export class VerifyProviderDto {
  @IsEnum(['verified','rejected'] as any)
  status!: 'verified'|'rejected';

  @IsOptional() @IsString()
  notes?: string;
}

export class CreateListingDto {
  @IsUUID() provider_id!: string;

  @IsString() title!: string;
  @IsString() category!: string;

  @IsString() city!: string;
  @IsString() country_code!: string;

  @IsOptional() @IsInt() @Min(1)
  duration_minutes?: number;

  @IsNumber()
  @IsPositive()
  price_from!: number;

  @IsString() currency!: string;

  @IsArray()
  tags!: string[];

  @IsEnum(['draft','published'] as any)
  status!: 'draft'|'published';
}

export class SearchListingsQuery {
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsNumber() min_price?: number;
  @IsOptional() @IsNumber() max_price?: number;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) limit?: number;
}
