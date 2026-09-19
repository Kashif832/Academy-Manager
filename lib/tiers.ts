// Plan tiers map 1:1 onto PlanTier: TRIAL = Tier 1 (Basic), BASIC = Tier 2 (Standard),
// PRO = Tier 3 (Premium). The enum names are historical (kept to avoid a risky
// rename migration) — treat them purely as tier identifiers, not literal trial state.
//
// This file is the single source of truth for tier → feature/limit mapping.
// Nothing else in the app should hard-code a `planTier === 'X'` feature check —
// call hasFeature()/staffLimitFor() instead, so the mapping only ever lives here.

export type PlanTierKey = 'TRIAL' | 'BASIC' | 'PRO'

export type FeatureKey =
  | 'reports'
  | 'website_cms'
  | 'admissions_crm'
  | 'advanced_reports'

const TIER_ORDER: PlanTierKey[] = ['TRIAL', 'BASIC', 'PRO']

// Each tier's feature list is additive over the previous tier (Tier 2 includes
// everything in Tier 1, Tier 3 includes everything in Tier 2), mirrored here
// explicitly so the mapping stays easy to read and change.
const TIER_FEATURES: Record<PlanTierKey, FeatureKey[]> = {
  TRIAL: [],
  BASIC: ['reports'],
  PRO: ['reports', 'website_cms', 'admissions_crm', 'advanced_reports'],
}

const STAFF_LIMITS: Record<PlanTierKey, number> = { TRIAL: 1, BASIC: 2, PRO: 3 }

const TIER_META: Record<PlanTierKey, { number: 1 | 2 | 3; label: string; businessName: string }> = {
  TRIAL: { number: 1, label: 'Tier 1 · Basic', businessName: 'Basic' },
  BASIC: { number: 2, label: 'Tier 2 · Standard', businessName: 'Standard' },
  PRO: { number: 3, label: 'Tier 3 · Premium', businessName: 'Premium' },
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  reports: 'Reports module',
  website_cms: 'Public website & CMS',
  admissions_crm: 'Admissions CRM (leads pipeline)',
  advanced_reports: 'Advanced reports',
}

function isKnownTier(planTier: string): planTier is PlanTierKey {
  return planTier === 'TRIAL' || planTier === 'BASIC' || planTier === 'PRO'
}

export function hasFeature(planTier: string, feature: FeatureKey) {
  if (!isKnownTier(planTier)) return false
  return TIER_FEATURES[planTier].includes(feature)
}

export function hasReportsAccess(planTier: string) {
  return hasFeature(planTier, 'reports')
}

export function hasWebsiteAccess(planTier: string) {
  return hasFeature(planTier, 'website_cms')
}

export function staffLimitFor(planTier: string) {
  return isKnownTier(planTier) ? STAFF_LIMITS[planTier] : 1
}

export function tierLabel(planTier: string) {
  return isKnownTier(planTier) ? TIER_META[planTier].label : 'Tier 1 · Basic'
}

export function tierNumber(planTier: string) {
  return isKnownTier(planTier) ? TIER_META[planTier].number : 1
}

export function tierBusinessName(planTier: string) {
  return isKnownTier(planTier) ? TIER_META[planTier].businessName : 'Basic'
}

// Full tier catalogue, in display order — used by the Super Admin "Plans &
// Features" screen so the UI always reflects exactly what's enforced above,
// with no risk of the display drifting out of sync with real access control.
export function tierCatalogue() {
  return TIER_ORDER.map((tier) => ({
    tier,
    number: TIER_META[tier].number,
    label: TIER_META[tier].label,
    businessName: TIER_META[tier].businessName,
    staffLimit: STAFF_LIMITS[tier],
    features: TIER_FEATURES[tier].map((f) => ({ key: f, label: FEATURE_LABELS[f] })),
  }))
}
