import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getItem, loadLibrary } from "@/lib/library";
import { ItemDetail } from "@/components/item-detail";
import { itemTitle } from "@/lib/display";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  return { title: item ? `${itemTitle(item)} - Design DNA` : "Design DNA" };
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [item, { items }] = await Promise.all([getItem(id), loadLibrary()]);
  if (!item) notFound();

  return (
    <Suspense fallback={<div className="px-8 py-10" />}>
      <ItemDetail item={item} allItems={items} />
    </Suspense>
  );
}
