/**
 * URL normalisation rules that can be applied before redirect lookup.
 *
 * Normalisation is opt-in. Only rules explicitly provided in the
 * `normalisationRules` prop of {@link RedirectServiceProps} are applied.
 * If no rules are provided, URLs are looked up exactly as received.
 *
 * Rules are applied in the following order:
 * 1. Host normalisation (STRIP_WWW)
 * 2. Path normalisation (LOWERCASE_PATH, COLLAPSE_SLASHES, STRIP_INDEX_FILES, STRIP_HTML_EXTENSION, STRIP_TRAILING_SLASH)
 * 3. Query string normalisation (DROP_FACETED_PARAMS, DROP_TRACKING_PARAMS)
 *
 * When normalisation changes the incoming URL, the redirect handler issues a
 * 301 redirect to the normalised form before performing the redirect lookup.
 * This ensures a single hop regardless of how many rules are applied.
 */
export enum NormalisationRule {
  /**
   * Strip the `www.` prefix from the request host.
   *
   * @example `www.example.co.uk` → `example.co.uk`
   */
  STRIP_WWW = 'STRIP_WWW',

  /**
   * Lowercase the entire URL path.
   *
   * @example `/Products/Widget` → `/products/widget`
   */
  LOWERCASE_PATH = 'LOWERCASE_PATH',

  /**
   * Collapse consecutive slashes in the path to a single slash.
   *
   * @example `/path//to///page` → `/path/to/page`
   */
  COLLAPSE_SLASHES = 'COLLAPSE_SLASHES',

  /**
   * Strip the `.html` file extension from the end of the path.
   *
   * @example `/about-us.html` → `/about-us`
   */
  STRIP_HTML_EXTENSION = 'STRIP_HTML_EXTENSION',

  /**
   * Strip `/index.php` and `/index.html` from the end of the path.
   * Applied before STRIP_HTML_EXTENSION to correctly handle `/category/index.html`.
   *
   * @example `/category/index.html` → `/category`
   * @example `/shop/index.php` → `/shop`
   */
  STRIP_INDEX_FILES = 'STRIP_INDEX_FILES',

  /**
   * Strip the trailing slash from the path, except for the root path `/`.
   *
   * @example `/products/` → `/products`
   * @example `/` → `/` (unchanged)
   */
  STRIP_TRAILING_SLASH = 'STRIP_TRAILING_SLASH',

  /**
   * Drop faceted/sort query parameters from the URL.
   * The specific parameters to drop are specified in the `params` field
   * of the {@link NormalisationRuleConfig}.
   *
   * Requires `params` to be provided. The construct validates this at synth time.
   *
   * @example With params `['manufacturer', 'limit']`:
   *   `/products?manufacturer=acme&limit=10&color=red` → `/products?color=red`
   */
  DROP_FACETED_PARAMS = 'DROP_FACETED_PARAMS',

  /**
   * Drop tracking query parameters from the URL.
   * The specific parameters to drop are specified in the `params` field
   * of the {@link NormalisationRuleConfig}.
   *
   * By default (when this rule is not enabled), tracking parameters are
   * preserved and passed through to the redirect target URL.
   *
   * Requires `params` to be provided. The construct validates this at synth time.
   *
   * @example With params `['utm_source', 'fbclid']`:
   *   `/page?utm_source=google&fbclid=abc&ref=site` → `/page?ref=site`
   */
  DROP_TRACKING_PARAMS = 'DROP_TRACKING_PARAMS',
}

/**
 * Configuration for a single normalisation rule.
 *
 * Simple rules (STRIP_WWW, LOWERCASE_PATH, etc.) only require the `rule` field.
 * Param-based rules (DROP_FACETED_PARAMS, DROP_TRACKING_PARAMS) additionally
 * require the `params` field to specify which query parameters to drop.
 *
 * @example Simple rule:
 *
 * { rule: NormalisationRule.STRIP_WWW }
 *
 *
 * @example Param-based rule:
 *
 * { rule: NormalisationRule.DROP_FACETED_PARAMS, params: ['manufacturer', 'limit', 'orderby'] }
 *
 */
export interface NormalisationRuleConfig {
  /** The normalisation rule to apply. */
  readonly rule: NormalisationRule;

  /**
   * Query parameters to drop when using DROP_FACETED_PARAMS or DROP_TRACKING_PARAMS.
   * Each entry is an exact parameter name to match and remove from the query string.
   *
   * Required when `rule` is `DROP_FACETED_PARAMS` or `DROP_TRACKING_PARAMS`.
   * Ignored for all other rules.
   */
  readonly params?: string[];
}
