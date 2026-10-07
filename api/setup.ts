import {
  addAudit,
  createSession,
  createTenantRecord,
  fail,
  generateCompanyCode,
  hashPassword,
  id,
  loadRootState,
  nowIso,
  normalizeCompanySlug,
  requireMethod,
  sanitizeDatabase,
  saveTenantDatabase,
  saveRootState,
  setSessionCookie,
} from "./_shared.js";
import type {
  Database,
  HandlerRequest,
  HandlerResponse,
  User,
} from "./_shared.js";

export default async function handler(
  req: HandlerRequest,
  res: HandlerResponse,
) {
  if (!requireMethod(req, res, ["POST"])) return;
  try {
    const body = req.body as Partial<{
      pharmacyName: string;
      email: string;
      password: string;
    }>;
    const pharmacyName =
      typeof body.pharmacyName === "string" ? body.pharmacyName.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const branchName = "Main Branch";
    const companySlug = normalizeCompanySlug(pharmacyName);
    if (!pharmacyName || !companySlug || !email || !password) {
      fail(res, 400, "Pharmacy name, email, and password are required");
      return;
    }
    if (pharmacyName.length > 120) {
      fail(res, 400, "Pharmacy name must be 120 characters or fewer");
      return;
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail(res, 400, "Enter a valid email address");
      return;
    }
    if (password.length < 8) {
      fail(res, 400, "Password must be at least 8 characters");
      return;
    }
    const root = await loadRootState();
    if (root.tenants.some((tenant) => tenant.slug === companySlug)) {
      fail(
        res,
        409,
        `The company URL "${companySlug}" has already been claimed`,
      );
      return;
    }
    const { salt, hash } = hashPassword(password);
    const adminId = id("usr");
    const createdAt = nowIso();
    const trialEndsAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const companyCode = generateCompanyCode(pharmacyName);
    const admin: User = {
      id: adminId,
      name: pharmacyName,
      email,
      phone: "",
      role: "admin",
      status: "active",
      branchIds: [],
      managedBranchIds: [],
      passwordHash: hash,
      passwordSalt: salt,
      createdAt,
      approvedAt: createdAt,
      approvedBy: adminId,
    };
    const db: Database = {
      users: [admin],
      medicines: [],
      products: [],
      suppliers: [],
      branches: [],
      batches: [],
      ledger: [],
      stockSnapshot: [],
      ledgerSummary: {
        today: createdAt.slice(0, 10),
        todayMovementCountsByBatchId: {},
        todayMovementCountsByBranchId: {},
        updatedAt: createdAt,
      },
      receipts: [],
      sales: [],
      posDrafts: [],
      chatMessages: [],
      auditLogs: [],
      passwordResetRequests: [],
      securityEvents: [],
      requisitions: [],
      branchAccessRequests: [],
      continuityRequests: [],
      settings: {
        softwareName: "RxLedger",
        accountName: pharmacyName,
        pharmacyName,
        branchName,
        companySlug,
        companyCode,
        businessLicense: "",
        mainBranchAddress: "",
        logoDataUrl: "",
        primaryAdminId: adminId,
        nearExpiryDays: 90,
        approvalThreshold: 25000,
        defaultFollowUpLabel: "Follow-up",
        defaultFollowUpMessage:
          "Please contact the pharmacy if symptoms persist, your condition worsens, or you notice unusual side effects.",
        dosageFormLabelRules: {
          "tablet, tablets, caplet, caplets":
            "Swallow with water unless your prescriber or pharmacist gave different directions.",
          "capsule, capsules":
            "Swallow whole with water unless your prescriber or pharmacist gave different directions.",
          "oral liquid, syrup, suspension, solution":
            "Shake well before use. Measure each dose with an oral syringe, spoon, or cup.",
          "eye drop, eyedrop, ophthalmic":
            "For eye use only. Wash hands before use and avoid touching the dropper tip.",
          "suppository, suppositories": "Insert as directed. Do not swallow.",
        },
        medicineLabelRules: [],
        subscriptionPlanId: "smart-pharmacy",
        trialStartedAt: createdAt,
        trialEndsAt,
      },
    };
    db.branches = [
      {
        id: "main",
        name: branchName,
        code:
          branchName
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 12) || "MAIN",
        address: "",
        managerName: "",
        managerUserId: "",
        phone: "",
        active: true,
        createdAt,
      },
    ];
    addAudit(
      db,
      adminId,
      "Completed first-run RxLedger account setup",
      "system",
      "setup",
    );
    const tenant = createTenantRecord(db, companySlug);
    tenant.code = companyCode;
    tenant.businessLicense = "";
    tenant.mainBranchAddress = "";
    tenant.superAdminName = admin.name;
    tenant.superAdminEmail = admin.email;
    tenant.superAdminPhone = admin.phone;
    root.tenants.unshift(tenant);
    root.defaultSlug = tenant.slug;
    await saveRootState(root);
    await saveTenantDatabase(companySlug, db);
    const session = await createSession(adminId);
    setSessionCookie(res, session);
    res.status(200).json({
      expiresAt: session.expiresAt,
      db: sanitizeDatabase(db),
      currentUser: sanitizeDatabase(db).users[0],
    });
  } catch (error) {
    fail(
      res,
      500,
      error instanceof Error ? error.message : "Unable to set up workspace",
    );
  }
}
