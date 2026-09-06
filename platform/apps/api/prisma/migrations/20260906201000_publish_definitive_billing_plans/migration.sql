INSERT INTO "Plan" (
  "id","code","name","active","monthlyPrice","currency","limits","createdAt","updatedAt"
)
VALUES
(
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'ESSENCIAL',
  'Essencial',
  true,
  99.00,
  'BRL',
  '{"whatsappNumbers":1,"teamMembers":2,"aiAttendancesPerMonth":500,"crm":"incluído","knowledgeBase":"incluída","humanHandoff":"incluída","conversationHistory":"incluído","dashboard":"básico"}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'PROFISSIONAL',
  'Profissional',
  true,
  199.00,
  'BRL',
  '{"whatsappNumbers":1,"teamMembers":5,"aiAttendancesPerMonth":2000,"crm":"incluído","knowledgeBase":"incluída","humanHandoff":"incluída","conversationHistory":"incluído","automations":"incluídas","reports":"avançados"}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'a1000000-0000-4000-8000-000000000003'::uuid,
  'ESCALA',
  'Escala',
  true,
  399.00,
  'BRL',
  '{"whatsappNumbers":1,"teamMembers":15,"aiAttendancesPerMonth":6000,"crm":"incluído","knowledgeBase":"incluída","humanHandoff":"incluída","conversationHistory":"incluído","automations":"avançadas","reports":"avançados","prioritySupport":"incluído"}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "active" = true,
  "monthlyPrice" = EXCLUDED."monthlyPrice",
  "currency" = EXCLUDED."currency",
  "limits" = EXCLUDED."limits",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Plan"
SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" NOT IN ('ESSENCIAL','PROFISSIONAL','ESCALA')
  AND "active" = true;
