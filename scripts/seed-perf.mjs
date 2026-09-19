#!/usr/bin/env node
/**
 * Large-volume performance seed: one tenant with realistic scale so load tests
 * exercise real query/index behavior. Idempotent-ish: wipes and recreates the
 * `perf-academy` tenant each run. NOT for production.
 *
 *   node scripts/seed-perf.mjs [studentCount]   (default 1500)
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const N = Number(process.argv[2] || 1500)
const CLASSES = 30
const MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09']

async function main() {
  const t0 = Date.now()
  await prisma.academy.deleteMany({ where: { slug: 'perf-academy' } }) // cascades
  const academy = await prisma.academy.create({
    data: { name: 'Perf Load Academy', slug: 'perf-academy', planTier: 'PRO', status: 'ACTIVE' },
  })
  const owner = await prisma.user.create({
    data: { academyId: academy.id, email: 'owner@perf-academy.test', passwordHash: await bcrypt.hash('PerfLoad!2026', 10), fullName: 'Perf Owner', role: 'OWNER' },
  })

  const classes = []
  for (let i = 0; i < CLASSES; i++) {
    classes.push({ academyId: academy.id, name: `Grade ${1 + (i % 12)}`, section: String.fromCharCode(65 + (i % 6)) + i, monthlyFee: 5000 + (i % 5) * 1000, teacherId: owner.id })
  }
  await prisma.class.createMany({ data: classes })
  const classRows = await prisma.class.findMany({ where: { academyId: academy.id }, select: { id: true, monthlyFee: true } })

  // Students in batches.
  const students = []
  for (let i = 0; i < N; i++) {
    const c = classRows[i % classRows.length]
    students.push({ academyId: academy.id, classId: c.id, fullName: `Student ${i}`, parentName: `Parent ${i}`, parentPhone: '0300' + String(1000000 + i), monthlyFee: c.monthlyFee, status: 'ACTIVE' })
  }
  for (let i = 0; i < students.length; i += 1000) await prisma.student.createMany({ data: students.slice(i, i + 1000) })
  const studentRows = await prisma.student.findMany({ where: { academyId: academy.id }, select: { id: true, monthlyFee: true } })

  // Invoices: 4 months each. Payments for ~60%. Attendance: last 5 days for first 500.
  const invoices = []
  for (const s of studentRows) {
    for (const m of MONTHS) {
      invoices.push({ academyId: academy.id, studentId: s.id, month: m, amountDue: s.monthlyFee, amountPaid: 0, status: 'PENDING', dueDate: new Date(`${m}-10`) })
    }
  }
  for (let i = 0; i < invoices.length; i += 2000) await prisma.feeInvoice.createMany({ data: invoices.slice(i, i + 2000) })

  const invRows = await prisma.feeInvoice.findMany({ where: { academyId: academy.id, month: '2026-09' }, select: { id: true, studentId: true, amountDue: true }, take: Math.floor(N * 0.6) })
  const payments = invRows.map((inv, i) => ({ academyId: academy.id, invoiceId: inv.id, amount: inv.amountDue, paymentMethod: 'CASH', receiptNumber: `PERF-${Date.now().toString(36)}-${i}`, recordedByUserId: owner.id }))
  for (let i = 0; i < payments.length; i += 2000) await prisma.feePayment.createMany({ data: payments.slice(i, i + 2000) })
  await prisma.feeInvoice.updateMany({ where: { id: { in: invRows.map((r) => r.id) } }, data: { status: 'PAID' } })

  const att = []
  for (const s of studentRows.slice(0, 500)) {
    for (let d = 0; d < 5; d++) att.push({ academyId: academy.id, studentId: s.id, classId: classRows[0].id, date: new Date(2026, 8, 15 + d), status: d % 4 === 0 ? 'ABSENT' : 'PRESENT', markedByUserId: owner.id })
  }
  for (let i = 0; i < att.length; i += 2000) await prisma.attendanceRecord.createMany({ data: att.slice(i, i + 2000) })

  const counts = {
    students: await prisma.student.count({ where: { academyId: academy.id } }),
    invoices: await prisma.feeInvoice.count({ where: { academyId: academy.id } }),
    payments: await prisma.feePayment.count({ where: { academyId: academy.id } }),
    attendance: await prisma.attendanceRecord.count({ where: { academyId: academy.id } }),
  }
  console.log(`perf seed done in ${Date.now() - t0}ms:`, JSON.stringify(counts))
  console.log('login: owner@perf-academy.test / PerfLoad!2026')
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
