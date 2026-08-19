import { describe, expect, it } from "vitest";
import {
  businessHourExceptionSchema,
  companyProfileSchema,
  productPatchSchema,
} from "../src/modules/knowledge/knowledge.schemas.js";

describe("validação da base de conhecimento", () => {
  it("mantém patch parcial sem aplicar valores padrão", () => {
    expect(productPatchSchema.parse({ available: false })).toEqual({ available: false });
  });

  it("valida exceção aberta somente com intervalo completo", () => {
    expect(() => businessHourExceptionSchema.parse({
      date: "2026-12-24",
      isClosed: false,
      opensAt: null,
      closesAt: null,
    })).toThrow();
    expect(businessHourExceptionSchema.parse({
      date: "2026-12-25",
      isClosed: true,
      opensAt: null,
      closesAt: null,
    }).date).toBe("2026-12-25");
  });

  it("aceita apenas links completos no perfil da empresa", () => {
    expect(companyProfileSchema.parse({ usefulLinks: [{ label: "Site", url: "https://atendeia.example" }] }).usefulLinks).toHaveLength(1);
    expect(() => companyProfileSchema.parse({ usefulLinks: [{ label: "Site", url: "atendeia.example" }] })).toThrow();
  });
});
