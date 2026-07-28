import { Suspense } from "react";
import { loadLibrary } from "@/lib/library";
import { LibraryView } from "@/components/library-view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { items, broken } = await loadLibrary();

  return (
    <Suspense fallback={<LoadingShell />}>
      <LibraryView items={items} />
      {broken.length > 0 && (
        <div className="mx-auto max-w-[1600px] px-5 pb-10 lg:px-8">
          <div className="rounded-md border border-line-2 bg-panel px-4 py-3">
            <p className="tag text-muted">
              {broken.length} item file{broken.length > 1 ? "s" : ""} could not be read
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {broken.map((b) => (
                <li key={b.file} className="mono text-[12px] text-muted">
                  {b.file}: {b.problem}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <div className="px-8 py-10">
      <p className="tag text-muted">Reading library</p>
    </div>
  );
}
