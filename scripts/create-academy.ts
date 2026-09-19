// Operator tool for onboarding a new paying customer (tenant) onto the SaaS.
// Run manually whenever a willing customer signs up for a plan — creates their
// academy record and owner login, pre-set to the tier they purchased.
//
// Usage:
//   npx tsx scripts/create-academy.ts \
//     --name "Sunrise Academy" \
//     --owner-name "Ali Khan" \
//     --owner-email ali@sunrise.test \
//     --owner-password "Secret123" \
//     --tier basic|standard|premium \
//     [--slug sunrise-academy] [--phone "+92-300-1234567"] [--address "..."] [--trial-days 14]
//
// --tier maps to the business plan names discussed with the customer:
//   basic    -> Tier 1 (PlanTier.TRIAL)  — 1 staff account,  no reports, no website
//   standard -> Tier 2 (PlanTier.BASIC)  — 2 staff accounts, reports,    no website
//   premium  -> Tier 3 (PlanTier.PRO)    — 3 staff accounts, reports,    website
//
// PlanTier's enum names (TRIAL/BASIC/PRO) are historical and don't literally mean
// "free trial" — they're just tier 1/2/3 identifiers. Pass --trial-days if this
// specific customer genuinely gets a time-limited trial before the tier kicks in.

import bcrypt from 'bcrypt'
import { PrismaClient, PlanTier } from '@prisma/client'

const prisma = new PrismaClient()

const TIER_MAP: Record<string, PlanTier> = {
  basic: PlanTier.TRIAL,
  standard: PlanTier.BASIC,
  premium: PlanTier.PRO,
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : ''
    args[key] = value
  }
  return args
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const name = args.name?.trim()
  const ownerName = args['owner-name']?.trim()
  const ownerEmail = args['owner-email']?.trim().toLowerCase()
  const ownerPassword = args['owner-password']
  const tierKey = args.tier?.trim().toLowerCase()

  if (!name || !ownerName || !ownerEmail || !ownerPassword || !tierKey) {
    console.error('Missing required arguments. Required: --name --owner-name --owner-email --owner-password --tier')
    console.error('See the top of this file for full usage.')
    process.exit(1)
  }

  const planTier = TIER_MAP[tierKey]
  if (!planTier) {
    console.error(`Invalid --tier "${tierKey}". Use one of: basic, standard, premium.`)
    process.exit(1)
  }

  if (ownerPassword.length < 6) {
    console.error('--owner-password must be at least 6 characters.')
    process.exit(1)
  }

  const slug = (args.slug?.trim() ? slugify(args.slug) : slugify(name)) || `academy-${Date.now()}`
  const trialDays = args['trial-days'] ? Number(args['trial-days']) : null
  const trialEndsAt = trialDays && trialDays > 0 ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null

  const [slugTaken, emailTaken] = await Promise.all([
    prisma.academy.findUnique({ where: { slug } }),
    prisma.user.findUnique({ where: { email: ownerEmail } }),
  ])
  if (slugTaken) {
    console.error(`An academy with slug "${slug}" already exists. Pass --slug to choose a different one.`)
    process.exit(1)
  }
  if (emailTaken) {
    console.error(`A user with email "${ownerEmail}" already exists.`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12)

  const academy = await prisma.academy.create({
    data: {
      name,
      slug,
      phone: args.phone?.trim() || null,
      address: args.address?.trim() || null,
      planTier,
      trialEndsAt,
    },
  })

  const owner = await prisma.user.create({
    data: {
      academyId: academy.id,
      email: ownerEmail,
      passwordHash,
      fullName: ownerName,
      role: 'OWNER',
      phone: args['owner-phone']?.trim() || null,
    },
  })

  console.log('\nAcademy created successfully.\n')
  console.log(`  Academy:  ${academy.name} (${academy.slug})`)
  console.log(`  Plan:     ${tierKey} (${planTier})${trialEndsAt ? ` · trial until ${trialEndsAt.toDateString()}` : ''}`)
  console.log(`  Owner:    ${owner.fullName} <${owner.email}>`)
  console.log(`  Sign in:  share the email above with the password you provided.\n`)
}

main()
  .catch((e) => {
    console.error('Failed to create academy:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
