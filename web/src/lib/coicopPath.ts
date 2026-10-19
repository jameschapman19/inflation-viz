/**
 * Some COICOP codes contain a slash ("01.1.1.7/8" is a combined class), which
 * a single URL segment cannot carry: the build writes such a page but the
 * server will not route to it, encoded or not. Paths use an underscore in its
 * place. No code contains an underscore, so the mapping is exact.
 */
export const coicopSlug = (coicop: string): string => coicop.replaceAll("/", "_");
export const coicopFromSlug = (slug: string): string => slug.replaceAll("_", "/");
