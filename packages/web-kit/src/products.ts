export type ProductId = "inflation" | "agriculture";

export interface Product {
  id: ProductId;
  name: string;
  url: string;
}

// Production domains; override per environment (previews, custom domains).
export const PRODUCTS: Product[] = [
  { id: "inflation", name: "Inflation", url: process.env.NEXT_PUBLIC_INFLATION_URL ?? "https://inflation-radar.vercel.app" },
  { id: "agriculture", name: "Agriculture", url: process.env.NEXT_PUBLIC_AGRICULTURE_URL ?? "https://agriculture-radar-omega.vercel.app" },
];

export const productUrl = (id: ProductId, path = ""): string => `${PRODUCTS.find((p) => p.id === id)!.url}${path}`;
