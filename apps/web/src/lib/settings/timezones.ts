const FALLBACK = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/** All IANA time zones, or a small curated fallback when unavailable. */
export function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    if (typeof intl.supportedValuesOf === 'function') {
      const zones = intl.supportedValuesOf('timeZone');
      if (zones.length > 0) return zones;
    }
  } catch {
    /* fall through */
  }
  return FALLBACK;
}
