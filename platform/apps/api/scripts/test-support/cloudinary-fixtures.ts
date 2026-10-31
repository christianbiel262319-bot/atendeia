export type DisposableImage = {
  tenantId: string;
  runId: string;
  publicId: string;
  assetId: string;
};
export type CloudinaryIdentity = {
  public_id: string;
  asset_id: string;
  resource_type: string;
  type: string;
  tags?: string[];
};
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
export function disposablePublicId(
  tenantId: string,
  runId: string,
  label: "shared" | "isolated",
): string {
  if (
    !uuid.test(tenantId) ||
    !uuid.test(runId) ||
    !["shared", "isolated"].includes(label)
  )
    throw new Error("Invalid disposable fixture identity");
  return `atendeia/${tenantId}/homologation-${runId}/${label}`;
}
export function disposableTag(runId: string): string {
  if (!uuid.test(runId)) throw new Error("Invalid fixture run");
  return `atendeia_hml_${runId}`;
}
export function assertDisposableOwnership(
  publicId: string,
  owned: ReadonlyMap<string, DisposableImage>,
  remote: CloudinaryIdentity,
): DisposableImage {
  const fixture = owned.get(publicId);
  if (
    !fixture ||
    !["shared", "isolated"].some(
      (label) =>
        publicId ===
        disposablePublicId(
          fixture.tenantId,
          fixture.runId,
          label as "shared" | "isolated",
        ),
    )
  ) {
    throw new Error("Refusing an asset outside this run's disposable manifest");
  }
  if (
    remote.public_id !== publicId ||
    remote.asset_id !== fixture.assetId ||
    remote.resource_type !== "image" ||
    remote.type !== "upload" ||
    !remote.tags?.includes(disposableTag(fixture.runId))
  ) {
    throw new Error(
      "Remote identity does not match the disposable upload receipt",
    );
  }
  return fixture;
}
