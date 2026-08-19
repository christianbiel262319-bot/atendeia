import { describe, expect, it } from "vitest";
import { contactCreateSchema, contactListSchema, normalizeTags } from "../src/modules/crm/crm.schemas.js";

describe("validação do CRM", () => {
  it("normaliza telefone internacional sem adivinhar o país", () => {
    const contact = contactCreateSchema.parse({
      displayName: "Maria",
      phoneE164: "+55 (11) 99999-9999",
      tags: ["Cliente"],
    });
    expect(contact.phoneE164).toBe("+5511999999999");
  });

  it("rejeita telefone sem código internacional explícito", () => {
    expect(() => contactCreateSchema.parse({ displayName: "Maria", phoneE164: "11999999999" })).toThrow();
  });

  it("remove tags duplicadas sem alterar a escrita original", () => {
    expect(normalizeTags(["VIP", "vip", "Retorno"])).toEqual(["VIP", "Retorno"]);
  });

  it("aplica paginação segura e não inclui arquivados por padrão", () => {
    expect(contactListSchema.parse({})).toMatchObject({ limit: 24, archived: false });
    expect(() => contactListSchema.parse({ limit: 101 })).toThrow();
  });
});
