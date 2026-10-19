// GENERATED from packages/web-kit/src — edit there, then run: node scripts/sync-web-kit.mjs
import { PRODUCTS, type ProductId } from "./products";

/** A thin bar above the site header linking the Radar products. */
export function ProductSwitcher({ current }: { current: ProductId }) {
  return (
    <nav className="product-bar" aria-label="Radar products">
      <span>Radar</span>
      {PRODUCTS.map((product) =>
        product.id === current ? (
          <b key={product.id} aria-current="page">
            {product.name}
          </b>
        ) : (
          <a key={product.id} href={product.url}>
            {product.name}
          </a>
        ),
      )}
    </nav>
  );
}
