export const EXPECTED_VAR_COST = {
  cleaning: 360,
  support: 150,
  misc: 200,
}
export const EXPECTED_VAR_TOTAL = Object.values(EXPECTED_VAR_COST).reduce((s, v) => s + v, 0)
