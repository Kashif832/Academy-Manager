import { describe, it, expect } from 'vitest'
import { canManageAcademy, canManageFinance, canMarkAttendance } from '../lib/permissions'

describe('permission matrix', () => {
  it('only OWNER/ADMIN can manage academy config', () => {
    expect(canManageAcademy('OWNER')).toBe(true)
    expect(canManageAcademy('ADMIN')).toBe(true)
    expect(canManageAcademy('ACCOUNTANT')).toBe(false)
    expect(canManageAcademy('TEACHER')).toBe(false)
  })
  it('OWNER/ADMIN/ACCOUNTANT can manage finance, TEACHER cannot', () => {
    expect(canManageFinance('OWNER')).toBe(true)
    expect(canManageFinance('ADMIN')).toBe(true)
    expect(canManageFinance('ACCOUNTANT')).toBe(true)
    expect(canManageFinance('TEACHER')).toBe(false)
  })
  it('all roles can mark attendance', () => {
    for (const r of ['OWNER', 'ADMIN', 'ACCOUNTANT', 'TEACHER']) {
      expect(canMarkAttendance(r)).toBe(true)
    }
  })
  it('unknown roles are denied elevated capabilities', () => {
    expect(canManageAcademy('GUEST')).toBe(false)
    expect(canManageFinance('GUEST')).toBe(false)
  })
})
