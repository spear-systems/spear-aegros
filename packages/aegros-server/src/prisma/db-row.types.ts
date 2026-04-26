/**
 * Row shapes for Prisma models (mirrors schema.prisma).
 * Used where the generated client bundle does not surface model exports (e.g. `Job`).
 */

export interface JobTableRow {
  readonly id: string;
  readonly status: string;
  readonly domainsJson: string;
  readonly policy: string;
  readonly reportJson: string | null;
  readonly currentStage: string | null;
  readonly stagesJson: string | null;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WebhookSubscriptionRow {
  readonly id: string;
  readonly url: string;
  readonly secret: string;
  readonly eventsJson: string;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}
