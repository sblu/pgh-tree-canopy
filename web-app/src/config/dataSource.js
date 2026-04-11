/**
 * Data source switching for comparing precomputed vs public pipeline output.
 *
 * Usage: append ?source=public to the URL to use the public pipeline data.
 * Default (no param or ?source=precomputed) uses the original precomputed data.
 *
 * In development, create two symlinks:
 *   web-app/public/data        → ../../data-pipeline/output
 *   web-app/public/data-public → ../../data-pipeline/output_public
 */

const params = new URLSearchParams(window.location.search)
const source = params.get('source')

export const DATA_PREFIX = source === 'public' ? 'data-public' : 'data'
export const IS_PUBLIC_SOURCE = source === 'public'
export const SOURCE_LABEL = IS_PUBLIC_SOURCE ? 'Public Pipeline' : 'Precomputed'
