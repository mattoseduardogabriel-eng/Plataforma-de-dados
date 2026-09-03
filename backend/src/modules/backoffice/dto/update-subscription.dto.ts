import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'] as const;

export class UpdateSubscriptionDto {
  @IsIn(SUBSCRIPTION_STATUSES)
  subscriptionStatus!: (typeof SUBSCRIPTION_STATUSES)[number];

  @IsOptional()
  @IsString()
  subscriptionPlan?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  subscriptionPriceCents?: number;

  @IsOptional()
  @IsDateString()
  nextBillingAt?: string;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;
}
