export function getDefaultCollapsedYears(
  years: Iterable<number>,
  currentYear = new Date().getFullYear()
): Set<number> {
  return new Set(Array.from(new Set(years)).filter(year => year < currentYear))
}
