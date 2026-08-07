import type { CostProjection, CostProjectionInput, ProjectionCostLine } from "./types";

const roundCents = (value: number) => Math.max(0, Math.round(value));
const gbFromMb = (mb: number) => mb / 1024;

export const defaultProjectionInput: CostProjectionInput = {
  name: "Base case",
  payingUsers: 10_000,
  monthlyPriceCents: 299,
  freeUsersPerPayingUser: 3,
  chargesPerPayingUser: 1,
  includeOptionalBudgets: false,
  bankSyncAdoption: 0,
  bankConnectionsPerUser: 1,
  bankCostPerConnectionCents: 30,
  stripeRate: 0.029,
  stripeFixedFeeCents: 30,
  databaseMbPerActiveUser: 0.25,
  fileStorageMbPerActiveUser: 5,
  supabaseEgressMbPerActiveUser: 50,
  vercelTransferMbPerActiveUser: 50,
  emailsPerActiveUser: 3,
  functionCallsPerActiveUser: 50,
  cpuSecondsPerCall: 0.05,
  functionDurationSeconds: 0.2,
  functionMemoryGb: 0.5,
  supabaseBaseCents: 2500,
  supabaseIncludedMau: 100_000,
  supabaseAdditionalMauCents: 0.325,
  supabaseIncludedDatabaseGb: 8,
  supabaseAdditionalDatabaseGbCents: 12.5,
  supabaseIncludedEgressGb: 250,
  supabaseAdditionalEgressGbCents: 9,
  supabaseIncludedStorageGb: 100,
  supabaseAdditionalStorageGbCents: 2.13,
  supabaseComputeCents: 1000,
  supabaseComputeCreditCents: 1000,
  vercelPlatformCents: 2000,
  vercelUsageCreditCents: 2000,
  vercelTransferGbCents: 15,
  vercelIncludedCalls: 1_000_000,
  vercelMillionCallsCents: 60,
  vercelCpuHourCents: 12.8,
  vercelMemoryGbHourCents: 1.06,
  emailFreeThreshold: 3_000,
  emailPlanBaseCents: 2000,
  emailPlanIncluded: 50_000,
  emailAdditionalThousandCents: 90,
  staffAndSupportCents: 0,
  marketingRate: 0,
  securityLegalInsuranceCents: 0,
  otherFixedBudgetCents: 0,
  otherDirectCostPerPayingUserCents: 0,
  marketplaceCommissionRate: 0,
};

export function projectCosts(input: CostProjectionInput): CostProjection {
  const payingUsers = Math.max(0, Math.round(input.payingUsers));
  const activeUsers = Math.max(0, Math.round(payingUsers * (1 + input.freeUsersPerPayingUser)));
  const monthlyRevenueCents = roundCents(
    payingUsers * input.monthlyPriceCents * input.chargesPerPayingUser,
  );
  const databaseGb = gbFromMb(activeUsers * input.databaseMbPerActiveUser);
  const fileStorageGb = gbFromMb(activeUsers * input.fileStorageMbPerActiveUser);
  const supabaseEgressGb = gbFromMb(activeUsers * input.supabaseEgressMbPerActiveUser);
  const vercelTransferGb = gbFromMb(activeUsers * input.vercelTransferMbPerActiveUser);
  const monthlyEmails = Math.round(activeUsers * input.emailsPerActiveUser);
  const functionCalls = activeUsers * input.functionCallsPerActiveUser;
  const cpuHours = (functionCalls * input.cpuSecondsPerCall) / 3600;
  const memoryGbHours =
    (functionCalls * input.functionDurationSeconds * input.functionMemoryGb) / 3600;

  const stripe = roundCents(
    monthlyRevenueCents * input.stripeRate +
      payingUsers * input.chargesPerPayingUser * input.stripeFixedFeeCents,
  );
  const bankSync = roundCents(
    payingUsers *
      input.bankSyncAdoption *
      input.bankConnectionsPerUser *
      input.bankCostPerConnectionCents,
  );
  const otherDirect = roundCents(
    payingUsers * input.otherDirectCostPerPayingUserCents +
      monthlyRevenueCents * input.marketplaceCommissionRate,
  );
  const supabase = roundCents(
    input.supabaseBaseCents +
      Math.max(0, activeUsers - input.supabaseIncludedMau) * input.supabaseAdditionalMauCents +
      Math.max(0, databaseGb - input.supabaseIncludedDatabaseGb) * input.supabaseAdditionalDatabaseGbCents +
      Math.max(0, supabaseEgressGb - input.supabaseIncludedEgressGb) * input.supabaseAdditionalEgressGbCents +
      Math.max(0, fileStorageGb - input.supabaseIncludedStorageGb) * input.supabaseAdditionalStorageGbCents +
      Math.max(0, input.supabaseComputeCents - input.supabaseComputeCreditCents),
  );
  const grossVercelUsage =
    vercelTransferGb * input.vercelTransferGbCents +
    (Math.max(0, functionCalls - input.vercelIncludedCalls) / 1_000_000) * input.vercelMillionCallsCents +
    cpuHours * input.vercelCpuHourCents +
    memoryGbHours * input.vercelMemoryGbHourCents;
  const vercel = roundCents(
    input.vercelPlatformCents + Math.max(0, grossVercelUsage - input.vercelUsageCreditCents),
  );
  const email = roundCents(
    monthlyEmails <= input.emailFreeThreshold
      ? 0
      : input.emailPlanBaseCents +
          Math.ceil(Math.max(0, monthlyEmails - input.emailPlanIncluded) / 1000) *
            input.emailAdditionalThousandCents,
  );
  const optional = input.includeOptionalBudgets
    ? roundCents(
        input.staffAndSupportCents +
          monthlyRevenueCents * input.marketingRate +
          input.securityLegalInsuranceCents +
          input.otherFixedBudgetCents,
      )
    : 0;

  const costLines: ProjectionCostLine[] = [
    { key: "stripe", label: "Payment processing", cents: stripe, behavior: "direct" },
    { key: "bank_sync", label: "Bank sync", cents: bankSync, behavior: "direct" },
    { key: "other_direct", label: "Other per-user / marketplace", cents: otherDirect, behavior: "direct" },
    { key: "supabase", label: "Supabase", cents: supabase, behavior: "threshold" },
    { key: "vercel", label: "Vercel", cents: vercel, behavior: "threshold" },
    { key: "email", label: "Transactional email", cents: email, behavior: "threshold" },
    { key: "optional", label: "Optional company budgets", cents: optional, behavior: "optional" },
  ];
  const totalMonthlyCostCents = costLines.reduce((sum, line) => sum + line.cents, 0);
  const netCashCents = monthlyRevenueCents - totalMonthlyCostCents;
  const variableCostCents = stripe + bankSync + otherDirect +
    Math.max(0, supabase - input.supabaseBaseCents) +
    Math.max(0, vercel - input.vercelPlatformCents) +
    Math.max(0, email - (monthlyEmails > input.emailFreeThreshold ? input.emailPlanBaseCents : 0)) +
    (input.includeOptionalBudgets ? roundCents(monthlyRevenueCents * input.marketingRate) : 0);
  const fixedCostCents = Math.max(0, totalMonthlyCostCents - variableCostCents);
  const contributionPerUser = payingUsers
    ? input.monthlyPriceCents * input.chargesPerPayingUser - variableCostCents / payingUsers
    : input.monthlyPriceCents * input.chargesPerPayingUser;

  return {
    input: { ...input, payingUsers },
    activeUsers,
    monthlyRevenueCents,
    totalMonthlyCostCents,
    netCashCents,
    netMargin: monthlyRevenueCents ? netCashCents / monthlyRevenueCents : 0,
    costPerPayingUserCents: payingUsers ? roundCents(totalMonthlyCostCents / payingUsers) : 0,
    breakEvenPayingUsers:
      contributionPerUser > 0 ? Math.ceil(fixedCostCents / contributionPerUser) : 0,
    databaseGb,
    fileStorageGb,
    supabaseEgressGb,
    vercelTransferGb,
    monthlyEmails,
    costLines,
    capacity: [
      { label: "Monthly active users", used: activeUsers, included: input.supabaseIncludedMau, utilization: input.supabaseIncludedMau ? activeUsers / input.supabaseIncludedMau : 0, unit: "users" },
      { label: "Database storage", used: databaseGb, included: input.supabaseIncludedDatabaseGb, utilization: input.supabaseIncludedDatabaseGb ? databaseGb / input.supabaseIncludedDatabaseGb : 0, unit: "GB" },
      { label: "File storage", used: fileStorageGb, included: input.supabaseIncludedStorageGb, utilization: input.supabaseIncludedStorageGb ? fileStorageGb / input.supabaseIncludedStorageGb : 0, unit: "GB" },
      { label: "Supabase egress", used: supabaseEgressGb, included: input.supabaseIncludedEgressGb, utilization: input.supabaseIncludedEgressGb ? supabaseEgressGb / input.supabaseIncludedEgressGb : 0, unit: "GB/mo" },
    ],
  };
}

export function buildScaleScenarios(input: CostProjectionInput, userCounts = [100, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000]) {
  return userCounts.map((payingUsers) => projectCosts({ ...input, payingUsers }));
}
