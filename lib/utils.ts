export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function compactText(...parts: string[]): string {
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
