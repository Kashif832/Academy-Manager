import { describe, it, expect } from 'vitest'
import { hasFeature, hasReportsAccess, hasWebsiteAccess, staffLimitFor, tierNumber, tierCatalogue } from '../lib/tiers'

describe('tier entitlements', () => {
  it('Basic (TRIAL) has no add-on features', () => {
    expect(hasReportsAccess('TRIAL')).toBe(false)
    expect(hasWebsiteAccess('TRIAL')).toBe(false)
    expect(hasFeature('TRIAL', 'admissions_crm')).toBe(false)
  })
  it('Standard (BASIC) unlocks reports but not website/CRM', () => {
    expect(hasReportsAccess('BASIC')).toBe(true)
    expect(hasWebsiteAccess('BASIC')).toBe(false)
    expect(hasFeature('BASIC', 'admissions_crm')).toBe(false)
  })
  it('Premium (PRO) unlocks everything', () => {
    expect(hasReportsAccess('PRO')).toBe(true)
    expect(hasWebsiteAccess('PRO')).toBe(true)
    expect(hasFeature('PRO', 'admissions_crm')).toBe(true)
    expect(hasFeature('PRO', 'advanced_reports')).toBe(true)
  })
  it('staff limits increase with tier', () => {
    expect(staffLimitFor('TRIAL')).toBe(1)
    expect(staffLimitFor('BASIC')).toBe(2)
    expect(staffLimitFor('PRO')).toBe(3)
  })
  it('tier ordering supports upgrade validation', () => {
    expect(tierNumber('TRIAL')).toBeLessThan(tierNumber('BASIC'))
    expect(tierNumber('BASIC')).toBeLessThan(tierNumber('PRO'))
  })
  it('unknown tier is treated as the lowest tier with no features', () => {
    expect(hasReportsAccess('NONSENSE')).toBe(false)
    expect(staffLimitFor('NONSENSE')).toBe(1)
  })
  it('catalogue is additive and ordered', () => {
    const cat = tierCatalogue()
    expect(cat.map((c) => c.tier)).toEqual(['TRIAL', 'BASIC', 'PRO'])
    // each higher tier includes at least as many features as the lower
    expect(cat[2].features.length).toBeGreaterThanOrEqual(cat[1].features.length)
    expect(cat[1].features.length).toBeGreaterThanOrEqual(cat[0].features.length)
  })
})
