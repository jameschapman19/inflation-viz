import { coicopFromSlug, coicopSlug } from "@/lib/coicopPath";
import { buildReplayData, splitReplay } from "@/lib/replay";

export const dynamic = "force-static";
export const dynamicParams = false;

const { rest } = splitReplay(buildReplayData());

export function generateStaticParams() {
  return rest.map((node) => ({ id: coicopSlug(node.id) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = coicopFromSlug((await params).id);
  const node = rest.find((n) => n.id === id);
  if (!node) throw new Error(`No replay node ${id}`);
  return Response.json(node);
}
