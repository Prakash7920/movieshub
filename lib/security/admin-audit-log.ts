import { Prisma } from "@prisma/client";

// Pass a Prisma transaction client so audit persistence can share the
// transaction with the privileged mutation. Metadata must remain non-sensitive.
type AuditClient = Prisma.TransactionClient;

export async function writeAdminAuditEvent(
  client: AuditClient,
  input: {
    actorUserId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Prisma.InputJsonObject;
  },
): Promise<void> {
  const actor = await client.user.findUnique({
    where: { id: input.actorUserId },
    select: { email: true },
  });
  if (!actor) throw new Error("ADMIN_AUDIT_ACTOR_NOT_FOUND");

  await client.adminAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actorEmail: actor.email,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata,
    },
    select: { id: true },
  });
}
