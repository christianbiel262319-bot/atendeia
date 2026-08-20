/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ATENDEIA_PREVIEW?: string;
  readonly VITE_ATENDEIA_STAGE?: "development" | "preview" | "production";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
