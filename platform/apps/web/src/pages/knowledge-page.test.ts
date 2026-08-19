import { describe, expect, it } from "vitest";
import { tabFromSearch } from "./knowledge-page";

describe("atalhos da base de conhecimento", () => {
  it.each([
    ["produto", "products"],
    ["servico", "services"],
    ["faq", "faqs"],
  ])("abre o formulário de %s", (kind, expected) => {
    expect(tabFromSearch(new URLSearchParams({ novo: kind }))).toBe(expected);
  });

  it("ignora uma seção inválida", () => {
    expect(tabFromSearch(new URLSearchParams({ secao: "inexistente" }))).toBe("products");
  });
});
