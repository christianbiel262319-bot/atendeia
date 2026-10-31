import { describe, expect, it } from "vitest";
import {
  assertDisposableOwnership,
  disposablePublicId,
  disposableTag,
} from "../scripts/test-support/cloudinary-fixtures.js";
const tenantId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const publicId = disposablePublicId(tenantId, runId, "shared");
const fixture = { tenantId, runId, publicId, assetId: "receipt-asset" };
const ledger = new Map([[publicId, fixture]]);
const remote = {
  public_id: publicId,
  asset_id: fixture.assetId,
  resource_type: "image",
  type: "upload",
  tags: [disposableTag(runId)],
};
describe("live Cloudinary fixture boundaries", () => {
  it("allows only an image confirmed by this run's receipt and tag", () => {
    expect(assertDisposableOwnership(publicId, ledger, remote)).toEqual(
      fixture,
    );
  });
  it("rejects existing assets outside the manifest", () => {
    expect(() =>
      assertDisposableOwnership("atendeia/customer/existing", ledger, remote),
    ).toThrow();
  });
  it("rejects replacement of the provider asset behind the same public ID", () => {
    expect(() =>
      assertDisposableOwnership(publicId, ledger, {
        ...remote,
        asset_id: "unrelated-asset",
      }),
    ).toThrow();
  });
  it("rejects a missing or different run tag", () => {
    expect(() =>
      assertDisposableOwnership(publicId, ledger, {
        ...remote,
        tags: ["another-run"],
      }),
    ).toThrow();
  });
  it("rejects tenant path injection before creating an upload", () => {
    expect(() => disposablePublicId("../existing", runId, "shared")).toThrow();
  });
});
