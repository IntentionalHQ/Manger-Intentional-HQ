export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string;
  active: boolean;
};

export type JournalLine = {
  id: string;
  accountId: string;
  debitCents: number;
  creditCents: number;
  description?: string;
};

export type JournalEntry = {
  id: string;
  entryNumber: number;
  entryDate: string;
  memo: string;
  status: "draft" | "posted" | "reversed";
  sourceType: "manual" | "opening_balance" | "bank_import" | "adjustment" | "reversal";
  postedAt: string | null;
  lines: JournalLine[];
};

export type AccountBalance = LedgerAccount & {
  debitCents: number;
  creditCents: number;
  balanceCents: number;
};

export type ProfitAndLoss = {
  revenue: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenueCents: number;
  totalExpenseCents: number;
  netIncomeCents: number;
};

export type BalanceSheet = {
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  statedEquityCents: number;
  currentEarningsCents: number;
  totalEquityCents: number;
  differenceCents: number;
};

export type CostProjectionInput = {
  name: string;
  payingUsers: number;
  monthlyPriceCents: number;
  freeUsersPerPayingUser: number;
  chargesPerPayingUser: number;
  includeOptionalBudgets: boolean;
  bankSyncAdoption: number;
  bankConnectionsPerUser: number;
  bankCostPerConnectionCents: number;
  stripeRate: number;
  stripeFixedFeeCents: number;
  databaseMbPerActiveUser: number;
  fileStorageMbPerActiveUser: number;
  supabaseEgressMbPerActiveUser: number;
  vercelTransferMbPerActiveUser: number;
  emailsPerActiveUser: number;
  functionCallsPerActiveUser: number;
  cpuSecondsPerCall: number;
  functionDurationSeconds: number;
  functionMemoryGb: number;
  supabaseBaseCents: number;
  supabaseIncludedMau: number;
  supabaseAdditionalMauCents: number;
  supabaseIncludedDatabaseGb: number;
  supabaseAdditionalDatabaseGbCents: number;
  supabaseIncludedEgressGb: number;
  supabaseAdditionalEgressGbCents: number;
  supabaseIncludedStorageGb: number;
  supabaseAdditionalStorageGbCents: number;
  supabaseComputeCents: number;
  supabaseComputeCreditCents: number;
  vercelPlatformCents: number;
  vercelUsageCreditCents: number;
  vercelTransferGbCents: number;
  vercelIncludedCalls: number;
  vercelMillionCallsCents: number;
  vercelCpuHourCents: number;
  vercelMemoryGbHourCents: number;
  emailFreeThreshold: number;
  emailPlanBaseCents: number;
  emailPlanIncluded: number;
  emailAdditionalThousandCents: number;
  staffAndSupportCents: number;
  marketingRate: number;
  securityLegalInsuranceCents: number;
  otherFixedBudgetCents: number;
  otherDirectCostPerPayingUserCents: number;
  marketplaceCommissionRate: number;
};

export type ProjectionCostLine = {
  key: string;
  label: string;
  cents: number;
  behavior: "direct" | "threshold" | "fixed" | "optional";
};

export type CostProjection = {
  input: CostProjectionInput;
  activeUsers: number;
  monthlyRevenueCents: number;
  totalMonthlyCostCents: number;
  netCashCents: number;
  netMargin: number;
  costPerPayingUserCents: number;
  breakEvenPayingUsers: number;
  databaseGb: number;
  fileStorageGb: number;
  supabaseEgressGb: number;
  vercelTransferGb: number;
  monthlyEmails: number;
  costLines: ProjectionCostLine[];
  capacity: Array<{
    label: string;
    used: number;
    included: number;
    utilization: number;
    unit: string;
  }>;
};

export type FinanceWorkspace = {
  mode: "preview" | "live" | "setup_required";
  message: string;
  business: {
    id: string;
    name: string;
    currency: string;
    fiscalYearStartMonth: number;
  };
  period: { start: string; end: string; label: string };
  asOfDate: string;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  profitAndLoss: ProfitAndLoss;
  balanceSheet: BalanceSheet;
  trialBalance: AccountBalance[];
  projectionInput: CostProjectionInput;
  actualOperatingCostCents: number;
  unreconciledCount: number;
  lastClosedThrough: string | null;
};
