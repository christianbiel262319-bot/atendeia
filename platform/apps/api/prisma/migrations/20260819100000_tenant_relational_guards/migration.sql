DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Conversation" c
    JOIN "Contact" contact ON contact."id" = c."contactId"
    WHERE c."tenantId" <> contact."tenantId"
  ) OR EXISTS (
    SELECT 1 FROM "Message" m
    JOIN "Conversation" c ON c."id" = m."conversationId"
    WHERE m."tenantId" <> c."tenantId"
  ) OR EXISTS (
    SELECT 1 FROM "Payment" p
    JOIN "Subscription" s ON s."id" = p."subscriptionId"
    WHERE p."tenantId" <> s."tenantId"
  ) OR EXISTS (
    SELECT 1 FROM "Conversation" c
    JOIN "Membership" m ON m."id" = c."assignedMembershipId"
    WHERE c."assignedMembershipId" IS NOT NULL AND c."tenantId" <> m."tenantId"
  ) THEN
    RAISE EXCEPTION 'Existem relações cruzadas entre tenants; corrija os dados antes de aplicar esta migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "Membership_tenantId_id_key" ON "Membership"("tenantId", "id");
CREATE UNIQUE INDEX "Contact_tenantId_id_key" ON "Contact"("tenantId", "id");
CREATE UNIQUE INDEX "Conversation_tenantId_id_key" ON "Conversation"("tenantId", "id");
CREATE UNIQUE INDEX "Subscription_tenantId_id_key" ON "Subscription"("tenantId", "id");

ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_contactId_fkey";
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_subscriptionId_fkey";

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_tenantId_contactId_fkey"
FOREIGN KEY ("tenantId", "contactId") REFERENCES "Contact"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_tenantId_assignedMembershipId_fkey"
FOREIGN KEY ("tenantId", "assignedMembershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Message"
ADD CONSTRAINT "Message_tenantId_conversationId_fkey"
FOREIGN KEY ("tenantId", "conversationId") REFERENCES "Conversation"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_tenantId_subscriptionId_fkey"
FOREIGN KEY ("tenantId", "subscriptionId") REFERENCES "Subscription"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
