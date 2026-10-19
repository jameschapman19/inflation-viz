# web-kit

Small, framework-light React pieces shared by the public Radar front ends
(`web/` for Inflation Radar and `agriculture/web/` for Agriculture Radar):
embed mode, the stripe strip and scrubber track, URL-hash state, the
share-card shell, and the product switcher. Styled only with the shared
`--radar-*` tokens from `radar.css`, so it looks right in both products.

`src/` here is the single source of truth. Each app holds a generated copy in
`src/kit/` — not a cross-root import, so each Vercel project still builds from
its own root directory.

```sh
node scripts/sync-web-kit.mjs          # copy src/ into both apps
node scripts/sync-web-kit.mjs --check  # fail if a copy has drifted (CI)
```

Edit files here, never the copies. Product-specific logic (colour scales,
data shapes, copy) stays in each app and is passed in as props.
