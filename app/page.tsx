"use client";

import { AtendeIaApp } from "../platform/apps/web/src/app";
import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

export default function Home() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!mounted) {
    return (
      <main className="grid min-h-screen place-items-center bg-app-canvas">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <span className="size-5 animate-spin rounded-full border-2 border-brand-700 border-t-transparent" />
          Preparando o AtendeIA…
        </div>
      </main>
    );
  }
  return <AtendeIaApp />;
}
