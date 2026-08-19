import { describe, expect, it } from "vitest";
import { navigationGroups, quickCreatePermissions } from "./app-layout";

describe("navegação V2", () => {
  it("expõe somente os grupos definidos para o produto", () => {
    expect(navigationGroups(0).map((group) => group.label)).toEqual([
      "VISÃO GERAL",
      "ATENDIMENTO",
      "INTELIGÊNCIA",
      "GESTÃO",
      "SISTEMA",
    ]);
  });

  it("exibe badge apenas quando há conversas aguardando humano", () => {
    const emptyInbox = navigationGroups(0)[1]?.items[0];
    const waitingInbox = navigationGroups(7)[1]?.items[0];
    expect(emptyInbox?.badge).toBeUndefined();
    expect(waitingInbox?.badge).toBe(7);
  });

  it("limita a criação rápida pela função da sessão", () => {
    expect(quickCreatePermissions("OWNER")).toEqual({ canCreateKnowledge: true, canInvite: true });
    expect(quickCreatePermissions("ADMIN")).toEqual({ canCreateKnowledge: true, canInvite: true });
    expect(quickCreatePermissions("AGENT")).toEqual({ canCreateKnowledge: false, canInvite: false });
    expect(quickCreatePermissions("VIEWER")).toEqual({ canCreateKnowledge: false, canInvite: false });
  });
});
