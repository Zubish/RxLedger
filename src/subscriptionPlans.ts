export type SubscriptionPlanId = 'single-branch' | 'smart-pharmacy' | 'enterprise'

export type SubscriptionPlan = {
  id: SubscriptionPlanId
  name: string
  badge?: string
  price: string
  per: string
  summary: string
  limits: string[]
  features: string[]
  upgradeFor: string[]
  cta: string
  highlight?: boolean
}

export const trialPolicy = {
  durationDays: 30,
  includedPlan: 'smart-pharmacy' as SubscriptionPlanId,
  summary: 'The free trial includes Smart Pharmacy features for 30 days. Trial data is preserved and can move into any paid plan.',
}

export const planChangePolicy = {
  upgrade: 'Upgrades are immediate and keep the same workspace data.',
  downgrade: 'Downgrades are allowed only when active branches and staff fit the lower plan. Extra data is not deleted; it must be archived, exported, or moved before the lower plan becomes active.',
  dataRetention: 'Plan changes never delete stock, sales, patient, audit, or branch history.',
}

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'single-branch',
    name: 'Single Branch',
    price: '$29',
    per: '/mo',
    summary: 'For one independent pharmacy that needs clean stock control and counter sales.',
    limits: ['1 active branch', 'Up to 5 staff', 'Basic support'],
    features: [
      'Pharmacy and mart inventory',
      'FEFO batch tracking',
      'POS checkout and sales history',
      'Basic dashboard and reports',
      'Low-stock and expiry alerts',
      'Audit trail',
      'Basic patient lookup from sales history',
    ],
    upgradeFor: [
      'Multi-branch operations',
      'Refill reminders',
      'Team messaging',
      'Advanced patient follow-up',
    ],
    cta: 'Start free trial',
  },
  {
    id: 'smart-pharmacy',
    name: 'Smart Pharmacy',
    badge: 'Most pharmacies',
    price: '$79',
    per: '/mo',
    summary: 'For growing pharmacies that need patient follow-up and stronger daily operations.',
    limits: ['Up to 5 active branches', 'Up to 25 staff', 'Priority support'],
    features: [
      'Everything in Single Branch',
      'Inter-branch requisitions and transfers',
      'Branch workspace switching',
      'Role-based access and staff approvals',
      'Patient refill reminders',
      'Counseling and follow-up messages',
      'WhatsApp/copy patient communication',
      'Team messages',
      'Advanced reports and CSV export',
    ],
    upgradeFor: [
      'Unlimited branches or staff',
      'Custom integrations',
      'SLA support',
      'Future AI/clinical automation',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'From $199',
    per: '/mo',
    summary: 'For pharmacy groups, hospital dispensaries, and multi-site operators.',
    limits: ['Unlimited branches', 'Unlimited staff', 'SLA and onboarding'],
    features: [
      'Everything in Smart Pharmacy',
      'Dedicated onboarding and data migration',
      'Custom reports',
      'Custom integrations/API',
      'Advanced security review',
      'Hospital/group pharmacy workflows',
      'Future AI counseling and adherence tools',
      'Dedicated success support',
    ],
    upgradeFor: [],
    cta: 'Contact sales',
  },
]

export function planById(planId: SubscriptionPlanId) {
  return subscriptionPlans.find((plan) => plan.id === planId) ?? subscriptionPlans[0]
}

export function planChangeBlockers(input: { activeBranches: number; activeStaff: number }, targetPlanId: SubscriptionPlanId) {
  if (targetPlanId === 'enterprise') return []
  const plan = planById(targetPlanId)
  const blockers: string[] = []
  const branchLimit = targetPlanId === 'single-branch' ? 1 : 5
  const staffLimit = targetPlanId === 'single-branch' ? 5 : 25
  if (input.activeBranches > branchLimit) blockers.push(`${plan.name} allows ${branchLimit} active branch${branchLimit === 1 ? '' : 'es'}.`)
  if (input.activeStaff > staffLimit) blockers.push(`${plan.name} allows up to ${staffLimit} active staff.`)
  return blockers
}
