export function normalizeName(name: string) {
  // lowercase, trim, collapse spaces, strip diacritics/punctuation
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')                     // keep letters/numbers/spaces
    .replace(/\s+/g, ' ')                             // collapse spaces
    .trim();
}
