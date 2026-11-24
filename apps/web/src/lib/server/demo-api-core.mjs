// Synthetic contract server, loopback only. Not Laravel and never a staging substitute.
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
let sessions = new Map();
let invitations = new Map();
let lastInviteToken = "";
let passwordResets = new Map();
let lastResetToken = "";
let rateCards = new Map();
let inspections = new Map();
let maintenanceSchedules = new Map();
let vehicleComponents = new Map();
let fuelTransactions = new Map();
let creditProfiles = new Map();
let collectionNotes = new Map();
let approvalRequests = new Map();
let supplierInvoices = new Map();
let supplierPayments = new Map();
let creditNotes = new Map();
let bankAccounts = new Map();
let bankTransactions = new Map();
let bankReconciliations = new Map();
let fixedAssets = new Map();
let depreciationEntries = new Map();
let leads = new Map();
let incidents = new Map();
let purchaseRequisitions = new Map();
let approvalThresholds = new Map();
let twoFactorState = new Map();
let twoFactorChallenges = new Map();
let customers = new Map();
let vehicles = new Map();
let companies = new Map();
let branches = new Map();
let managedUsers = new Map();
let companySettings = new Map();
let quotations = new Map();
let reservations = new Map();
let rentals = new Map();
let invoices = new Map();
let payments = new Map();
let refunds = new Map();
let expenses = new Map();
let journalEntries = new Map();
let parts = new Map();
let stockMovements = new Map();
let suppliers = new Map();
let purchaseOrders = new Map();
let workOrders = new Map();
let messages = new Map();
let meetings = new Map();
let notifications = new Map();
let auditEvents = new Map();
let savedFilters = new Map();
let documents = new Map();
let documentBlobs = new Map();
let control = {};
let nextId = 20;
let demoSeeded = false;
const SYSTEM_GL_ACCOUNTS = [
  { id: 1, code: "1000", name: "Cash & Bank", type: "asset", is_system: true },
  { id: 2, code: "1100", name: "Accounts Receivable", type: "asset", is_system: true },
  { id: 3, code: "1200", name: "Spare Parts Inventory", type: "asset", is_system: true },
  { id: 4, code: "1250", name: "Maintenance Work-in-Progress", type: "asset", is_system: true },
  { id: 5, code: "2000", name: "Supplier Payables", type: "liability", is_system: true },
  { id: 6, code: "2100", name: "VAT Payable", type: "liability", is_system: true },
  { id: 7, code: "4000", name: "Rental Revenue", type: "revenue", is_system: true },
  { id: 8, code: "4100", name: "Sales Refunds & Credits", type: "revenue", is_system: true },
  { id: 9, code: "5000", name: "Fleet & Operating Expenses", type: "expense", is_system: true },
  { id: 10, code: "1500", name: "Fleet & Fixed Assets", type: "asset", is_system: true },
  { id: 11, code: "1590", name: "Accumulated Depreciation", type: "asset", is_system: true },
  { id: 12, code: "3000", name: "Retained Earnings / Equity", type: "equity", is_system: true },
  { id: 13, code: "4900", name: "Gain on Asset Disposal", type: "revenue", is_system: true },
  { id: 14, code: "5500", name: "Depreciation Expense", type: "expense", is_system: true },
  { id: 15, code: "5600", name: "Bank Charges", type: "expense", is_system: true },
  { id: 16, code: "5900", name: "Loss on Asset Disposal", type: "expense", is_system: true },
];
let collectionReads = 0;
let completedWrites = 0;
const stamp = "2026-11-15T10:00:00Z";
const base = {
  company_id: 1,
  branch_id: 2,
  created_at: stamp,
  updated_at: stamp,
};
const ROLE_DEFS = [
  {
    name: "company-admin",
    permissions: [
      "companies.view",
      "companies.manage",
      "branches.view",
      "branches.manage",
      "customers.view",
      "customers.manage",
      "vehicles.view",
      "vehicles.manage",
      "reservations.view",
      "reservations.manage",
      "rentals.view",
      "rentals.manage",
      "documents.view",
      "documents.manage",
      "users.view",
      "users.manage",
      "settings.manage",
      "quotations.view",
      "quotations.manage",
      "quotations.approve_discount",
      "invoices.view",
      "invoices.manage",
      "payments.manage",
      "expenses.view",
      "expenses.manage",
      "gl.view",
      "work_orders.view",
      "work_orders.manage",
      "parts.view",
      "parts.manage",
      "suppliers.view",
      "suppliers.manage",
      "purchase_orders.view",
      "purchase_orders.manage",
      "purchase_orders.approve",
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
      "reports.view",
      "audit.view",
    ],
  },
  { name: "driver", permissions: ["companies.view", "branches.view"] },
  {
    name: "finance",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "vehicles.view",
      "reservations.view",
      "rentals.view",
      "documents.view",
      "quotations.view",
      "quotations.approve_discount",
      "invoices.view",
      "invoices.manage",
      "payments.manage",
      "expenses.view",
      "expenses.manage",
      "gl.view",
      "work_orders.view",
      "parts.view",
      "suppliers.view",
      "purchase_orders.view",
      "purchase_orders.approve",
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
      "reports.view",
    ],
  },
  {
    name: "operations",
    permissions: [
      "customers.view",
      "customers.manage",
      "vehicles.view",
      "vehicles.manage",
      "quotations.view",
      "quotations.manage",
      "reservations.view",
      "reservations.manage",
      "rentals.view",
      "rentals.manage",
      "documents.view",
      "documents.manage",
      "work_orders.view",
      "work_orders.manage",
      "parts.view",
      "parts.manage",
      "suppliers.view",
      "suppliers.manage",
      "purchase_orders.view",
      "purchase_orders.manage",
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
      "reports.view",
    ],
  },
  {
    name: "viewer",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "vehicles.view",
      "quotations.view",
      "reservations.view",
      "rentals.view",
      "documents.view",
      "invoices.view",
      "expenses.view",
      "work_orders.view",
      "parts.view",
      "suppliers.view",
      "purchase_orders.view",
      "messages.view",
      "meetings.view",
      "reports.view",
    ],
  },
  {
    name: "ceo",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "vehicles.view",
      "leads.view",
      "quotations.view",
      "quotations.approve_discount",
      "reservations.view",
      "rentals.view",
      "documents.view",
      "invoices.view",
      "expenses.view",
      "gl.view",
      "work_orders.view",
      "parts.view",
      "suppliers.view",
      "purchase_orders.view",
      "purchase_orders.approve",
      "messages.view",
      "meetings.view",
      "meetings.manage",
      "reports.view",
      "audit.view",
    ],
  },
  {
    name: "general-manager",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "vehicles.view",
      "leads.view",
      "quotations.view",
      "quotations.approve_discount",
      "reservations.view",
      "rentals.view",
      "documents.view",
      "invoices.view",
      "expenses.view",
      "gl.view",
      "work_orders.view",
      "parts.view",
      "suppliers.view",
      "purchase_orders.view",
      "purchase_orders.approve",
      "messages.view",
      "meetings.view",
      "meetings.manage",
      "reports.view",
    ],
  },
  {
    name: "business-accounts-manager",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "customers.manage",
      "vehicles.view",
      "leads.view",
      "leads.manage",
      "quotations.view",
      "quotations.manage",
      "reservations.view",
      "reservations.manage",
      "rentals.view",
      "documents.view",
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
      "reports.view",
    ],
  },
  {
    name: "operations-manager",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "customers.manage",
      "vehicles.view",
      "vehicles.manage",
      "reservations.view",
      "reservations.manage",
      "rentals.view",
      "rentals.manage",
      "documents.view",
      "documents.manage",
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
      "reports.view",
    ],
  },
  {
    name: "maintenance-manager",
    permissions: [
      "companies.view",
      "branches.view",
      "vehicles.view",
      "work_orders.view",
      "work_orders.manage",
      "parts.view",
      "parts.manage",
      "suppliers.view",
      "suppliers.manage",
      "purchase_orders.view",
      "purchase_orders.manage",
      "documents.view",
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
      "reports.view",
    ],
  },
  {
    name: "finance-manager",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "vehicles.view",
      "quotations.view",
      "quotations.approve_discount",
      "reservations.view",
      "rentals.view",
      "documents.view",
      "invoices.view",
      "invoices.manage",
      "payments.manage",
      "expenses.view",
      "expenses.manage",
      "gl.view",
      "purchase_orders.view",
      "purchase_orders.approve",
      "meetings.view",
      "meetings.manage",
      "reports.view",
    ],
  },
  {
    name: "credit-control-manager",
    permissions: [
      "companies.view",
      "branches.view",
      "customers.view",
      "invoices.view",
      "documents.view",
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
      "reports.view",
    ],
  },
  {
    name: "hr-admin-manager",
    permissions: [
      "companies.view",
      "branches.view",
      "users.view",
      "users.manage",
      "documents.view",
      "documents.manage",
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
    ],
  },
  {
    name: "mechanic-technician",
    permissions: [
      "companies.view",
      "branches.view",
      "vehicles.view",
      "work_orders.view",
      "work_orders.manage",
      "parts.view",
      "meetings.view",
      "meetings.manage",
    ],
  },
  {
    name: "system-administrator",
    permissions: [
      "companies.view",
      "companies.manage",
      "branches.view",
      "branches.manage",
      "users.view",
      "users.manage",
      "roles.view",
      "settings.manage",
      "audit.view",
      "customers.view",
      "customers.manage",
      "vehicles.view",
      "vehicles.manage",
      "leads.view",
      "leads.manage",
      "quotations.view",
      "quotations.manage",
      "quotations.approve_discount",
      "reservations.view",
      "reservations.manage",
      "rentals.view",
      "rentals.manage",
      "documents.view",
      "documents.manage",
      "invoices.view",
      "invoices.manage",
      "payments.manage",
      "expenses.view",
      "expenses.manage",
      "gl.view",
      "work_orders.view",
      "work_orders.manage",
      "parts.view",
      "parts.manage",
      "suppliers.view",
      "suppliers.manage",
      "purchase_orders.view",
      "purchase_orders.manage",
      "purchase_orders.approve",
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
      "reports.view",
    ],
  },
  {
    name: "driver",
    permissions: ["companies.view", "branches.view"],
  },
];

function reset() {
  companies = new Map([
    [1, { id: 1, name: "Synthetic One", currency: "ZMW" }],
    [3, { id: 3, name: "Synthetic Three", currency: "EUR" }],
  ]);
  companySettings = new Map([
    [
      1,
      {
        company_id: 1,
        currency: "ZMW",
        vat_rate_pct: 15,
        discount_approval_threshold_pct: 10,
      },
    ],
    [
      3,
      {
        company_id: 3,
        currency: "EUR",
        vat_rate_pct: 15,
        discount_approval_threshold_pct: 10,
      },
    ],
  ]);
  quotations = new Map();
  invoices = new Map();
  payments = new Map();
  refunds = new Map();
  expenses = new Map();
  journalEntries = new Map();
  parts = new Map();
  stockMovements = new Map();
  suppliers = new Map();
  purchaseOrders = new Map();
  workOrders = new Map();
  messages = new Map();
  meetings = new Map();
  notifications = new Map([
    [
      900,
      {
        id: 900,
        company_id: 1,
        branch_id: 2,
        required_permission: "rentals.view",
        severity: "info",
        title: "Rental #600 active handover logged",
        body: "Vehicle SYN-11 is currently on active rental.",
        href: "/companies/1/rentals/600?branch=2",
        read_by: [],
        created_at: stamp,
      },
    ],
  ]);
  auditEvents = new Map([
    [
      950,
      {
        id: 950,
        company_id: 1,
        actor_name: "Synthetic operator",
        action: "rental.handed_over",
        entity_type: "rental",
        entity_id: 600,
        summary: "Handed over Rental #600 (SYN-11) at 50 km.",
        created_at: stamp,
      },
    ],
  ]);
  savedFilters = new Map();
  invitations = new Map();
  lastInviteToken = "";
  passwordResets = new Map();
  lastResetToken = "";
  rateCards = new Map();
  inspections = new Map();
  maintenanceSchedules = new Map();
  vehicleComponents = new Map();
  fuelTransactions = new Map();
  creditProfiles = new Map();
  collectionNotes = new Map();
  approvalRequests = new Map();
  supplierInvoices = new Map();
  supplierPayments = new Map();
  creditNotes = new Map();
  bankAccounts = new Map();
  bankTransactions = new Map();
  bankReconciliations = new Map();
  fixedAssets = new Map();
  depreciationEntries = new Map();
  leads = new Map();
  incidents = new Map();
  purchaseRequisitions = new Map();
  approvalThresholds = new Map();
  twoFactorState = new Map();
  twoFactorChallenges = new Map();
  branches = new Map([
    [2, { id: 2, company_id: 1, name: "Synthetic branch" }],
    [4, { id: 4, company_id: 3, name: "Other branch" }],
  ]);
  sessions = new Map();
  control = {};
  collectionReads = 0;
  completedWrites = 0;
  nextId = 20;
  demoSeeded = false;
  customers = new Map([
    [
      10,
      {
        ...base,
        id: 10,
        name: "Synthetic customer",
        type: "individual",
        email: "customer10@example.test",
        phone: "+233 20 000 0010",
      },
    ],
    [
      11,
      {
        ...base,
        id: 11,
        name: "Apex Corporate Fleet",
        type: "corporate",
        email: "fleet@apex.test",
        phone: "+233 20 000 0011",
      },
    ],
    [
      12,
      {
        ...base,
        id: 12,
        company_id: 3,
        branch_id: 4,
        name: "Other company customer",
        type: "individual",
        email: null,
        phone: null,
      },
    ],
  ]);
  vehicles = new Map([
    [
      10,
      {
        ...base,
        id: 10,
        registration: "SYN-10",
        make: "Synthetic",
        model: "Fixture",
        year: null,
        odometer: 10,
        odometer_unit: "km",
        daily_rate_minor: 45000,
        functions: ["gps_tracker", "automatic"],
        status: "available",
      },
    ],
    [
      11,
      {
        ...base,
        id: 11,
        registration: "SYN-11",
        make: "Synthetic",
        model: "Rented",
        year: 2024,
        odometer: 50,
        odometer_unit: "km",
        daily_rate_minor: 0,
        functions: [],
        status: "rented",
      },
    ],
    [
      12,
      {
        ...base,
        id: 12,
        company_id: 3,
        branch_id: 4,
        registration: "OTH-12",
        make: "Other",
        model: "CompanyCar",
        year: 2023,
        odometer: 200,
        odometer_unit: "km",
        daily_rate_minor: 60000,
        functions: ["awd_4x4"],
        status: "available",
      },
    ],
  ]);
  managedUsers = new Map([
    [
      1,
      {
        id: 1,
        name: "Synthetic operator",
        email: "companyadmin@example.test",
        is_active: true,
        is_platform_admin: false,
        roles: ["company-admin"],
        memberships: [{ company_id: 1, branch_id: null }],
      },
    ],
    [
      2,
      {
        id: 2,
        name: "Fleet Driver",
        email: "driver-co1@example.test",
        is_active: true,
        is_platform_admin: false,
        roles: ["driver"],
        memberships: [{ company_id: 1, branch_id: 2 }],
      },
    ],
    [
      3,
      {
        id: 3,
        name: "Branch Viewer",
        email: "viewer-co1@example.test",
        is_active: false,
        is_platform_admin: false,
        roles: ["viewer"],
        memberships: [{ company_id: 1, branch_id: 2 }],
      },
    ],
    [
      4,
      {
        id: 4,
        name: "Shared Operator",
        email: "shared@example.test",
        is_active: true,
        is_platform_admin: false,
        roles: ["operations"],
        memberships: [
          { company_id: 1, branch_id: null },
          { company_id: 3, branch_id: null },
        ],
      },
    ],
  ]);
  const now = Date.now();
  const iso = (hoursOffset) => new Date(now + hoursOffset * 3600000).toISOString();
  reservations = new Map([
    [
      500,
      {
        ...base,
        id: 500,
        customer_id: 10,
        vehicle_id: 10,
        created_by: 1,
        starts_at: iso(-2),
        ends_at: iso(48),
        status: "confirmed",
      },
    ],
    [
      501,
      {
        ...base,
        id: 501,
        customer_id: 11,
        vehicle_id: 11,
        created_by: 1,
        starts_at: iso(-24),
        ends_at: iso(-1),
        status: "confirmed",
      },
    ],
    [
      502,
      {
        ...base,
        id: 502,
        customer_id: 10,
        vehicle_id: 10,
        created_by: 1,
        starts_at: iso(1440),
        ends_at: iso(1488),
        status: "confirmed",
      },
    ],
  ]);
  rentals = new Map([
    [
      600,
      {
        ...base,
        id: 600,
        reservation_id: 501,
        vehicle_id: 11,
        driver_user_id: 2,
        status: "active",
        handed_over_at: iso(-23),
        returned_at: null,
        handover_odometer: 50,
        return_odometer: null,
        handover_notes: "Outbound check complete.",
        return_notes: null,
      },
    ],
    [
      601,
      {
        ...base,
        id: 601,
        reservation_id: 502,
        vehicle_id: 10,
        driver_user_id: null,
        status: "draft",
        handed_over_at: null,
        returned_at: null,
        handover_odometer: null,
        return_odometer: null,
        handover_notes: null,
        return_notes: null,
      },
    ],
  ]);
  documents = new Map([
    [
      700,
      {
        ...base,
        id: 700,
        uploaded_by: 1,
        entity_type: "vehicle",
        entity_id: 10,
        original_name: "insurance-policy.pdf",
        mime_type: "application/pdf",
        size: 1024,
        expires_at: iso(240),
      },
    ],
  ]);
  documentBlobs = new Map([
    [700, Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF", "utf8")],
  ]);
}
reset();

function defaultApprovalThresholds() {
  return [
    { type: "discount", threshold_minor: null, threshold_pct: 10, approver_role: "finance-manager", is_active: true },
    { type: "purchase_order", threshold_minor: 500000, threshold_pct: null, approver_role: "finance-manager", is_active: true },
    { type: "expense", threshold_minor: 250000, threshold_pct: null, approver_role: "finance-manager", is_active: true },
    { type: "credit_limit", threshold_minor: 1000000, threshold_pct: null, approver_role: "credit-control-manager", is_active: true },
    { type: "credit_note", threshold_minor: 100000, threshold_pct: null, approver_role: "finance-manager", is_active: true },
    { type: "vehicle_repair", threshold_minor: 300000, threshold_pct: null, approver_role: "maintenance-manager", is_active: true },
    { type: "vehicle_disposal", threshold_minor: 0, threshold_pct: null, approver_role: "ceo", is_active: true },
  ];
}

function seedDemo() {
  reset();
  const now = Date.now();
  const iso = (hoursOffset) => new Date(now + hoursOffset * 3600000).toISOString();
  const day = (daysOffset) => new Date(now + daysOffset * 86400000).toISOString().slice(0, 10);
  const demoBase = { company_id: 1, branch_id: 2, created_at: iso(-240), updated_at: iso(-12) };

  companies = new Map([
    [1, { id: 1, name: "DriveCore Solutions Ghana Ltd", currency: "GHS" }],
  ]);
  branches = new Map([
    [2, { id: 2, company_id: 1, name: "Accra Airport HQ" }],
    [5, { id: 5, company_id: 1, name: "Kumasi Branch" }],
  ]);
  companySettings = new Map([
    [
      1,
      {
        company_id: 1,
        currency: "GHS",
        vat_rate_pct: 15,
        discount_approval_threshold_pct: 10,
        require_inspection_photos: false,
        distance_unit: "km",
        volume_unit: "l",
        fuel_efficiency_unit: "l_per_100km",
        weight_unit: "kg",
        require_2fa_for_privileged: false,
      },
    ],
  ]);
  approvalThresholds.set(1, defaultApprovalThresholds());

  managedUsers = new Map([
    [1, { id: 1, name: "Kofi Yeboah (System Admin)", email: "sysadmin@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["system-administrator"], memberships: [{ company_id: 1, branch_id: null }] }],
    [2, { id: 2, name: "Yaw Boateng (Fleet Driver)", email: "activedriver@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["driver"], memberships: [{ company_id: 1, branch_id: 2 }] }],
    [3, { id: 3, name: "Ama Osei (Operations Mgr)", email: "opsmanager@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["operations-manager"], memberships: [{ company_id: 1, branch_id: null }] }],
    [4, { id: 4, name: "Efua Appiah (Finance Mgr)", email: "financemanager@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["finance-manager"], memberships: [{ company_id: 1, branch_id: null }] }],
    [5, { id: 5, name: "Kojo Tetteh (Lead Mechanic)", email: "mechanic@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["mechanic-technician"], memberships: [{ company_id: 1, branch_id: 2 }] }],
    [6, { id: 6, name: "Nana Akufo (CEO)", email: "ceo@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["ceo"], memberships: [{ company_id: 1, branch_id: null }] }],
    [7, { id: 7, name: "Abena Darko (Business Accounts)", email: "businessaccounts@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["business-accounts-manager"], memberships: [{ company_id: 1, branch_id: null }] }],
    [8, { id: 8, name: "Akua Sarpong (HR / Admin)", email: "hradmin@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["hr-admin-manager"], memberships: [{ company_id: 1, branch_id: null }] }],
    [9, { id: 9, name: "Kwabena Owusu (Maintenance Mgr)", email: "maintmanager@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["maintenance-manager"], memberships: [{ company_id: 1, branch_id: null }] }],
    [10, { id: 10, name: "Esi Koomson (Credit Control)", email: "creditcontrol@drivecore.demo", is_active: true, is_platform_admin: false, roles: ["credit-control-manager"], memberships: [{ company_id: 1, branch_id: null }] }],
  ]);

  customers = new Map([
    [10, { ...demoBase, id: 10, name: "GoldFields Mining Services Ltd", type: "corporate", email: "fleet@goldfields.demo", phone: "+233 30 274 1100", company_registration: "CS-2016-88412", tin: "C0019283741", contact_person_name: "Daniel Asante", contact_person_phone: "+233 24 411 2200", billing_address: "Plot 14 Liberation Rd, Airport City, Accra", credit_limit_minor: 5000000, payment_terms_days: 30 }],
    [11, { ...demoBase, id: 11, name: "Atlantic Energy Ghana Ltd", type: "corporate", email: "procurement@atlanticenergy.demo", phone: "+233 30 278 4410", company_registration: "CS-2019-41029", tin: "C0044128910", contact_person_name: "Grace Owusu", contact_person_phone: "+233 20 882 9911", billing_address: "8 Ridge Towers, North Ridge, Accra", credit_limit_minor: 3500000, payment_terms_days: 30 }],
    [12, { ...demoBase, id: 12, branch_id: 5, name: "Ashanti Infrastructure Consult", type: "corporate", email: "ops@ashanticonsult.demo", phone: "+233 32 204 5100", company_registration: "CS-2021-19044", tin: "C0098123114", contact_person_name: "Samuel Frimpong", contact_person_phone: "+233 24 900 3312", billing_address: "22 Harper Road, Adum, Kumasi", credit_limit_minor: 2000000, payment_terms_days: 15 }],
    [13, { ...demoBase, id: 13, name: "Kwame Nkrumah-Yeboah", type: "individual", email: "kwame.yeboah@demo.gh", phone: "+233 24 555 0192", id_number: "GHA-719283741-2", driver_licence_number: "DL-ACC-2024-9910", driver_licence_expires_at: day(420), billing_address: "18 Cantonments Crescent, Accra" }],
    [14, { ...demoBase, id: 14, name: "Abena Serwaa Boateng", type: "individual", email: "abena.boateng@demo.gh", phone: "+233 20 612 8840", id_number: "GHA-882910344-7", driver_licence_number: "DL-ACC-2025-4418", driver_licence_expires_at: day(20), billing_address: "42 East Legon Hills, Accra" }],
  ]);

  vehicles = new Map([
    [10, { ...demoBase, id: 10, registration: "GW-4821-24", vin: "JTEBU3FJ7PK294821", make: "Toyota", model: "Land Cruiser Prado", year: 2024, category: "suv", fuel_type: "diesel", transmission: "automatic", current_location: "Accra Airport Bay 1", odometer: 28450, odometer_unit: "km", daily_rate_minor: 185000, functions: ["awd_4x4", "automatic", "gps_tracker", "chauffeur_ready"], status: "available", acquisition_date: "2024-03-15", acquisition_cost_minor: 85000000, financing_type: "loan", financing_provider: "Stanbic Asset Finance", financing_monthly_minor: 1950000, financing_end_date: "2028-03-15", current_book_value_minor: 68000000, residual_value_minor: 25000000, insurance_provider: "Enterprise Insurance", insurance_policy_number: "ENT-COMP-2026-4821", insurance_expires_at: day(210), roadworthy_expires_at: day(18), licence_expires_at: day(145) }],
    [11, { ...demoBase, id: 11, registration: "GE-9104-23", vin: "MROHA3CD102199104", make: "Toyota", model: "Hilux Double Cab 4x4", year: 2023, category: "pickup_4x4", fuel_type: "diesel", transmission: "manual", current_location: "GoldFields Tarkwa Site", odometer: 64210, odometer_unit: "km", daily_rate_minor: 145000, functions: ["awd_4x4", "mining_spec", "gps_tracker"], status: "rented", acquisition_date: "2023-06-10", acquisition_cost_minor: 54000000, financing_type: "finance_lease", financing_provider: "Ecobank Leasing", financing_monthly_minor: 1250000, financing_end_date: "2027-06-10", current_book_value_minor: 39600000, residual_value_minor: 15000000, insurance_provider: "SIC Insurance", insurance_policy_number: "SIC-FLT-9104", insurance_expires_at: day(160), roadworthy_expires_at: day(95), licence_expires_at: day(160) }],
    [12, { ...demoBase, id: 12, registration: "GR-3310-25", vin: "W1KZF8DB9SA033310", make: "Mercedes-Benz", model: "E 300 Executive", year: 2025, category: "luxury", fuel_type: "petrol", transmission: "automatic", current_location: "Accra Airport VIP Lounge", odometer: 11200, odometer_unit: "km", daily_rate_minor: 260000, functions: ["automatic", "chauffeur_ready", "airport_vip"], status: "available", acquisition_date: "2025-01-20", acquisition_cost_minor: 112000000, financing_type: "cash_purchase", financing_provider: null, financing_monthly_minor: null, financing_end_date: null, current_book_value_minor: 98500000, residual_value_minor: 40000000, insurance_provider: "Enterprise Insurance", insurance_policy_number: "ENT-VIP-3310", insurance_expires_at: day(310), roadworthy_expires_at: day(290), licence_expires_at: day(310) }],
    [13, { ...demoBase, id: 13, registration: "GT-7742-22", vin: "JTFSX23P206077742", make: "Toyota", model: "HiAce Commuter 15-Seater", year: 2022, category: "van_minibus", fuel_type: "diesel", transmission: "manual", current_location: "Accra Main Workshop Bay 2", odometer: 118400, odometer_unit: "km", daily_rate_minor: 165000, functions: ["passenger_van", "ac_dual_zone"], status: "maintenance", acquisition_date: "2022-05-01", acquisition_cost_minor: 49000000, financing_type: "cash_purchase", financing_provider: null, financing_monthly_minor: null, financing_end_date: null, current_book_value_minor: 29400000, residual_value_minor: 12000000, insurance_provider: "Hollard Ghana", insurance_policy_number: "HOL-BUS-7742", insurance_expires_at: day(-5), roadworthy_expires_at: day(45), licence_expires_at: day(80) }],
    [14, { ...demoBase, id: 14, branch_id: 5, registration: "AS-5518-24", vin: "JTDKBRFU9R3055518", make: "Toyota", model: "Corolla Cross Hybrid", year: 2024, category: "suv", fuel_type: "hybrid", transmission: "cvt", current_location: "Kumasi Branch Yard", odometer: 19300, odometer_unit: "km", daily_rate_minor: 110000, functions: ["automatic", "fuel_saver", "gps_tracker"], status: "available", acquisition_date: "2024-08-01", acquisition_cost_minor: 42000000, financing_type: "operating_lease", financing_provider: "CalBank Fleet", financing_monthly_minor: 980000, financing_end_date: "2027-08-01", current_book_value_minor: 37800000, residual_value_minor: 14000000, insurance_provider: "Enterprise Insurance", insurance_policy_number: "ENT-KUM-5518", insurance_expires_at: day(240), roadworthy_expires_at: day(210), licence_expires_at: day(240) }],
    [15, { ...demoBase, id: 15, registration: "GW-6090-23", vin: "6FPPXXMJ2PN606090", make: "Ford", model: "Ranger Wildtrak 4x4", year: 2023, category: "pickup_4x4", fuel_type: "diesel", transmission: "automatic", current_location: "Bodyshop Yard", odometer: 51800, odometer_unit: "km", daily_rate_minor: 160000, functions: ["awd_4x4", "automatic", "tow_bar"], status: "awaiting_repair", acquisition_date: "2023-09-12", acquisition_cost_minor: 62000000, financing_type: "loan", financing_provider: "Stanbic Asset Finance", financing_monthly_minor: 1420000, financing_end_date: "2027-09-12", current_book_value_minor: 48200000, residual_value_minor: 18000000, insurance_provider: "Enterprise Insurance", insurance_policy_number: "ENT-4X4-6090", insurance_expires_at: day(120), roadworthy_expires_at: day(90), licence_expires_at: day(120) }],
  ]);

  rateCards = new Map([
    [100, { id: 100, company_id: 1, branch_id: 2, customer_id: 10, customer_name: "GoldFields Mining Services Ltd", name: "Mining Spec 4x4 Corporate Tariff", vehicle_category: "pickup_4x4", daily_rate_minor: 145000, weekly_rate_minor: 920000, monthly_rate_minor: 3600000, chauffeur_daily_minor: 35000, daily_km_limit: 250, excess_km_rate_minor: 450, security_deposit_minor: 500000, late_return_hourly_minor: 25000, fuel_policy: "full_to_full", is_active: true, created_at: iso(-200) }],
    [101, { id: 101, company_id: 1, branch_id: 2, customer_id: null, customer_name: null, name: "Executive VIP Airport Chauffeur", vehicle_category: "luxury", daily_rate_minor: 260000, weekly_rate_minor: 1650000, monthly_rate_minor: 6200000, chauffeur_daily_minor: 45000, daily_km_limit: 200, excess_km_rate_minor: 650, security_deposit_minor: 1000000, late_return_hourly_minor: 40000, fuel_policy: "full_to_full", is_active: true, created_at: iso(-180) }],
  ]);

  leads = new Map([
    [110, { id: 110, company_id: 1, branch_id: 2, contact_name: "Dr. Michael Addo", company_name: "West Africa Infrastructure Partners", email: "m.addo@waip.demo", phone: "+233 24 881 4400", source: "corporate_rfq", stage: "qualified", estimated_value_minor: 4200000, vehicle_requirements: "3x Land Cruiser Prado + 1x HiAce for 14-day project site tour", assigned_to_user_id: 7, assigned_to_name: "Abena Darko (Business Accounts)", customer_id: null, quotation_id: null, lost_reason: null, notes: "Requires mining-spec safety kit and vetted chauffeurs.", created_at: iso(-72), updated_at: iso(-10) }],
    [111, { id: 111, company_id: 1, branch_id: 2, contact_name: "Sophia Yeboah", company_name: "Accra Diplomatic Summit Secretariat", email: "protocol@summit.demo", phone: "+233 20 912 3300", source: "referral", stage: "proposal_sent", estimated_value_minor: 6500000, vehicle_requirements: "2x Mercedes E-Class Executive + 2x Prado VIP", assigned_to_user_id: 7, assigned_to_name: "Abena Darko (Business Accounts)", customer_id: 11, quotation_id: 120, lost_reason: null, notes: "Proposal submitted; awaiting protocol director sign-off.", created_at: iso(-120), updated_at: iso(-6) }],
    [112, { id: 112, company_id: 1, branch_id: 5, contact_name: "Isaac Ofori", company_name: "Kumasi AgroLogistics", email: "iofori@agrologistics.demo", phone: "+233 24 300 7721", source: "website", stage: "new", estimated_value_minor: 1800000, vehicle_requirements: "2x Hilux 4x4 for regional audit", assigned_to_user_id: 7, assigned_to_name: "Abena Darko (Business Accounts)", customer_id: null, quotation_id: null, lost_reason: null, notes: "Requested call back tomorrow morning.", created_at: iso(-18), updated_at: iso(-18) }],
  ]);

  quotations = new Map([
    [120, { id: 120, company_id: 1, branch_id: 2, customer_id: 11, created_by: 7, status: "approved", starts_at: iso(48), ends_at: iso(168), rental_days: 5, subtotal_minor: 2225000, discount_pct: 5, discount_minor: 111250, vat_rate_pct: 15, vat_minor: 317063, total_minor: 2430813, discount_status: "not_required", discount_decided_by: null, discount_decided_by_name: null, discount_decided_at: null, discount_decision_notes: null, customer_accepted_at: null, customer_acceptance_ref: null, notes: "VIP delegation airport transfer & conference fleet.", vehicles: [{ vehicle_id: 10, registration: "GW-4821-24", make: "Toyota", model: "Land Cruiser Prado", daily_rate_minor: 185000, line_subtotal_minor: 925000, reservation_id: null }, { vehicle_id: 12, registration: "GR-3310-25", make: "Mercedes-Benz", model: "E 300 Executive", daily_rate_minor: 260000, line_subtotal_minor: 1300000, reservation_id: null }], reservation_ids: [], created_at: iso(-36), updated_at: iso(-12) }],
    [121, { id: 121, company_id: 1, branch_id: 2, customer_id: 10, created_by: 7, status: "pending_approval", starts_at: iso(72), ends_at: iso(312), rental_days: 10, subtotal_minor: 1850000, discount_pct: 18, discount_minor: 333000, vat_rate_pct: 15, vat_minor: 227550, total_minor: 1744550, discount_status: "pending", discount_decided_by: null, discount_decided_by_name: null, discount_decided_at: null, discount_decision_notes: null, customer_accepted_at: null, customer_acceptance_ref: null, notes: "Long-term corporate loyalty discount request (18%).", vehicles: [{ vehicle_id: 10, registration: "GW-4821-24", make: "Toyota", model: "Land Cruiser Prado", daily_rate_minor: 185000, line_subtotal_minor: 1850000, reservation_id: null }], reservation_ids: [], created_at: iso(-20), updated_at: iso(-20) }],
  ]);

  reservations = new Map([
    [500, { ...demoBase, id: 500, customer_id: 10, vehicle_id: 10, created_by: 3, starts_at: iso(2), ends_at: iso(74), status: "confirmed" }],
    [501, { ...demoBase, id: 501, customer_id: 11, vehicle_id: 11, created_by: 3, starts_at: iso(-72), ends_at: iso(48), status: "confirmed" }],
    [502, { ...demoBase, id: 502, customer_id: 13, vehicle_id: 12, created_by: 3, starts_at: iso(-168), ends_at: iso(-96), status: "completed" }],
  ]);

  rentals = new Map([
    [600, { ...demoBase, id: 600, reservation_id: 501, vehicle_id: 11, driver_user_id: 2, status: "active", handed_over_at: iso(-70), returned_at: null, handover_odometer: 63800, return_odometer: null, handover_notes: "Full tank, mining beacon & spare tyre verified.", return_notes: null, security_deposit_minor: 500000, deposit_status: "held" }],
    [601, { ...demoBase, id: 601, reservation_id: 500, vehicle_id: 10, driver_user_id: 2, status: "draft", handed_over_at: null, returned_at: null, handover_odometer: null, return_odometer: null, handover_notes: null, return_notes: null, security_deposit_minor: 350000, deposit_status: "held" }],
    [602, { ...demoBase, id: 602, reservation_id: 502, vehicle_id: 12, driver_user_id: 2, status: "returned", handed_over_at: iso(-167), returned_at: iso(-97), handover_odometer: 10720, return_odometer: 11200, handover_notes: "Clean VIP handover at Kotoka Terminal 3.", return_notes: "Returned clean with full tank.", security_deposit_minor: 1000000, deposit_status: "refunded" }],
  ]);

  inspections = new Map([
    [130, { id: 130, company_id: 1, branch_id: 2, rental_id: 600, vehicle_id: 11, type: "handover", odometer: 63800, fuel_level_pct: 100, exterior_ok: true, interior_ok: true, tyres_ok: true, spare_tyre_ok: true, tools_ok: true, accessories_ok: true, documents_ok: true, damage_notes: "No pre-existing dents.", customer_acknowledged_by: "Grace Owusu", customer_acknowledged: true, inspected_by: 3, inspected_by_name: "Ama Osei (Operations Mgr)", created_at: iso(-70) }],
  ]);

  workOrders = new Map([
    [140, { id: 140, company_id: 1, branch_id: 2, vehicle_id: 13, created_by: 9, assigned_to: 5, title: "120,000 km Major Service & Brake Overhaul", description: "Replace front & rear brake pads, engine oil, oil filter, and inspect suspension bushings.", status: "in_progress", priority: "high", due_at: day(3), started_at: iso(-14), completed_at: null, odometer_at_service: 118400, labor_cost_minor: 125000, parts_cost_minor: 185000, total_cost_minor: 310000, notes: "Parts issued from Accra store.", items: [{ id: 1, part_id: 200, sku: "FLT-TOY-001", name: "Toyota Genuine Oil Filter", quantity: 2, unit_cost_minor: 25000, line_total_minor: 50000 }, { id: 2, part_id: 201, sku: "BRK-PAD-004", name: "Heavy-Duty Ceramic Brake Pads", quantity: 1, unit_cost_minor: 135000, line_total_minor: 135000 }], created_at: iso(-24), updated_at: iso(-6) }],
    [141, { id: 141, company_id: 1, branch_id: 2, vehicle_id: 10, created_by: 9, assigned_to: 5, title: "30,000 km Routine Oil & Filter Service", description: "Synthetic 5W-30 oil change and multi-point safety inspection.", status: "completed", priority: "normal", due_at: day(-10), started_at: iso(-260), completed_at: iso(-250), odometer_at_service: 27900, labor_cost_minor: 65000, parts_cost_minor: 55000, total_cost_minor: 120000, notes: "Passed road safety test.", items: [], created_at: iso(-270), updated_at: iso(-250) }],
  ]);

  incidents = new Map([
    [150, { id: 150, company_id: 1, branch_id: 2, vehicle_id: 15, vehicle_registration: "GW-6090-23", rental_id: null, driver_name: "Yaw Boateng (Fleet Driver)", incident_type: "accident", severity: "moderate", occurred_at: day(-4), location: "Tema Motorway Km 11", description: "Rear-bumper impact in rain traffic; taillight assembly cracked.", insurance_claim_number: "CLM-ENT-2026-0842", estimated_cost_minor: 480000, work_order_id: null, status: "assessing", created_at: iso(-96) }],
  ]);

  maintenanceSchedules = new Map([
    [160, { id: 160, company_id: 1, branch_id: 2, vehicle_id: 11, service_name: "10,000 km Engine Oil & Filter", interval_km: 10000, interval_days: 180, last_service_odometer: 53000, last_service_at: day(-140), next_due_at: day(40), is_active: true }],
    [161, { id: 161, company_id: 1, branch_id: 2, vehicle_id: 10, service_name: "Tyre Rotation & Alignment", interval_km: 15000, interval_days: 180, last_service_odometer: 14000, last_service_at: day(-110), next_due_at: day(70), is_active: true }],
  ]);

  vehicleComponents = new Map([
    [170, { id: 170, company_id: 1, branch_id: 2, vehicle_id: 10, component_type: "tyre", serial_number: "MCH-AT-2024-8841", brand_model: "Michelin LTX Trail 265/65R17", position: "FL", installed_at: day(-150), installed_odometer: 18200, warranty_expires_at: day(580), status: "active", replaced_at: null, notes: "Tread depth 7.5mm at last check." }],
    [171, { id: 171, company_id: 1, branch_id: 2, vehicle_id: 11, component_type: "battery", serial_number: "VRT-HD-2025-1102", brand_model: "Varta Silver Dynamic 95Ah", position: "Main", installed_at: day(-90), installed_odometer: 55100, warranty_expires_at: day(640), status: "active", replaced_at: null, notes: "Heavy-duty mining spec." }],
  ]);

  fuelTransactions = new Map([
    [180, { id: 180, company_id: 1, branch_id: 2, vehicle_id: 10, vehicle_registration: "GW-4821-24", driver_user_id: 2, driver_name: "Yaw Boateng (Fleet Driver)", rental_id: null, expense_id: 260, fuel_date: day(-12), station: "Shell Airport Bypass", litres: 68, amount_minor: 98600, odometer: 27950, payment_method: "fuel_card", km_since_last: null, litres_per_100km: null, cost_per_km_minor: null, is_abnormal: false, created_at: iso(-288) }],
    [181, { id: 181, company_id: 1, branch_id: 2, vehicle_id: 10, vehicle_registration: "GW-4821-24", driver_user_id: 2, driver_name: "Yaw Boateng (Fleet Driver)", rental_id: null, expense_id: 261, fuel_date: day(-3), station: "GOIL Spintex Rd", litres: 62, amount_minor: 89900, odometer: 28450, payment_method: "fuel_card", km_since_last: 500, litres_per_100km: 12.4, cost_per_km_minor: 180, is_abnormal: false, created_at: iso(-72) }],
    [182, { id: 182, company_id: 1, branch_id: 2, vehicle_id: 11, vehicle_registration: "GE-9104-23", driver_user_id: 2, driver_name: "Yaw Boateng (Fleet Driver)", rental_id: 600, expense_id: 262, fuel_date: day(-1), station: "TotalEnergies Takoradi", litres: 78, amount_minor: 113100, odometer: 64210, payment_method: "fuel_card", km_since_last: 190, litres_per_100km: 41.05, cost_per_km_minor: 595, is_abnormal: true, created_at: iso(-20) }],
  ]);

  parts = new Map([
    [200, { id: 200, company_id: 1, branch_id: 2, sku: "FLT-TOY-001", name: "Toyota Genuine Oil Filter", category: "Filters", unit: "pcs", quantity_on_hand: 24, reorder_level: 10, unit_cost_minor: 25000, created_at: iso(-300), updated_at: iso(-12) }],
    [201, { id: 201, company_id: 1, branch_id: 2, sku: "BRK-PAD-004", name: "Heavy-Duty Ceramic Brake Pads", category: "Brakes", unit: "set", quantity_on_hand: 3, reorder_level: 6, unit_cost_minor: 135000, created_at: iso(-300), updated_at: iso(-12) }],
    [202, { id: 202, company_id: 1, branch_id: 2, sku: "TYR-AT-265", name: "Michelin LTX All-Terrain 265/65R17", category: "Tyres", unit: "pcs", quantity_on_hand: 8, reorder_level: 4, unit_cost_minor: 215000, created_at: iso(-300), updated_at: iso(-12) }],
  ]);

  suppliers = new Map([
    [210, { id: 210, company_id: 1, name: "AutoParts Ghana Ltd", email: "orders@autopartsgh.demo", phone: "+233 30 222 8190", address: "Graphic Road Industrial Area, Accra", is_active: true, created_at: iso(-400), updated_at: iso(-400) }],
    [211, { id: 211, company_id: 1, name: "Michelin West Africa Distributors", email: "fleet@michelinwa.demo", phone: "+233 30 276 4401", address: "Tema Harbour Commercial Zone", is_active: true, created_at: iso(-400), updated_at: iso(-400) }],
  ]);

  purchaseOrders = new Map([
    [220, { id: 220, company_id: 1, branch_id: 2, supplier_id: 210, created_by: 9, approved_by: 4, po_number: "PO-00220", status: "received", expected_at: day(-5), received_at: iso(-120), subtotal_minor: 675000, total_minor: 675000, notes: "Quarterly brake pad & filter restock.", items: [{ id: 1, part_id: 201, sku: "BRK-PAD-004", description: "Heavy-Duty Ceramic Brake Pads", quantity: 5, unit_cost_minor: 135000, line_total_minor: 675000 }], created_at: iso(-200), updated_at: iso(-120) }],
    [221, { id: 221, company_id: 1, branch_id: 2, supplier_id: 211, created_by: 9, approved_by: null, po_number: "PO-00221", status: "submitted", expected_at: day(7), received_at: null, subtotal_minor: 860000, total_minor: 860000, notes: "4x Michelin tyres for Prado & Hilux fleet.", items: [{ id: 1, part_id: 202, sku: "TYR-AT-265", description: "Michelin LTX All-Terrain 265/65R17", quantity: 4, unit_cost_minor: 215000, line_total_minor: 860000 }], created_at: iso(-30), updated_at: iso(-30) }],
  ]);

  purchaseRequisitions = new Map([
    [230, { id: 230, company_id: 1, branch_id: 2, requisition_number: "REQ-00230", department: "Workshop Maintenance", requester_id: 9, requester_name: "Kwabena Owusu (Maintenance Mgr)", approver_id: null, approver_name: null, supplier_id: 210, supplier_name: "AutoParts Ghana Ltd", needed_by: day(5), justification: "Replenish low-stock brake pads and diagnostic scanner cables.", status: "pending", estimated_total_minor: 540000, items: [{ description: "Heavy-Duty Ceramic Brake Pads (set)", quantity: 4, estimated_unit_minor: 135000 }], purchase_order_id: null, created_at: iso(-18) }],
    [231, { id: 231, company_id: 1, branch_id: 2, requisition_number: "REQ-00231", department: "Fleet Operations", requester_id: 3, requester_name: "Ama Osei (Operations Mgr)", approver_id: 4, approver_name: "Efua Appiah (Finance Mgr)", supplier_id: 211, supplier_name: "Michelin West Africa Distributors", needed_by: day(10), justification: "Spare tyre allocation for Kumasi branch vehicles.", status: "approved", estimated_total_minor: 430000, items: [{ description: "Michelin LTX All-Terrain 265/65R17", quantity: 2, estimated_unit_minor: 215000 }], purchase_order_id: null, created_at: iso(-40) }],
  ]);

  invoices = new Map([
    [240, { id: 240, company_id: 1, branch_id: 2, customer_id: 10, rental_id: null, created_by: 4, invoice_number: "INV-00240", status: "issued", due_at: iso(-120), issued_at: iso(-600), voided_at: null, discount_pct: 0, discount_minor: 0, subtotal_minor: 1450000, vat_rate_pct: 15, vat_minor: 217500, total_minor: 1667500, notes: "Monthly 4x4 Mining Site Retainer — October", lines: [{ id: 1, description: "Toyota Hilux 4x4 Monthly Retainer (10 days)", quantity: 10, unit_price_minor: 145000, line_total_minor: 1450000 }], created_at: iso(-600), updated_at: iso(-120) }],
    [241, { id: 241, company_id: 1, branch_id: 2, customer_id: 13, rental_id: 602, created_by: 4, invoice_number: "INV-00241", status: "issued", due_at: iso(168), issued_at: iso(-90), voided_at: null, discount_pct: 0, discount_minor: 0, subtotal_minor: 780000, vat_rate_pct: 15, vat_minor: 117000, total_minor: 897000, notes: "3-day Mercedes E 300 Executive airport charter", lines: [{ id: 1, description: "Rental #602 (GR-3310-25)", quantity: 3, unit_price_minor: 260000, line_total_minor: 780000 }], created_at: iso(-96), updated_at: iso(-90) }],
    [242, { id: 242, company_id: 1, branch_id: 5, customer_id: 12, rental_id: null, created_by: 4, invoice_number: "INV-00242", status: "issued", due_at: iso(-2400), issued_at: iso(-2800), voided_at: null, discount_pct: 0, discount_minor: 0, subtotal_minor: 950000, vat_rate_pct: 15, vat_minor: 142500, total_minor: 1092500, notes: "Overdue 90+ days corporate balance — account on hold", lines: [{ id: 1, description: "Regional Audit Fleet Charter", quantity: 1, unit_price_minor: 950000, line_total_minor: 950000 }], created_at: iso(-2800), updated_at: iso(-2400) }],
  ]);

  payments = new Map([
    [250, { id: 250, company_id: 1, branch_id: 2, invoice_id: 241, recorded_by: 4, amount_minor: 897000, method: "bank_transfer", reference: "STB-2026-88410", paid_at: iso(-80), notes: "Settled in full via Stanbic transfer.", created_at: iso(-80) }],
    [251, { id: 251, company_id: 1, branch_id: 2, invoice_id: 240, recorded_by: 4, amount_minor: 1000000, method: "bank_transfer", reference: "GFM-PART-1102", paid_at: iso(-150), notes: "Partial corporate remittance.", created_at: iso(-150) }],
  ]);

  creditNotes = new Map([
    [255, { id: 255, company_id: 1, branch_id: 2, invoice_id: 240, invoice_number: "INV-00240", customer_id: 10, customer_name: "GoldFields Mining Services Ltd", credit_note_number: "CN-00255", subtotal_minor: 100000, vat_minor: 15000, total_minor: 115000, reason: "Service-level downtime adjustment (1 half-day)", status: "posted", approval_request_id: null, posted_at: iso(-100), created_at: iso(-100) }],
  ]);

  expenses = new Map([
    [260, { id: 260, company_id: 1, branch_id: 2, vehicle_id: 10, vehicle_registration: "GW-4821-24", recorded_by: 3, category: "fuel", description: "Fuel fill (68 L at Shell Airport Bypass)", amount_minor: 98600, incurred_at: day(-12), created_at: iso(-288) }],
    [261, { id: 261, company_id: 1, branch_id: 2, vehicle_id: 10, vehicle_registration: "GW-4821-24", recorded_by: 3, category: "fuel", description: "Fuel fill (62 L at GOIL Spintex Rd)", amount_minor: 89900, incurred_at: day(-3), created_at: iso(-72) }],
    [262, { id: 262, company_id: 1, branch_id: 2, vehicle_id: 11, vehicle_registration: "GE-9104-23", recorded_by: 3, category: "fuel", description: "Fuel fill (78 L at TotalEnergies Takoradi)", amount_minor: 113100, incurred_at: day(-1), created_at: iso(-20) }],
    [263, { id: 263, company_id: 1, branch_id: 2, vehicle_id: 13, vehicle_registration: "GT-7742-22", recorded_by: 4, category: "maintenance", description: "External brake disc skimming", amount_minor: 85000, incurred_at: day(-2), created_at: iso(-48) }],
  ]);

  supplierInvoices = new Map([
    [270, { id: 270, company_id: 1, branch_id: 2, supplier_id: 210, supplier_name: "AutoParts Ghana Ltd", purchase_order_id: 220, invoice_number: "APG-2026-4412", invoice_date: day(-5), due_at: day(25), subtotal_minor: 675000, vat_minor: 101250, total_minor: 776250, paid_minor: 400000, outstanding_minor: 376250, expense_account_code: null, match_status: "matched", variance_minor: 0, approval_request_id: null, status: "partially_paid", notes: "3-way matched against PO-00220.", created_at: iso(-110) }],
    [271, { id: 271, company_id: 1, branch_id: 2, supplier_id: 211, supplier_name: "Michelin West Africa Distributors", purchase_order_id: null, invoice_number: "MWA-2026-1091", invoice_date: day(-10), due_at: day(20), subtotal_minor: 320000, vat_minor: 48000, total_minor: 368000, paid_minor: 0, outstanding_minor: 368000, expense_account_code: "5000", match_status: "non_po", variance_minor: 0, approval_request_id: null, status: "approved", notes: "Mobile tyre balancing call-out", created_at: iso(-220) }],
  ]);

  supplierPayments = new Map([
    [275, { id: 275, company_id: 1, supplier_invoice_id: 270, amount_minor: 400000, method: "bank_transfer", paid_at: day(-2) }],
  ]);

  bankAccounts = new Map([
    [280, { id: 280, company_id: 1, branch_id: 2, name: "Stanbic Operating Account (GHS)", bank_name: "Stanbic Bank Ghana", account_number_masked: "****4821", currency: "GHS", gl_account_code: "1000", opening_balance_minor: 25000000, ledger_balance_minor: 26497000, last_reconciled_at: iso(-120), is_active: true }],
    [281, { id: 281, company_id: 1, branch_id: 2, name: "Ecobank Collections Account", bank_name: "Ecobank Ghana", account_number_masked: "****9910", currency: "GHS", gl_account_code: "1000", opening_balance_minor: 8500000, ledger_balance_minor: 8500000, last_reconciled_at: null, is_active: true }],
  ]);

  bankTransactions = new Map([
    [285, { id: 285, company_id: 1, bank_account_id: 280, transaction_date: day(-3), description: "Customer Transfer — Kwame Nkrumah-Yeboah (INV-00241)", reference: "STB-2026-88410", amount_minor: 897000, direction: "credit", status: "matched", matched_journal_entry_id: 300, reconciliation_id: null }],
    [286, { id: 286, company_id: 1, bank_account_id: 280, transaction_date: day(-2), description: "Supplier Wire — AutoParts Ghana Ltd", reference: "WIRE-APG-4000", amount_minor: 400000, direction: "debit", status: "unmatched", matched_journal_entry_id: null, reconciliation_id: null }],
    [287, { id: 287, company_id: 1, bank_account_id: 280, transaction_date: day(-1), description: "Monthly Bank Maintenance Charge", reference: "STB-FEE-NOV", amount_minor: 15000, direction: "debit", status: "unmatched", matched_journal_entry_id: null, reconciliation_id: null }],
  ]);

  fixedAssets = new Map([
    [290, { id: 290, company_id: 1, branch_id: 2, vehicle_id: 10, vehicle_registration: "GW-4821-24", asset_code: "FA-VEH-010", name: "2024 Toyota Land Cruiser Prado (GW-4821-24)", category: "vehicle", acquisition_cost_minor: 85000000, residual_value_minor: 25000000, capitalisation_date: "2024-03-15", useful_life_months: 60, depreciation_method: "straight_line", accumulated_depreciation_minor: 17000000, net_book_value_minor: 68000000, status: "active", disposal_type: null, disposal_date: null, disposal_proceeds_minor: null, disposal_gain_loss_minor: null, disposal_approval_id: null, disposal_approval_status: null }],
    [291, { id: 291, company_id: 1, branch_id: 2, vehicle_id: 11, vehicle_registration: "GE-9104-23", asset_code: "FA-VEH-011", name: "2023 Toyota Hilux 4x4 (GE-9104-23)", category: "vehicle", acquisition_cost_minor: 54000000, residual_value_minor: 15000000, capitalisation_date: "2023-06-10", useful_life_months: 60, depreciation_method: "straight_line", accumulated_depreciation_minor: 14400000, net_book_value_minor: 39600000, status: "active", disposal_type: null, disposal_date: null, disposal_proceeds_minor: null, disposal_gain_loss_minor: null, disposal_approval_id: null, disposal_approval_status: null }],
  ]);

  // Balanced GL entries so P&L, Balance Sheet, Cash Flow & Trial Balance render live figures
  postJournalEntry({
    companyId: 1, branchId: 2, createdBy: 4, sourceType: "opening_equity", sourceId: 1, reference: "OPEN-2026", memo: "Opening capital & fleet asset register",
    lines: [
      { account_code: "1000", debit_minor: 33500000, credit_minor: 0 },
      { account_code: "1500", debit_minor: 139000000, credit_minor: 0 },
      { account_code: "1590", debit_minor: 0, credit_minor: 31400000 },
      { account_code: "3000", debit_minor: 0, credit_minor: 141100000 },
    ],
  });
  postJournalEntry({
    companyId: 1, branchId: 2, createdBy: 4, sourceType: "invoice", sourceId: 240, reference: "INV-00240", memo: "AR Invoices posted (GoldFields, Kwame, Ashanti)",
    lines: [
      { account_code: "1100", debit_minor: 3657000, credit_minor: 0 },
      { account_code: "4000", debit_minor: 0, credit_minor: 3180000 },
      { account_code: "2100", debit_minor: 0, credit_minor: 477000 },
    ],
  });
  postJournalEntry({
    companyId: 1, branchId: 2, createdBy: 4, sourceType: "payment", sourceId: 250, reference: "RCPT-2026", memo: "Customer receipts deposited to Stanbic Bank",
    lines: [
      { account_code: "1000", debit_minor: 1897000, credit_minor: 0 },
      { account_code: "1100", debit_minor: 0, credit_minor: 1897000 },
    ],
  });
  postJournalEntry({
    companyId: 1, branchId: 2, createdBy: 4, sourceType: "expense", sourceId: 260, reference: "EXP-OPS", memo: "Fleet fuel & workshop operating expenses",
    lines: [
      { account_code: "5000", debit_minor: 386600, credit_minor: 0 },
      { account_code: "1000", debit_minor: 0, credit_minor: 386600 },
    ],
  });
  postJournalEntry({
    companyId: 1, branchId: 2, createdBy: 4, sourceType: "depreciation", sourceId: 290, reference: "DEP-2026-11", memo: "Monthly fleet depreciation (Prado & Hilux)",
    lines: [
      { account_code: "5500", debit_minor: 1650000, credit_minor: 0 },
      { account_code: "1590", debit_minor: 0, credit_minor: 1650000 },
    ],
  });

  creditProfiles = new Map([
    [10, { customer_id: 10, customer_name: "GoldFields Mining Services Ltd", customer_type: "corporate", credit_limit_minor: 5000000, payment_terms_days: 30, on_credit_hold: false, hold_reason: null, held_at: null, open_ar_minor: 552500, overdue_ar_minor: 552500, credit_utilization_pct: 11, available_credit_minor: 4447500 }],
    [11, { customer_id: 11, customer_name: "Atlantic Energy Ghana Ltd", customer_type: "corporate", credit_limit_minor: 3500000, payment_terms_days: 30, on_credit_hold: false, hold_reason: null, held_at: null, open_ar_minor: 0, overdue_ar_minor: 0, credit_utilization_pct: 0, available_credit_minor: 3500000 }],
    [12, { customer_id: 12, customer_name: "Ashanti Infrastructure Consult", customer_type: "corporate", credit_limit_minor: 2000000, payment_terms_days: 15, on_credit_hold: true, hold_reason: "Invoice INV-00242 overdue > 90 days; payment promise missed.", held_at: iso(-240), open_ar_minor: 1092500, overdue_ar_minor: 1092500, credit_utilization_pct: 55, available_credit_minor: 907500 }],
  ]);

  approvalRequests = new Map([
    [320, { id: 320, company_id: 1, branch_id: 2, type: "discount", entity_type: "quotation", entity_id: 121, title: "Quotation #121 — 18% corporate loyalty discount", requester_id: 7, requester_name: "Abena Darko (Business Accounts)", approver_id: null, approver_name: null, previous_value: "10% max threshold", requested_value: "18% (GHS 3,330.00)", approved_value: null, reason: "Multi-quarter mining contract renewal", decision_notes: null, status: "pending", decided_at: null, created_at: iso(-20) }],
    [321, { id: 321, company_id: 1, branch_id: 2, type: "purchase_order", entity_type: "purchase_order", entity_id: 221, title: "PO-00221 — 4x Michelin All-Terrain Tyres", requester_id: 9, requester_name: "Kwabena Owusu (Maintenance Mgr)", approver_id: null, approver_name: null, previous_value: "Threshold GHS 5,000.00", requested_value: "GHS 8,600.00", approved_value: null, reason: "Mandatory tyre replacement before rainy-season deployments", decision_notes: null, status: "pending", decided_at: null, created_at: iso(-16) }],
  ]);

  documents = new Map([
    [700, { ...demoBase, id: 700, uploaded_by: 8, entity_type: "vehicle", entity_id: 10, original_name: "GW-4821-24-roadworthy-cert.pdf", mime_type: "application/pdf", size: 2048, expires_at: iso(18 * 24) }],
    [701, { ...demoBase, id: 701, uploaded_by: 8, entity_type: "vehicle", entity_id: 13, original_name: "GT-7742-22-insurance-policy.pdf", mime_type: "application/pdf", size: 3072, expires_at: iso(-5 * 24) }],
    [702, { ...demoBase, id: 702, uploaded_by: 8, entity_type: "customer", entity_id: 14, original_name: "abena-driver-licence.pdf", mime_type: "application/pdf", size: 1536, expires_at: iso(20 * 24) }],
  ]);
  for (const docId of [700, 701, 702]) {
    documentBlobs.set(docId, Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF", "utf8"));
  }

  messages = new Map([
    [
      800,
      {
        id: 800,
        company_id: 1,
        branch_id: 2,
        sender_user_id: 9,
        sender_name: "Kwabena Owusu (Maintenance Mgr)",
        channel: "dispatch",
        body: "HiAce GT-7742-22 brake overhaul ETA: releasing from Bay 2 tomorrow 14:00.",
        related_entity_type: "vehicle",
        related_entity_id: 13,
        read_by: [],
        created_at: iso(-5),
      },
    ],
    [
      801,
      {
        id: 801,
        company_id: 1,
        branch_id: 2,
        sender_user_id: 3,
        sender_name: "Ama Osei (Operations Mgr)",
        channel: "dispatch",
        body: "Live meeting started: Daily Accra Dispatch & Fleet Handover Standup (Jitsi Meet).",
        related_entity_type: "meeting",
        related_entity_id: 850,
        read_by: [],
        created_at: iso(-0.2),
      },
    ],
  ]);

  meetings = new Map([
    [
      850,
      {
        id: 850,
        company_id: 1,
        branch_id: 2,
        organizer_user_id: 3,
        organizer_name: "Ama Osei (Operations Mgr)",
        title: "Daily Accra Dispatch & Fleet Handover Standup",
        agenda: "Review morning vehicle handovers, driver allocations, and Bay 2 HiAce release ETA.",
        provider: "jitsi_embedded",
        room_slug: "drivecore-1-accra-standup-850",
        join_url: "https://meet.jit.si/drivecore-1-accra-standup-850",
        starts_at: iso(-0.2),
        ends_at: iso(0.3),
        status: "live",
        channel: "dispatch",
        related_entity_type: "rental",
        related_entity_id: 600,
        minutes: null,
        participants: [
          { user_id: 1, name: "Kofi Yeboah (System Admin)", email: "sysadmin@drivecore.demo", rsvp_status: "accepted", responded_at: iso(-1) },
          { user_id: 2, name: "Yaw Boateng (Fleet Driver)", email: "activedriver@drivecore.demo", rsvp_status: "accepted", responded_at: iso(-0.5) },
          { user_id: 3, name: "Ama Osei (Operations Mgr)", email: "opsmanager@drivecore.demo", rsvp_status: "accepted", responded_at: iso(-1) },
          { user_id: 9, name: "Kwabena Owusu (Maintenance Mgr)", email: "maintmanager@drivecore.demo", rsvp_status: "tentative", responded_at: iso(-0.8) },
        ],
        created_at: iso(-2),
        updated_at: iso(-0.2),
      },
    ],
    [
      851,
      {
        id: 851,
        company_id: 1,
        branch_id: 2,
        organizer_user_id: 10,
        organizer_name: "Esi Koomson (Credit Control)",
        title: "Executive Credit Review — Ashanti Infrastructure Consult",
        agenda: "Review overdue INV-00242 (>90 days) and approve revised payment plan before lifting credit hold.",
        provider: "teams",
        room_slug: null,
        join_url: "https://teams.microsoft.com/l/meetup-join/drivecore-credit-review-851",
        starts_at: iso(4),
        ends_at: iso(5),
        status: "scheduled",
        channel: "support",
        related_entity_type: "customer",
        related_entity_id: 12,
        minutes: null,
        participants: [
          { user_id: 1, name: "Kofi Yeboah (System Admin)", email: "sysadmin@drivecore.demo", rsvp_status: "pending", responded_at: null },
          { user_id: 4, name: "Efua Appiah (Finance Mgr)", email: "financemanager@drivecore.demo", rsvp_status: "accepted", responded_at: iso(-2) },
          { user_id: 6, name: "Nana Akufo (CEO)", email: "ceo@drivecore.demo", rsvp_status: "accepted", responded_at: iso(-1.5) },
          { user_id: 10, name: "Esi Koomson (Credit Control)", email: "creditcontrol@drivecore.demo", rsvp_status: "accepted", responded_at: iso(-3) },
        ],
        created_at: iso(-6),
        updated_at: iso(-2),
      },
    ],
    [
      852,
      {
        id: 852,
        company_id: 1,
        branch_id: 2,
        organizer_user_id: 9,
        organizer_name: "Kwabena Owusu (Maintenance Mgr)",
        title: "Weekly Workshop & Tyre Inventory Review",
        agenda: "Inspect low-stock tyre positions and sign off PO-00221 for Michelin All-Terrain set.",
        provider: "jitsi_embedded",
        room_slug: "drivecore-1-workshop-review-852",
        join_url: "https://meet.jit.si/drivecore-1-workshop-review-852",
        starts_at: iso(-26),
        ends_at: iso(-25),
        status: "ended",
        channel: "dispatch",
        related_entity_type: "work_order",
        related_entity_id: 240,
        minutes: "Confirmed PO-00221 for 4x Michelin All-Terrain tyres. Lead Mechanic Kojo Tetteh to complete HiAce brake overhaul by tomorrow 14:00.",
        participants: [
          { user_id: 1, name: "Kofi Yeboah (System Admin)", email: "sysadmin@drivecore.demo", rsvp_status: "accepted", responded_at: iso(-28) },
          { user_id: 5, name: "Kojo Tetteh (Lead Mechanic)", email: "mechanic@drivecore.demo", rsvp_status: "accepted", responded_at: iso(-27) },
          { user_id: 9, name: "Kwabena Owusu (Maintenance Mgr)", email: "maintmanager@drivecore.demo", rsvp_status: "accepted", responded_at: iso(-28) },
        ],
        created_at: iso(-30),
        updated_at: iso(-25),
      },
    ],
  ]);

  notifications = new Map([
    [900, { id: 900, company_id: 1, branch_id: 2, required_permission: "rentals.view", severity: "info", title: "Active rental #600 on site", body: "GE-9104-23 (Toyota Hilux 4x4) is active with Atlantic Energy Ghana Ltd.", href: "/companies/1/rentals/600?branch=all", read_by: [], created_at: iso(-24) }],
    [901, { id: 901, company_id: 1, branch_id: 2, required_permission: "documents.view", severity: "warning", title: "Expired insurance policy detected", body: "GT-7742-22 insurance expired 5 days ago. Renew before dispatch.", href: "/companies/1/operations?tab=compliance&branch=all", read_by: [], created_at: iso(-12) }],
  ]);

  auditEvents = new Map([
    [950, { id: 950, company_id: 1, actor_name: "Ama Osei (Operations Mgr)", action: "rental.handed_over", entity_type: "rental", entity_id: 600, summary: "Handed over Rental #600 (GE-9104-23) at 63,800 km.", created_at: iso(-70) }],
    [951, { id: 951, company_id: 1, actor_name: "Efua Appiah (Finance Mgr)", action: "credit_note.posted", entity_type: "credit_note", entity_id: 255, summary: "Posted CN-00255 against INV-00240 (GHS 1,150.00).", created_at: iso(-100) }],
  ]);

  nextId = 1000;
  demoSeeded = true;
}

function parseMultipart(buffer, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!match) return null;
  const boundary = match[1] || match[2];
  const raw = buffer.toString("latin1");
  const parts = raw.split(`--${boundary}`).slice(1, -1);
  const fields = {};
  let file = null;
  for (const part of parts) {
    const splitIdx = part.indexOf("\r\n\r\n");
    if (splitIdx === -1) continue;
    const headerBlock = part.slice(0, splitIdx);
    const bodyStr = part.slice(splitIdx + 4).replace(/\r\n$/, "");
    const nameMatch = headerBlock.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    const fileMatch = headerBlock.match(/filename="([^"]*)"/i);
    if (fileMatch) {
      const mimeMatch = headerBlock.match(/content-type:\s*([^\r\n]+)/i);
      file = {
        original_name: fileMatch[1] || "upload.pdf",
        mime_type: (mimeMatch?.[1] ?? "application/octet-stream").trim(),
        bytes: Buffer.from(bodyStr, "latin1"),
      };
    } else {
      fields[fieldName] = bodyStr;
    }
  }
  return { fields, file };
}

function decorateReservation(resRecord) {
  if (control.stripSummaryFields) {
    return { ...resRecord };
  }
  const customer = customers.get(resRecord.customer_id);
  const vehicle = vehicles.get(resRecord.vehicle_id);
  const linkedRental = [...rentals.values()].find(
    (r) => r.reservation_id === resRecord.id,
  );
  return {
    ...resRecord,
    customer_name: customer?.name ?? null,
    vehicle_registration: vehicle?.registration ?? null,
    vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : null,
    has_rental: !!linkedRental,
    rental_id: linkedRental?.id ?? null,
  };
}

function decorateRental(rentalRecord) {
  if (control.stripSummaryFields) {
    return { ...rentalRecord };
  }
  const resRecord = reservations.get(rentalRecord.reservation_id);
  const customer = resRecord ? customers.get(resRecord.customer_id) : null;
  const vehicle = vehicles.get(rentalRecord.vehicle_id);
  const driver = rentalRecord.driver_user_id
    ? managedUsers.get(rentalRecord.driver_user_id)
    : null;
  const linkedInvoice = [...invoices.values()].find(
    (inv) => inv.rental_id === rentalRecord.id,
  );
  return {
    ...rentalRecord,
    odometer_unit: "km",
    customer_id: resRecord?.customer_id ?? null,
    customer_name: customer?.name ?? null,
    vehicle_registration: vehicle?.registration ?? null,
    vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : null,
    driver_name: driver?.name ?? null,
    starts_at: resRecord?.starts_at ?? null,
    ends_at: resRecord?.ends_at ?? null,
    invoice_id: linkedInvoice?.id ?? null,
  };
}

function postJournalEntry({
  companyId,
  branchId,
  createdBy,
  sourceType,
  sourceId,
  reference,
  memo,
  lines,
}) {
  const cleanLines = lines
    .filter((l) => (l.debit_minor ?? 0) > 0 || (l.credit_minor ?? 0) > 0)
    .map((l, idx) => {
      const acc = SYSTEM_GL_ACCOUNTS.find((a) => a.code === l.account_code);
      return {
        id: nextId + idx,
        account_code: l.account_code,
        account_name: acc?.name ?? l.account_code,
        debit_minor: l.debit_minor ?? 0,
        credit_minor: l.credit_minor ?? 0,
      };
    });
  if (cleanLines.length === 0) return null;
  const id = nextId++;
  const entry = {
    id,
    company_id: companyId,
    branch_id: branchId,
    created_by: createdBy,
    source_type: sourceType,
    source_id: sourceId,
    reference,
    memo,
    posted_at: new Date().toISOString(),
    lines: cleanLines,
  };
  journalEntries.set(id, entry);
  return entry;
}

function computeInvoiceTotals(lines, discountPct, vatRatePct) {
  const normalizedLines = lines.map((line, idx) => {
    const qty = Math.max(1, Math.floor(Number(line.quantity)));
    const unit = Math.max(0, Math.round(Number(line.unit_price_minor)));
    return {
      id: idx + 1,
      description: String(line.description).trim(),
      quantity: qty,
      unit_price_minor: unit,
      line_total_minor: qty * unit,
    };
  });
  const subtotal_minor = normalizedLines.reduce(
    (sum, l) => sum + l.line_total_minor,
    0,
  );
  const discount_minor = Math.round(subtotal_minor * (discountPct / 100));
  const taxable = Math.max(0, subtotal_minor - discount_minor);
  const vat_minor = Math.round(taxable * (vatRatePct / 100));
  const total_minor = taxable + vat_minor;
  return {
    lines: normalizedLines,
    subtotal_minor,
    discount_minor,
    vat_minor,
    total_minor,
  };
}

function decorateInvoice(inv) {
  const cust = inv.customer_id ? customers.get(inv.customer_id) : null;
  const resolvedName = cust?.name ?? inv.custom_customer_name ?? null;
  const invPayments = [...payments.values()]
    .filter((p) => p.invoice_id === inv.id)
    .map((p) => ({
      ...p,
      invoice_number: inv.invoice_number,
      customer_name: resolvedName,
    }));
  const invRefunds = [...refunds.values()]
    .filter((r) => r.invoice_id === inv.id)
    .map((r) => ({
      ...r,
      invoice_number: inv.invoice_number,
      customer_name: resolvedName,
    }));
  const paid_minor = invPayments.reduce((s, p) => s + p.amount_minor, 0);
  const refunded_minor = invRefunds.reduce((s, r) => s + r.amount_minor, 0);
  const net_paid_minor = paid_minor - refunded_minor;
  const outstanding_minor =
    inv.status === "issued" ? Math.max(0, inv.total_minor - paid_minor) : 0;
  const is_overdue =
    inv.status === "issued" &&
    outstanding_minor > 0 &&
    Date.parse(inv.due_at) < Date.now();
  return {
    ...inv,
    customer_id: inv.customer_id ?? null,
    customer_name: resolvedName,
    custom_customer_name: inv.custom_customer_name ?? null,
    custom_customer_email: inv.custom_customer_email ?? null,
    custom_customer_phone: inv.custom_customer_phone ?? null,
    paid_minor,
    refunded_minor,
    net_paid_minor,
    outstanding_minor,
    is_overdue,
    payments: invPayments,
    refunds: invRefunds,
  };
}

function seedMany(domain) {
  for (let i = 1; i <= 27; i++) {
    const id = nextId++;
    if (domain === "customers") {
      customers.set(id, {
        ...base,
        id,
        name: `Needle Customer ${String(i).padStart(2, "0")}`,
        type: "corporate",
        email: `needle-${i}@example.test`,
        phone: `+233 50 000 ${String(i).padStart(4, "0")}`,
      });
    } else if (domain === "vehicles") {
      vehicles.set(id, {
        ...base,
        id,
        registration: `NED-${String(i).padStart(3, "0")}`,
        make: "Toyota",
        model: `Hilux ${i}`,
        year: 2025,
        odometer: 1000 + i * 10,
        odometer_unit: "km",
        daily_rate_minor: 55000,
        functions: ["gps_tracker", "awd_4x4"],
        status: "maintenance",
      });
    } else if (domain === "users") {
      managedUsers.set(id, {
        id,
        name: `Paged Driver ${String(i).padStart(2, "0")}`,
        email: `paged-driver-${i}@example.test`,
        is_active: true,
        is_platform_admin: false,
        roles: ["driver"],
        memberships: [{ company_id: 1, branch_id: 2 }],
      });
    }
  }
}

export function startDemoApiServer({ port = 0, seed = false } = {}) {
  if (seed) {
    seedDemo();
  } else {
    reset();
  }
  const server = createServer(async (req, res) => {
    const addr = server.address();
    const activePort = typeof addr === "object" && addr ? addr.port : port;
    const url = new URL(req.url, `http://127.0.0.1:${activePort}`);
  const json = (status, value) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  const fail = (status, errors = {}) =>
    json(status, { message: "Synthetic rejection", errors });
  const contentType = req.headers["content-type"] ?? "";
  const isMultipart = /^multipart\/form-data/i.test(contentType);
  const chunks = [];
  let totalBytes = 0;
  const maxBytes = isMultipart ? 11 * 1024 * 1024 : 70000;
  for await (const chunk of req) {
    chunks.push(chunk);
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      req.destroy();
      return;
    }
  }
  const rawBuffer = Buffer.concat(chunks);
  let input = {};
  let multipartData = null;
  if (isMultipart) {
    multipartData = parseMultipart(rawBuffer, contentType);
    if (!multipartData) {
      fail(400);
      return;
    }
  } else {
    const text = rawBuffer.toString("utf8");
    try {
      input = text ? JSON.parse(text) : {};
    } catch {
      fail(400);
      return;
    }
  }
  if (url.pathname === "/__test/reset") {
    reset();
    json(200, {});
    return;
  }
  if (url.pathname === "/__test/seed-demo") {
    seedDemo();
    json(200, { seeded: "demo" });
    return;
  }
  if (url.pathname === "/__test/control") {
    Object.assign(control, input);
    if (input.emptyDirectory) {
      companies.clear();
      branches.clear();
    }
    if (input.seedMany) {
      seedMany(input.seedMany);
    }
    if (input.seedExtraAvailableVehicle) {
      vehicles.set(14, {
        ...base,
        id: 14,
        registration: "SYN-14",
        make: "Toyota",
        model: "Prado",
        year: 2025,
        odometer: 1200,
        odometer_unit: "km",
        daily_rate_minor: 65000,
        functions: ["awd_4x4"],
        status: "available",
      });
      vehicles.set(15, {
        ...base,
        id: 15,
        registration: "SYN-15",
        make: "Unpriced",
        model: "Sedan",
        year: 2024,
        odometer: 500,
        odometer_unit: "km",
        daily_rate_minor: 0,
        functions: [],
        status: "available",
      });
    }
    if (input.expire) sessions.clear();
    json(200, {});
    return;
  }
  if (url.pathname === "/__test/stats") {
    json(200, { collectionReads, completedWrites });
    return;
  }
  const cookies = Object.fromEntries(
    (req.headers.cookie ?? "").split(";").map((part) => part.trim().split("=")),
  );
  if (url.pathname === "/sanctum/csrf-cookie") {
    res.setHeader("Set-Cookie", [
      `XSRF-TOKEN=${encodeURIComponent(randomUUID() + "=")}; Path=/; SameSite=Lax`,
      `drivecore_test=${randomUUID()}; Path=/; HttpOnly; SameSite=Lax`,
    ]);
    res.writeHead(204);
    res.end();
    return;
  }
  if (
    req.method !== "GET" &&
    (!cookies["XSRF-TOKEN"] ||
      decodeURIComponent(cookies["XSRF-TOKEN"]) !== req.headers["x-xsrf-token"])
  ) {
    fail(419);
    return;
  }
  if (url.pathname === "/__test/last-invite-token" && req.method === "GET") {
    json(200, { token: lastInviteToken });
    return;
  }
  if (url.pathname === "/__test/last-reset-token" && req.method === "GET") {
    json(200, { token: lastResetToken });
    return;
  }
  if (url.pathname === "/api/v1/invitations/preview" && req.method === "GET") {
    const raw = url.searchParams.get("token") ?? "";
    const hash = createHash("sha256").update(raw).digest("hex");
    const inv = [...invitations.values()].find((i) => i.token_hash === hash);
    if (!inv) {
      fail(404);
      return;
    }
    const expired = Date.parse(inv.expires_at) <= Date.now();
    if (inv.accepted_at || inv.revoked_at || expired) {
      fail(410);
      return;
    }
    const comp = companies.get(inv.company_id);
    const br = inv.branch_id ? branches.get(inv.branch_id) : null;
    const accountExists = [...managedUsers.values()].some(
      (u) => u.email.toLowerCase() === inv.email.toLowerCase(),
    );
    json(200, {
      data: {
        email: inv.email,
        company_name: comp?.name ?? `Company #${inv.company_id}`,
        branch_name: br?.name ?? null,
        role: inv.role,
        expires_at: inv.expires_at,
        account_exists: accountExists,
      },
    });
    return;
  }
  function buildUserForEmail(rawEmail) {
    const emailStr = String(rawEmail ?? "");
    const role = emailStr.split("@")[0];
    const srsAliasMap = {
      ceo: "ceo",
      gm: "general-manager",
      businessaccounts: "business-accounts-manager",
      opsmanager: "operations-manager",
      maintmanager: "maintenance-manager",
      financemanager: "finance-manager",
      creditcontrol: "credit-control-manager",
      hradmin: "hr-admin-manager",
      mechanic: "mechanic-technician",
      sysadmin: "system-administrator",
    };
    const mappedSrsRole = srsAliasMap[role] ?? null;
    const permissions = mappedSrsRole
      ? (ROLE_DEFS.find((r) => r.name === mappedSrsRole)?.permissions ?? [])
      : role === "driver" || role === "activedriver"
        ? ["companies.view", "branches.view"]
        : role === "finance"
          ? [
              "companies.view",
              "branches.view",
              "customers.view",
              "vehicles.view",
              "quotations.view",
              "quotations.approve_discount",
              "reservations.view",
              "rentals.view",
              "documents.view",
              "invoices.view",
              "invoices.manage",
              "payments.manage",
              "expenses.view",
              "expenses.manage",
              "gl.view",
              "work_orders.view",
              "parts.view",
              "suppliers.view",
              "purchase_orders.view",
              "purchase_orders.approve",
              "messages.view",
              "messages.send",
              "reports.view",
            ]
        : role === "viewer"
          ? [
              "customers.view",
              "vehicles.view",
              "branches.view",
              "quotations.view",
              "reservations.view",
              "rentals.view",
              "documents.view",
              "invoices.view",
              "expenses.view",
              "work_orders.view",
              "parts.view",
              "suppliers.view",
              "purchase_orders.view",
              "messages.view",
              "reports.view",
            ]
          : [
              "customers.view",
              "customers.manage",
              "vehicles.view",
              "vehicles.manage",
              "quotations.view",
              "quotations.manage",
              "reservations.view",
              "reservations.manage",
              "rentals.view",
              "rentals.manage",
              "documents.view",
              "documents.manage",
              "work_orders.view",
              "work_orders.manage",
              "parts.view",
              "parts.manage",
              "suppliers.view",
              "suppliers.manage",
              "purchase_orders.view",
              "purchase_orders.manage",
              "messages.view",
              "messages.send",
              "reports.view",
              ...(["admin", "companyadmin", "restrictedadmin"].includes(role)
                ? [
                    "branches.view",
                    "branches.manage",
                    "companies.manage",
                    "users.view",
                    "users.manage",
                    "settings.manage",
                    "quotations.approve_discount",
                    "invoices.view",
                    "invoices.manage",
                    "payments.manage",
                    "expenses.view",
                    "expenses.manage",
                    "gl.view",
                    "purchase_orders.approve",
                    "audit.view",
                  ]
                : []),
            ];
    const userId =
      role === "activedriver"
        ? 2
        : role === "operations"
          ? 3
          : role === "finance" || role === "financemanager"
            ? 4
            : role === "mechanic"
              ? 5
              : role === "ceo"
                ? 6
                : role === "businessaccounts"
                  ? 7
                  : role === "hradmin"
                    ? 8
                    : 1;
    const userRole = mappedSrsRole ?? (role === "activedriver" ? "driver" : role);
    const privilegedSet = new Set([
      "ceo",
      "general-manager",
      "finance-manager",
      "credit-control-manager",
      "system-administrator",
      "company-admin",
      "companyadmin",
      "finance",
    ]);
    const tf = twoFactorState.get(userId);
    const tfEnabled = Boolean(tf?.enabled);
    const require2faPolicy = Boolean(companySettings.get(1)?.require_2fa_for_privileged);
    const demoMatchedUser = [...managedUsers.values()].find(
      (u) => u.email.toLowerCase() === emailStr.toLowerCase(),
    );
    const primaryCompany = companies.get(1);
    const primaryCompanyName = primaryCompany?.name ?? "Synthetic One";
    const demoCurrencyField =
      primaryCompany?.currency && primaryCompany.currency !== "ZMW"
        ? { currency: primaryCompany.currency }
        : {};
    return {
      user: {
        id: demoMatchedUser?.id ?? userId,
        name:
          demoMatchedUser?.name ??
          (role === "activedriver"
            ? "Fleet Driver"
            : role === "finance" || role === "financemanager"
              ? "Finance Manager"
              : role === "mechanic"
                ? "Workshop Mechanic"
                : role === "ceo"
                  ? "Chief Executive"
                  : role === "businessaccounts"
                    ? "Business Accounts Manager"
                    : role === "hradmin"
                      ? "HR Admin Manager"
                      : "Synthetic operator"),
        email:
          demoMatchedUser?.email ??
          (role === "activedriver"
            ? "driver-co1@example.test"
            : `${role}@example.test`),
        roles: [userRole],
        is_platform_admin: role === "admin",
        must_change_password: role === "mustrotate",
        two_factor_enabled: tfEnabled,
        two_factor_enrollment_required:
          require2faPolicy && (role === "admin" || privilegedSet.has(userRole)) && !tfEnabled,
        permissions,
        companies:
          role === "admin"
            ? []
            : role === "driver"
              ? []
              : role === "activedriver"
                ? [{ id: 1, name: primaryCompanyName, branch_id: 2, ...demoCurrencyField }]
                : [
                    {
                      id: 1,
                      name: primaryCompanyName,
                      ...demoCurrencyField,
                      branch_id: [
                        "unrestricted",
                        "companyadmin",
                        "sysadmin",
                        "ceo",
                        "gm",
                        "hradmin",
                        "businessaccounts",
                        "financemanager",
                        "opsmanager",
                        "maintmanager",
                        "creditcontrol",
                      ].includes(role)
                        ? null
                        : 2,
                    },
                    ...(companies.has(3)
                      ? [{ id: 3, name: "Synthetic Three", branch_id: 4 }]
                      : []),
                  ],
      },
      tfEnabled,
    };
  }
  if (url.pathname === "/api/v1/auth/login") {
    if (control.loginStatus) {
      fail(control.loginStatus);
      return;
    }
    if (input.email?.startsWith("disabled")) {
      fail(422, { email: ["The provided credentials are incorrect."] });
      return;
    }
    const { user, tfEnabled } = buildUserForEmail(input.email);
    if (tfEnabled) {
      const challengeToken = randomUUID();
      twoFactorChallenges.set(challengeToken, {
        user,
        expiresAt: Date.now() + 300_000,
      });
      json(200, { two_factor_required: true, challenge_token: challengeToken });
      return;
    }
    const session = demoSeeded
      ? `demo:${encodeURIComponent(user.email)}:${randomUUID()}`
      : randomUUID();
    sessions.set(session, user);
    res.setHeader("Set-Cookie", [
      `drivecore_test=${session}; Path=/; HttpOnly; SameSite=Lax`,
      `XSRF-TOKEN=${encodeURIComponent(randomUUID() + "=")}; Path=/; SameSite=Lax`,
    ]);
    json(200, { data: user });
    return;
  }
  if (url.pathname === "/api/v1/auth/two-factor/challenge" && req.method === "POST") {
    const token = String(input.challenge_token ?? "");
    const ch = twoFactorChallenges.get(token);
    if (!ch || ch.expiresAt <= Date.now()) {
      fail(422, { code: ["Two-factor challenge expired. Sign in again."] });
      return;
    }
    const tf = twoFactorState.get(ch.user.id);
    const code = input.code ? String(input.code).trim() : "";
    const rec = input.recovery_code ? String(input.recovery_code).trim().toUpperCase() : "";
    let valid = false;
    if (code) {
      valid = /^\d{6}$/.test(code) && code !== "000000";
    } else if (rec && tf?.recoveryCodes?.has(rec)) {
      tf.recoveryCodes.delete(rec);
      valid = true;
    }
    if (!valid) {
      fail(422, { code: ["Invalid two-factor verification code."] });
      return;
    }
    twoFactorChallenges.delete(token);
    const session = randomUUID();
    sessions.set(session, ch.user);
    res.setHeader("Set-Cookie", [
      `drivecore_test=${session}; Path=/; HttpOnly; SameSite=Lax`,
      `XSRF-TOKEN=${encodeURIComponent(randomUUID() + "=")}; Path=/; SameSite=Lax`,
    ]);
    json(200, { data: ch.user });
    return;
  }
  if (url.pathname === "/api/v1/invitations/accept" && req.method === "POST") {
    const raw = String(input.token ?? "");
    const hash = createHash("sha256").update(raw).digest("hex");
    const inv = [...invitations.values()].find((i) => i.token_hash === hash);
    if (!inv) {
      fail(404);
      return;
    }
    if (
      inv.accepted_at ||
      inv.revoked_at ||
      Date.parse(inv.expires_at) <= Date.now()
    ) {
      fail(410);
      return;
    }
    const existing = [...managedUsers.values()].find(
      (u) => u.email.toLowerCase() === inv.email.toLowerCase(),
    );
    const pw = String(input.password ?? "");
    if (!existing) {
      const name = String(input.name ?? "").trim();
      if (!name) {
        fail(422, { name: ["Name is required."] });
        return;
      }
      if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
        fail(422, {
          password: [
            "Password must be at least 10 characters and include a letter and a number.",
          ],
        });
        return;
      }
    } else if (!pw || pw === "wrong-password") {
      fail(422, { password: ["The provided credentials are incorrect."] });
      return;
    }

    inv.accepted_at = new Date().toISOString();
    inv.status = "accepted";
    const comp = companies.get(inv.company_id);
    const uid = existing ? existing.id : nextId++;
    const userObj = {
      id: uid,
      name: existing ? existing.name : String(input.name).trim(),
      email: inv.email,
      is_platform_admin: false,
      must_change_password: false,
      roles: [inv.role],
      permissions: [
        "companies.view",
        "branches.view",
        "customers.view",
        "vehicles.view",
        "reservations.view",
        "rentals.view",
        "messages.view",
        "messages.send",
        "reports.view",
      ],
      companies: [
        ...(existing?.companies ?? []),
        {
          id: inv.company_id,
          name: comp?.name ?? `Company #${inv.company_id}`,
          branch_id: inv.branch_id ?? null,
        },
      ],
    };
    const session = randomUUID();
    sessions.set(session, userObj);
    res.setHeader("Set-Cookie", [
      `drivecore_test=${session}; Path=/; HttpOnly; SameSite=Lax`,
      `XSRF-TOKEN=${encodeURIComponent(randomUUID() + "=")}; Path=/; SameSite=Lax`,
    ]);
    completedWrites++;
    json(200, { data: userObj, company_id: inv.company_id });
    return;
  }
  if (url.pathname === "/api/v1/auth/forgot-password" && req.method === "POST") {
    const email = String(input.email ?? "").trim().toLowerCase();
    const raw = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    lastResetToken = raw;
    passwordResets.set(raw, {
      email,
      expires_at: Date.now() + 3_600_000,
      used: false,
    });
    json(200, {
      message: "If an account matches that email, a reset link has been sent.",
    });
    return;
  }
  if (url.pathname === "/api/v1/auth/reset-password" && req.method === "POST") {
    const raw = String(input.token ?? "");
    const email = String(input.email ?? "").trim().toLowerCase();
    const pw = String(input.password ?? "");
    const rec = passwordResets.get(raw);
    if (!rec || rec.used || rec.expires_at <= Date.now() || rec.email !== email) {
      fail(422, { token: ["This password reset token is invalid or expired."] });
      return;
    }
    if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
      fail(422, {
        password: [
          "Password must be at least 10 characters and include a letter and a number.",
        ],
      });
      return;
    }
    rec.used = true;
    completedWrites++;
    json(200, { message: "Password reset successfully." });
    return;
  }
  let user = sessions.get(cookies.drivecore_test);
  if (
    !user &&
    demoSeeded &&
    typeof cookies.drivecore_test === "string" &&
    cookies.drivecore_test.startsWith("demo:")
  ) {
    const email = decodeURIComponent(cookies.drivecore_test.split(":")[1] ?? "");
    if (email) {
      user = buildUserForEmail(email).user;
      sessions.set(cookies.drivecore_test, user);
    }
  }
  if (!user) {
    fail(401);
    return;
  }
  if (control.csrfFailure && req.method !== "GET") {
    fail(419);
    return;
  }
  if (control.disabled) {
    fail(403);
    return;
  }
  if (url.pathname === "/api/v1/auth/me") {
    const tf = twoFactorState.get(user.id);
    const tfEnabled = Boolean(tf?.enabled);
    const require2faPolicy = Boolean(companySettings.get(1)?.require_2fa_for_privileged);
    const privilegedSet = new Set([
      "ceo",
      "general-manager",
      "finance-manager",
      "credit-control-manager",
      "system-administrator",
      "company-admin",
      "companyadmin",
      "finance",
    ]);
    const enriched = {
      ...user,
      two_factor_enabled: tfEnabled,
      two_factor_enrollment_required:
        require2faPolicy &&
        (user.is_platform_admin || user.roles.some((r) => privilegedSet.has(r))) &&
        !tfEnabled,
    };
    json(200, { data: control.revoked ? { ...enriched, companies: [] } : enriched });
    return;
  }
  if (url.pathname === "/api/v1/auth/two-factor/setup" && req.method === "POST") {
    const secret = "JBSWY3DPEHPK3PXP";
    twoFactorState.set(user.id, {
      secret,
      enabled: false,
      recoveryCodes: new Set(),
    });
    json(200, {
      data: {
        secret,
        otpauth_uri: `otpauth://totp/DriveCore:${encodeURIComponent(user.email)}?secret=${secret}&issuer=DriveCore`,
      },
    });
    return;
  }
  if (url.pathname === "/api/v1/auth/two-factor/confirm" && req.method === "POST") {
    const code = String(input.code ?? "").trim();
    if (!/^\d{6}$/.test(code) || code === "000000") {
      fail(422, { code: ["Invalid 6-digit verification code."] });
      return;
    }
    const codes = Array.from({ length: 8 }, (_, i) => `DC${1000 + i}-99${i}A`);
    const existing = twoFactorState.get(user.id) ?? { secret: "JBSWY3DPEHPK3PXP" };
    twoFactorState.set(user.id, {
      ...existing,
      enabled: true,
      recoveryCodes: new Set(codes),
    });
    user.two_factor_enabled = true;
    user.two_factor_enrollment_required = false;
    const mu = managedUsers.get(user.id);
    if (mu) mu.two_factor_enabled = true;
    completedWrites++;
    json(200, { data: { two_factor_enabled: true, recovery_codes: codes } });
    return;
  }
  if (url.pathname === "/api/v1/auth/two-factor/disable" && req.method === "POST") {
    if (companySettings.get(1)?.require_2fa_for_privileged) {
      fail(409);
      return;
    }
    twoFactorState.delete(user.id);
    user.two_factor_enabled = false;
    const mu = managedUsers.get(user.id);
    if (mu) mu.two_factor_enabled = false;
    completedWrites++;
    json(200, { data: user });
    return;
  }
  if (url.pathname === "/api/v1/auth/two-factor/recovery-codes" && req.method === "POST") {
    const codes = Array.from({ length: 8 }, (_, i) => `DR${2000 + i}-88${i}B`);
    const existing = twoFactorState.get(user.id);
    if (existing) existing.recoveryCodes = new Set(codes);
    completedWrites++;
    json(200, { data: { recovery_codes: codes } });
    return;
  }
  const reset2faMatch = url.pathname.match(/^\/api\/v1\/users\/(\d+)\/reset-two-factor$/);
  if (reset2faMatch && req.method === "POST") {
    const targetId = Number(reset2faMatch[1]);
    if (targetId === user.id) {
      fail(409);
      return;
    }
    const isAdmin =
      user.is_platform_admin ||
      user.roles.includes("system-administrator") ||
      user.roles.includes("company-admin") ||
      user.roles.includes("companyadmin");
    if (!isAdmin) {
      fail(403);
      return;
    }
    twoFactorState.delete(targetId);
    const mu = managedUsers.get(targetId);
    if (!mu) {
      fail(404);
      return;
    }
    mu.two_factor_enabled = false;
    completedWrites++;
    json(200, { data: mu });
    return;
  }
  const leadMatch = url.pathname.match(/^\/api\/v1\/leads(?:\/(\d+)(?:\/(convert))?)?$/);
  if (leadMatch) {
    const leadId = leadMatch[1] ? Number(leadMatch[1]) : null;
    const leadAction = leadMatch[2] ?? null;
    if (req.method === "GET" && !leadId) {
      const companyId = Number(url.searchParams.get("company_id"));
      const stageFilter = url.searchParams.get("stage");
      const qStr = (url.searchParams.get("q") ?? "").toLowerCase();
      const rows = [...leads.values()].filter(
        (l) =>
          l.company_id === companyId &&
          (!stageFilter || l.stage === stageFilter) &&
          (!qStr ||
            l.contact_name.toLowerCase().includes(qStr) ||
            (l.company_name ?? "").toLowerCase().includes(qStr) ||
            (l.vehicle_requirements ?? "").toLowerCase().includes(qStr)),
      );
      json(200, {
        data: rows,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: rows.length },
      });
      return;
    }
    if (req.method === "POST" && !leadId) {
      const id = nextId++;
      const now = new Date().toISOString();
      const rec = {
        id,
        company_id: Number(input.company_id ?? 1),
        branch_id: Number(input.branch_id ?? 2),
        contact_name: String(input.contact_name ?? "").trim(),
        company_name: input.company_name ? String(input.company_name) : null,
        customer_type: String(input.customer_type ?? "corporate"),
        email: input.email ? String(input.email) : null,
        phone: input.phone ? String(input.phone) : null,
        source: String(input.source ?? "corporate_outreach"),
        stage: "new",
        vehicle_requirements: input.vehicle_requirements ? String(input.vehicle_requirements) : null,
        expected_start_date: input.expected_start_date ? String(input.expected_start_date) : null,
        expected_days: input.expected_days ? Number(input.expected_days) : null,
        estimated_value_minor:
          input.estimated_value_minor !== undefined && input.estimated_value_minor !== null
            ? Number(input.estimated_value_minor)
            : null,
        assigned_to_user_id: user.id,
        assigned_to_name: user.name,
        next_follow_up_at: input.next_follow_up_at ? String(input.next_follow_up_at) : null,
        lost_reason: null,
        customer_id: null,
        quotation_id: null,
        notes: input.notes ? String(input.notes) : null,
        created_at: now,
        updated_at: now,
      };
      leads.set(id, rec);
      completedWrites++;
      json(201, { data: rec });
      return;
    }
    if (req.method === "PATCH" && leadId && !leadAction) {
      const rec = leads.get(leadId);
      if (!rec) {
        fail(404);
        return;
      }
      if (input.stage) rec.stage = String(input.stage);
      if (input.lost_reason !== undefined) rec.lost_reason = input.lost_reason ? String(input.lost_reason) : null;
      if (input.next_follow_up_at !== undefined) rec.next_follow_up_at = input.next_follow_up_at ? String(input.next_follow_up_at) : null;
      if (input.notes !== undefined) rec.notes = input.notes ? String(input.notes) : null;
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: rec });
      return;
    }
    if (req.method === "POST" && leadId && leadAction === "convert") {
      const rec = leads.get(leadId);
      if (!rec) {
        fail(404);
        return;
      }
      let cust =
        (rec.customer_id && customers.get(rec.customer_id)) ||
        (rec.email &&
          [...customers.values()].find(
            (c) =>
              c.company_id === rec.company_id &&
              c.email &&
              c.email.toLowerCase() === rec.email.toLowerCase(),
          ));
      if (!cust) {
        const cid = nextId++;
        const now = new Date().toISOString();
        cust = {
          id: cid,
          company_id: rec.company_id,
          branch_id: rec.branch_id,
          name: rec.company_name || rec.contact_name,
          type: rec.customer_type,
          email: rec.email,
          phone: rec.phone,
          created_at: now,
          updated_at: now,
        };
        customers.set(cid, cust);
      }
      rec.customer_id = cust.id;
      rec.stage = "proposal_sent";
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: { lead: rec, customer: cust } });
      return;
    }
  }
  if (url.pathname === "/api/v1/auth/logout") {
    if (control.logoutFailure) {
      fail(503);
      return;
    }
    sessions.delete(cookies.drivecore_test);
    res.setHeader("Set-Cookie", "drivecore_test=; Max-Age=0; Path=/; HttpOnly");
    json(200, { data: { message: "Signed out." } });
    return;
  }
  if (url.pathname === "/api/v1/auth/profile" && req.method === "PATCH") {
    if (user.must_change_password) {
      fail(403);
      return;
    }
    const name = String(input.name ?? "").trim();
    if (!name || name.length > 120) {
      fail(422, { name: ["Display name is required."] });
      return;
    }
    user.name = name;
    completedWrites++;
    json(200, { data: user });
    return;
  }
  if (url.pathname === "/api/v1/auth/change-password" && req.method === "POST") {
    const cur = String(input.current_password ?? "");
    const nextPw = String(input.password ?? "");
    if (!cur || cur === "wrong-password") {
      fail(422, { current_password: ["Current password is incorrect."] });
      return;
    }
    if (nextPw.length < 10 || !/[A-Za-z]/.test(nextPw) || !/\d/.test(nextPw)) {
      fail(422, {
        password: [
          "Password must be at least 10 characters and include a letter and a number.",
        ],
      });
      return;
    }
    if (nextPw === cur) {
      fail(422, {
        password: ["New password must be different from current password."],
      });
      return;
    }
    user.must_change_password = false;
    completedWrites++;
    json(200, { data: user });
    return;
  }
  if (user.must_change_password) {
    fail(403);
    return;
  }

  const invMatch = url.pathname.match(
    /^\/api\/v1\/invitations(?:\/(\d+)(?:\/(resend|revoke))?)?$/,
  );
  if (invMatch) {
    if (!user.is_platform_admin && !user.permissions.includes("users.manage")) {
      fail(403);
      return;
    }
    const invId = invMatch[1] ? Number(invMatch[1]) : null;
    const action = invMatch[2] ?? null;
    const decorateInv = (i) => {
      const br = i.branch_id ? branches.get(i.branch_id) : null;
      const status = i.accepted_at
        ? "accepted"
        : i.revoked_at
          ? "revoked"
          : Date.parse(i.expires_at) <= Date.now()
            ? "expired"
            : "pending";
      return {
        id: i.id,
        company_id: i.company_id,
        branch_id: i.branch_id,
        branch_name: br?.name ?? null,
        email: i.email,
        role: i.role,
        status,
        invited_by_name: i.invited_by_name ?? null,
        expires_at: i.expires_at,
        accepted_at: i.accepted_at,
        revoked_at: i.revoked_at,
        created_at: i.created_at,
      };
    };
    if (req.method === "GET" && !invId) {
      const companyId = Number(url.searchParams.get("company_id"));
      const stFilter = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...invitations.values()]
        .filter((i) => i.company_id === companyId)
        .map(decorateInv)
        .filter((i) => {
          if (stFilter && i.status !== stFilter) return false;
          if (q && !i.email.toLowerCase().includes(q)) return false;
          return true;
        })
        .sort((a, b) => b.id - a.id);
      json(200, {
        data: items,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length },
      });
      return;
    }
    if (req.method === "POST" && !invId) {
      const companyId = Number(input.company_id);
      const email = String(input.email ?? "").trim().toLowerCase();
      const roleName = String(input.role ?? "operations");
      const branchId = input.branch_id ? Number(input.branch_id) : null;
      const dupPending = [...invitations.values()].some(
        (i) =>
          i.company_id === companyId &&
          i.email.toLowerCase() === email &&
          !i.accepted_at &&
          !i.revoked_at &&
          Date.parse(i.expires_at) > Date.now(),
      );
      if (!email || !email.includes("@") || dupPending) {
        fail(422, {
          email: [
            dupPending
              ? "A pending invitation already exists for this email."
              : "Enter a valid email address.",
          ],
        });
        return;
      }
      const raw = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
      lastInviteToken = raw;
      const id = nextId++;
      const rec = {
        id,
        company_id: companyId,
        branch_id: branchId,
        email,
        role: roleName,
        invited_by_name: user.name,
        token_hash: createHash("sha256").update(raw).digest("hex"),
        expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString(),
        accepted_at: null,
        revoked_at: null,
        created_at: new Date().toISOString(),
      };
      invitations.set(id, rec);
      completedWrites++;
      json(201, { data: decorateInv(rec) });
      return;
    }
    if (req.method === "POST" && invId && action === "resend") {
      const rec = invitations.get(invId);
      if (!rec) {
        fail(404);
        return;
      }
      if (rec.accepted_at || rec.revoked_at) {
        fail(409);
        return;
      }
      const raw = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
      lastInviteToken = raw;
      rec.token_hash = createHash("sha256").update(raw).digest("hex");
      rec.expires_at = new Date(Date.now() + 72 * 3_600_000).toISOString();
      completedWrites++;
      json(200, { data: decorateInv(rec) });
      return;
    }
    if (req.method === "POST" && invId && action === "revoke") {
      const rec = invitations.get(invId);
      if (!rec) {
        fail(404);
        return;
      }
      if (rec.accepted_at || rec.revoked_at) {
        fail(409);
        return;
      }
      rec.revoked_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: decorateInv(rec) });
      return;
    }
  }

  const page = Number(url.searchParams.get("page") ?? 1);
  const sortItems = (items, accessors) => {
    const sortKey = url.searchParams.get("sort");
    const dir = url.searchParams.get("dir") === "desc" ? "desc" : "asc";
    if (!sortKey || !accessors[sortKey]) return items;
    const accessor = accessors[sortKey];
    const mult = dir === "desc" ? -1 : 1;
    return [...items].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const aEmpty = av === null || av === undefined || av === "";
      const bEmpty = bv === null || bv === undefined || bv === "";
      if (aEmpty && bEmpty) return (a.id ?? 0) - (b.id ?? 0);
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else if (typeof av === "boolean" && typeof bv === "boolean") {
        cmp = Number(av) - Number(bv);
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      if (cmp !== 0) return cmp * mult;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  };
  const paginateSlice = (items) => {
    const perPage = 25;
    const total = items.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const slice = items.slice((page - 1) * perPage, page * perPage);
    json(200, {
      data: slice,
      links: {},
      meta: {
        current_page: page,
        last_page: lastPage,
        per_page: perPage,
        total,
      },
    });
  };
  const paginate = (data, last = 1) =>
    json(200, {
      data,
      links: {},
      meta: {
        current_page: page,
        last_page: last,
        per_page: 25,
        total: last === 2 ? 26 : data.length,
      },
    });

  if (url.pathname === "/api/v1/companies") {
    if (req.method === "POST") {
      if (!user.is_platform_admin) {
        fail(403);
        return;
      }
      if (control.setupValidation) {
        fail(422, { name: ["Synthetic company rejection."] });
        return;
      }
      if (
        !input.name ||
        input.name.length > 255 ||
        !/^[A-Z]{3}$/.test(input.currency)
      ) {
        fail(422, { currency: ["Enter three uppercase letters."] });
        return;
      }
      const created = {
        id: nextId++,
        name: input.name,
        currency: input.currency,
      };
      companies.set(created.id, created);
      completedWrites++;
      json(201, { data: created });
      return;
    }
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const records = [...companies.values()].filter(
      (c) => !q || c.name.toLowerCase().includes(q),
    );
    paginate(
      records.length > 1
        ? page === 1
          ? records.slice(0, 1)
          : records.slice(1)
        : records,
      records.length > 1 ? 2 : 1,
    );
    return;
  }
  if (url.pathname === "/api/v1/branches") {
    if (req.method === "POST") {
      if (
        !user.is_platform_admin &&
        (!user.permissions.includes("branches.manage") ||
          !user.companies.some(
            (c) => c.id === input.company_id && c.branch_id === null,
          ))
      ) {
        fail(403);
        return;
      }
      if (!companies.has(input.company_id)) {
        fail(404);
        return;
      }
      if (
        control.setupValidation ||
        [...branches.values()].some(
          (b) => b.company_id === input.company_id && b.name === input.name,
        )
      ) {
        fail(422, { name: ["The name has already been taken."] });
        return;
      }
      const created = {
        id: nextId++,
        company_id: input.company_id,
        name: input.name,
      };
      branches.set(created.id, created);
      completedWrites++;
      json(201, { data: created });
      return;
    }
    if (control.directoryFailure) {
      fail(503);
      return;
    }
    const companyFilter = url.searchParams.get("company_id")
      ? Number(url.searchParams.get("company_id"))
      : null;
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const list = [...branches.values()].filter(
      (b) =>
        (!companyFilter || b.company_id === companyFilter) &&
        (!q || b.name.toLowerCase().includes(q)),
    );
    paginate(list);
    return;
  }

  // --- M5 Roles & Users Administration ---
  const requireUserWorkspace = (companyId) => {
    if (!Number.isInteger(companyId) || companyId < 1) {
      fail(422, { company_id: ["The company id field is required."] });
      return null;
    }
    if (!companies.has(companyId)) {
      fail(404);
      return null;
    }
    if (user.is_platform_admin) return companyId;
    const membership = user.companies.find((c) => c.id === companyId);
    if (!membership) {
      fail(404);
      return null;
    }
    if (membership.branch_id !== null) {
      fail(403);
      return null;
    }
    return companyId;
  };

  if (url.pathname === "/api/v1/roles" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("users.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    if (!requireUserWorkspace(companyId)) return;
    json(200, { data: ROLE_DEFS });
    return;
  }

  const userMatch = url.pathname.match(/^\/api\/v1\/users(?:\/(\d+))?$/);
  if (userMatch) {
    const targetId = userMatch[1] ? Number(userMatch[1]) : null;
    if (req.method === "GET" && !targetId) {
      if (!user.is_platform_admin && !user.permissions.includes("users.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      if (!requireUserWorkspace(companyId)) return;
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const roleFilter = url.searchParams.get("role");
      const activeParam = url.searchParams.get("is_active");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

      const items = [...managedUsers.values()]
        .filter((u) => {
          const m = u.memberships.find((x) => x.company_id === companyId);
          if (!m) return false;
          if (!user.is_platform_admin && u.is_platform_admin) return false;
          if (branchId !== null && m.branch_id !== branchId) return false;
          if (roleFilter && !u.roles.includes(roleFilter)) return false;
          if (activeParam !== null) {
            const want = activeParam === "1" || activeParam === "true";
            if (u.is_active !== want) return false;
          }
          if (
            q &&
            !u.name.toLowerCase().includes(q) &&
            !u.email.toLowerCase().includes(q)
          )
            return false;
          return true;
        })
        .map((u) => {
          const m = u.memberships.find((x) => x.company_id === companyId);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            is_active: u.is_active,
            roles: u.roles,
            company_id: companyId,
            branch_id: m?.branch_id ?? null,
          };
        });
      paginateSlice(
        sortItems(items, {
          name: (u) => u.name,
          email: (u) => u.email,
          role: (u) => u.roles[0] ?? "",
          is_active: (u) => u.is_active,
          id: (u) => u.id,
        }),
      );
      return;
    }

    if (req.method === "POST" && !targetId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("users.manage")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(input.company_id);
      if (!requireUserWorkspace(companyId)) return;
      if (
        !input.password ||
        input.password.length < 12 ||
        input.password !== input.password_confirmation
      ) {
        fail(422, { password: ["Invalid password confirmation."] });
        return;
      }
      if (
        [...managedUsers.values()].some(
          (u) => u.email.toLowerCase() === String(input.email).toLowerCase(),
        )
      ) {
        fail(422, { email: ["The email has already been taken."] });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        name: input.name,
        email: String(input.email).toLowerCase(),
        is_active: true,
        is_platform_admin: false,
        roles: [input.role],
        memberships: [
          { company_id: companyId, branch_id: input.branch_id ?? null },
        ],
      };
      managedUsers.set(id, created);
      completedWrites++;
      json(201, {
        data: {
          id: created.id,
          name: created.name,
          email: created.email,
          is_platform_admin: false,
          roles: created.roles,
          permissions:
            ROLE_DEFS.find((r) => r.name === input.role)?.permissions ?? [],
          companies: [
            {
              id: companyId,
              name: companies.get(companyId)?.name ?? "Synthetic",
              branch_id: input.branch_id ?? null,
            },
          ],
        },
      });
      return;
    }

    if (req.method === "PATCH" && targetId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("users.manage")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(input.company_id);
      if (!requireUserWorkspace(companyId)) return;
      const target = managedUsers.get(targetId);
      const membership = target?.memberships.find(
        (m) => m.company_id === companyId,
      );
      if (!target || !membership) {
        fail(404);
        return;
      }
      if (target.id === user.id) {
        fail(409);
        return;
      }
      if (
        !user.is_platform_admin &&
        (input.role !== undefined || input.is_active !== undefined) &&
        target.memberships.length > 1
      ) {
        fail(409);
        return;
      }
      if (input.role !== undefined) target.roles = [input.role];
      if (input.is_active !== undefined) target.is_active = !!input.is_active;
      if (Object.prototype.hasOwnProperty.call(input, "branch_id")) {
        membership.branch_id = input.branch_id ?? null;
      }
      completedWrites++;
      json(200, {
        data: {
          id: target.id,
          name: target.name,
          email: target.email,
          is_active: target.is_active,
          roles: target.roles,
          company_id: companyId,
          branch_id: membership.branch_id,
        },
      });
      return;
    }
    fail(404);
    return;
  }

  // --- M7 Company Settings, Quotations & PDFs ---
  const settingsMatch = url.pathname.match(/^\/api\/v1\/companies\/(\d+)\/settings$/);
  if (settingsMatch) {
    const companyId = Number(settingsMatch[1]);
    const membership = user.companies.find((c) => c.id === companyId);
    if (!user.is_platform_admin && !membership) {
      fail(404);
      return;
    }
    const existing = companySettings.get(companyId);
    if (!existing) {
      fail(404);
      return;
    }
    if (req.method === "GET") {
      json(200, { data: existing });
      return;
    }
    if (req.method === "PATCH") {
      if (
        !user.is_platform_admin &&
        (!user.permissions.includes("settings.manage") ||
          membership?.branch_id !== null)
      ) {
        fail(403);
        return;
      }
      const vat = Number(input.vat_rate_pct);
      const threshold = Number(input.discount_approval_threshold_pct);
      if (Number.isNaN(vat) || vat < 0 || vat > 100) {
        fail(422, { vat_rate_pct: ["VAT rate must be between 0 and 100."] });
        return;
      }
      if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
        fail(422, {
          discount_approval_threshold_pct: [
            "Discount approval threshold must be between 0 and 100.",
          ],
        });
        return;
      }
      const updated = {
        ...existing,
        vat_rate_pct: vat,
        discount_approval_threshold_pct: threshold,
        ...(input.fuel_efficiency_unit
          ? { fuel_efficiency_unit: String(input.fuel_efficiency_unit) }
          : {}),
        ...(input.distance_unit
          ? { distance_unit: String(input.distance_unit) }
          : {}),
        ...(input.volume_unit ? { volume_unit: String(input.volume_unit) } : {}),
        ...(input.weight_unit ? { weight_unit: String(input.weight_unit) } : {}),
        ...(input.require_inspection_photos !== undefined
          ? { require_inspection_photos: Boolean(input.require_inspection_photos) }
          : {}),
        ...(input.require_2fa_for_privileged !== undefined
          ? { require_2fa_for_privileged: Boolean(input.require_2fa_for_privileged) }
          : {}),
      };
      companySettings.set(companyId, updated);
      completedWrites++;
      json(200, { data: updated });
      return;
    }
    fail(405);
    return;
  }

  const pdfMatch = url.pathname.match(
    /^\/api\/v1\/(quotations|reservations|rentals|invoices)\/(\d+)\/pdf$/,
  );
  if (pdfMatch && req.method === "GET") {
    const domain = pdfMatch[1];
    const targetId = Number(pdfMatch[2]);
    const pdfBytes = Buffer.from(
      `%PDF-1.4\n% DriveCore Synthetic ${domain} #${targetId}\n%%EOF`,
    );
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${domain}-${targetId}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(pdfBytes);
    return;
  }

  const quoteMatch = url.pathname.match(
    /^\/api\/v1\/quotations(?:\/(\d+)(?:\/(approve-discount|reject-discount|cancel|convert))?)?$/,
  );
  if (quoteMatch) {
    const quoteId = quoteMatch[1] ? Number(quoteMatch[1]) : null;
    const action = quoteMatch[2] ?? null;
    if (req.method === "GET" && !quoteId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.view")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...quotations.values()].filter((item) => {
        if (item.company_id !== companyId) return false;
        if (branchId !== null && item.branch_id !== branchId) return false;
        if (statusFilter && item.status !== statusFilter) return false;
        if (
          q &&
          ![
            String(item.id),
            item.customer_name ?? "",
            ...item.vehicles.map((v) => v.registration),
          ].some((s) => s.toLowerCase().includes(q))
        ) {
          return false;
        }
        return true;
      });
      paginateSlice(
        sortItems(items, {
          id: (item) => item.id,
          customer_name: (item) => item.customer_name,
          starts_at: (item) => item.starts_at,
          total_minor: (item) => item.total_minor,
          status: (item) => item.status,
          created_at: (item) => item.created_at,
        }),
      );
      return;
    }
    if (req.method === "GET" && quoteId && !action) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.view")
      ) {
        fail(403);
        return;
      }
      const rec = quotations.get(quoteId);
      if (!rec) fail(404);
      else json(200, { data: rec });
      return;
    }
    if (req.method === "POST" && !quoteId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.manage")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(input.company_id);
      const branchId = Number(input.branch_id);
      const customerId = Number(input.customer_id);
      const vehicleIds = Array.isArray(input.vehicle_ids)
        ? [...new Set(input.vehicle_ids.map(Number))]
        : [];
      if (vehicleIds.length === 0) {
        fail(422, { vehicle_ids: ["Select at least one vehicle."] });
        return;
      }
      const startMs = Date.parse(input.starts_at);
      const endMs = Date.parse(input.ends_at);
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        fail(422, { ends_at: ["Expected return must be after departure."] });
        return;
      }
      const rentalDays = Math.max(1, Math.ceil((endMs - startMs) / 86_400_000));
      const picked = [];
      for (const vId of vehicleIds) {
        const v = vehicles.get(vId);
        if (!v || v.company_id !== companyId || v.branch_id !== branchId || v.status !== "available") {
          fail(422, { vehicle_ids: ["One or more selected vehicles are unavailable."] });
          return;
        }
        if (v.daily_rate_minor <= 0) {
          fail(422, { vehicle_ids: ["All quoted vehicles must have a daily rate greater than zero."] });
          return;
        }
        picked.push(v);
      }
      const settings = companySettings.get(companyId) ?? {
        vat_rate_pct: 15,
        discount_approval_threshold_pct: 10,
      };
      const discountPct = Number(input.discount_pct ?? 0);
      if (Number.isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
        fail(422, { discount_pct: ["Discount must be between 0 and 100."] });
        return;
      }
      const quoteVehicles = picked.map((v) => ({
        vehicle_id: v.id,
        registration: v.registration,
        make: v.make,
        model: v.model,
        daily_rate_minor: v.daily_rate_minor,
        line_subtotal_minor: v.daily_rate_minor * rentalDays,
        reservation_id: null,
      }));
      const subtotalMinor = quoteVehicles.reduce(
        (sum, v) => sum + v.line_subtotal_minor,
        0,
      );
      const discountMinor = Math.round(subtotalMinor * (discountPct / 100));
      const taxableMinor = Math.max(0, subtotalMinor - discountMinor);
      const vatMinor = Math.round(taxableMinor * (settings.vat_rate_pct / 100));
      const totalMinor = taxableMinor + vatMinor;
      const needsApproval =
        discountPct > settings.discount_approval_threshold_pct;
      const customer = customers.get(customerId);
      const id = nextId++;
      const created = {
        id,
        company_id: companyId,
        branch_id: branchId,
        customer_id: customerId,
        created_by: user.id,
        customer_name: customer?.name ?? null,
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(endMs).toISOString(),
        rental_days: rentalDays,
        status: needsApproval ? "pending_approval" : "approved",
        discount_pct: discountPct,
        discount_status: needsApproval ? "pending" : "not_required",
        discount_decided_by: null,
        discount_decided_by_name: null,
        discount_decided_at: null,
        discount_decision_notes: null,
        subtotal_minor: subtotalMinor,
        discount_minor: discountMinor,
        vat_rate_pct: settings.vat_rate_pct,
        vat_minor: vatMinor,
        total_minor: totalMinor,
        notes: input.notes ? String(input.notes) : null,
        converted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vehicles: quoteVehicles,
        reservation_ids: [],
      };
      quotations.set(id, created);
      completedWrites++;
      json(201, { data: created });
      return;
    }
    if (req.method === "POST" && quoteId && (action === "approve-discount" || action === "reject-discount")) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.approve_discount")
      ) {
        fail(403);
        return;
      }
      const rec = quotations.get(quoteId);
      if (!rec) {
        fail(404);
        return;
      }
      if (rec.status !== "pending_approval" || rec.discount_status !== "pending") {
        fail(409);
        return;
      }
      const approve = action === "approve-discount";
      rec.status = approve ? "approved" : "rejected";
      rec.discount_status = approve ? "approved" : "rejected";
      rec.discount_decided_by = user.id;
      rec.discount_decided_by_name = user.name;
      rec.discount_decided_at = new Date().toISOString();
      rec.discount_decision_notes = input.notes ? String(input.notes) : null;
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: rec });
      return;
    }
    if (req.method === "POST" && quoteId && action === "cancel") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("quotations.manage")
      ) {
        fail(403);
        return;
      }
      const rec = quotations.get(quoteId);
      if (!rec) {
        fail(404);
        return;
      }
      if (rec.status !== "pending_approval" && rec.status !== "approved") {
        fail(409);
        return;
      }
      rec.status = "cancelled";
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: rec });
      return;
    }
    if (req.method === "POST" && quoteId && action === "convert") {
      if (
        !user.is_platform_admin &&
        (!user.permissions.includes("quotations.manage") ||
          !user.permissions.includes("reservations.manage"))
      ) {
        fail(403);
        return;
      }
      const rec = quotations.get(quoteId);
      if (!rec) {
        fail(404);
        return;
      }
      if (rec.status !== "approved") {
        fail(409);
        return;
      }
      const startMs = Date.parse(rec.starts_at);
      const endMs = Date.parse(rec.ends_at);
      // Verify ALL vehicles before creating ANY reservation (atomic rollback semantics)
      for (const qv of rec.vehicles) {
        const v = vehicles.get(qv.vehicle_id);
        const overlap = [...reservations.values()].some(
          (r) =>
            r.vehicle_id === qv.vehicle_id &&
            r.status === "confirmed" &&
            Date.parse(r.starts_at) < endMs &&
            Date.parse(r.ends_at) > startMs,
        );
        if (!v || v.status !== "available" || overlap) {
          fail(409);
          return;
        }
      }
      const createdIds = [];
      for (const qv of rec.vehicles) {
        const resId = nextId++;
        reservations.set(resId, {
          id: resId,
          company_id: rec.company_id,
          branch_id: rec.branch_id,
          customer_id: rec.customer_id,
          vehicle_id: qv.vehicle_id,
          created_by: user.id,
          starts_at: rec.starts_at,
          ends_at: rec.ends_at,
          status: "confirmed",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        qv.reservation_id = resId;
        createdIds.push(resId);
      }
      rec.status = "converted";
      rec.converted_at = new Date().toISOString();
      rec.reservation_ids = createdIds;
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: rec });
      return;
    }
    fail(404);
    return;
  }

  // --- M14 Credit Control, Unified Approvals & Compliance Expiries ---
  const custStmtMatch = url.pathname.match(
    /^\/api\/v1\/customers\/(\d+)\/statement$/,
  );
  if (custStmtMatch && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const custId = Number(custStmtMatch[1]);
    const cust = customers.get(custId);
    if (!cust) {
      fail(404);
      return;
    }
    const custInvoices = [...invoices.values()]
      .map(decorateInvoice)
      .filter((i) => i.customer_id === custId && i.status === "issued");
    let balance = 0;
    const rows = [];
    for (const inv of custInvoices) {
      balance += inv.total_minor;
      rows.push({
        date: (inv.issued_at || inv.created_at).slice(0, 10),
        type: "invoice",
        reference: inv.invoice_number ?? `INV-${inv.id}`,
        description: "Rental invoice",
        debit_minor: inv.total_minor,
        credit_minor: 0,
        balance_minor: balance,
      });
      for (const p of [...payments.values()].filter((x) => x.invoice_id === inv.id)) {
        balance -= p.amount_minor;
        rows.push({
          date: (p.paid_at || p.created_at).slice(0, 10),
          type: "payment",
          reference: p.reference || `PAY-${p.id}`,
          description: `Payment (${p.method})`,
          debit_minor: 0,
          credit_minor: p.amount_minor,
          balance_minor: balance,
        });
      }
    }
    json(200, {
      data: {
        customer_id: custId,
        customer_name: cust.name,
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        opening_balance_minor: 0,
        closing_balance_minor: balance,
        rows,
      },
    });
    return;
  }

  const creditAccMatch = url.pathname.match(
    /^\/api\/v1\/credit\/accounts(?:\/(\d+))?$/,
  );
  if (creditAccMatch) {
    const cid = creditAccMatch[1] ? Number(creditAccMatch[1]) : null;
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const buildCreditAcc = (c) => {
      const prof = creditProfiles.get(c.id) ?? {
        credit_limit_minor: null,
        payment_terms_days: 30,
        is_on_credit_hold: false,
        credit_hold_reason: null,
      };
      const custInvs = [...invoices.values()]
        .map(decorateInvoice)
        .filter((i) => i.customer_id === c.id && i.status === "issued");
      const openAr = custInvs.reduce((s, i) => s + i.outstanding_minor, 0);
      return {
        customer_id: c.id,
        company_id: c.company_id,
        branch_id: c.branch_id,
        customer_name: c.name,
        customer_type: c.type,
        tin: null,
        credit_limit_minor: prof.credit_limit_minor,
        payment_terms_days: prof.payment_terms_days,
        open_ar_minor: openAr,
        overdue_minor: 0,
        is_on_credit_hold: prof.is_on_credit_hold,
        credit_hold_reason: prof.credit_hold_reason,
      };
    };
    if (req.method === "GET" && !cid) {
      const companyId = Number(url.searchParams.get("company_id"));
      const holdOnly = url.searchParams.get("hold_only") === "1";
      const items = [...customers.values()]
        .filter((c) => c.company_id === companyId)
        .map(buildCreditAcc)
        .filter((a) => !holdOnly || a.is_on_credit_hold);
      json(200, {
        data: items,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length },
      });
      return;
    }
    if (req.method === "PATCH" && cid) {
      if (!user.is_platform_admin && !user.permissions.includes("invoices.manage")) {
        fail(403);
        return;
      }
      const c = customers.get(cid);
      if (!c) {
        fail(404);
        return;
      }
      const cur = creditProfiles.get(cid) ?? {
        credit_limit_minor: null,
        payment_terms_days: 30,
        is_on_credit_hold: false,
        credit_hold_reason: null,
      };
      const updated = {
        credit_limit_minor:
          input.credit_limit_minor !== undefined
            ? input.credit_limit_minor === null
              ? null
              : Number(input.credit_limit_minor)
            : cur.credit_limit_minor,
        payment_terms_days:
          input.payment_terms_days !== undefined
            ? Number(input.payment_terms_days)
            : cur.payment_terms_days,
        is_on_credit_hold:
          input.is_on_credit_hold !== undefined
            ? Boolean(input.is_on_credit_hold)
            : cur.is_on_credit_hold,
        credit_hold_reason:
          input.credit_hold_reason !== undefined
            ? input.credit_hold_reason
            : cur.credit_hold_reason,
      };
      creditProfiles.set(cid, updated);
      completedWrites++;
      json(200, { data: buildCreditAcc(c) });
      return;
    }
  }

  const collMatch = url.pathname.match(
    /^\/api\/v1\/credit\/collections(?:\/(\d+))?$/,
  );
  if (collMatch) {
    const nid = collMatch[1] ? Number(collMatch[1]) : null;
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    if (req.method === "GET" && !nid) {
      const companyId = Number(url.searchParams.get("company_id"));
      const items = [...collectionNotes.values()]
        .filter((n) => n.company_id === companyId)
        .sort((a, b) => b.id - a.id);
      json(200, {
        data: items,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length },
      });
      return;
    }
    if (req.method === "POST" && !nid) {
      if (!user.is_platform_admin && !user.permissions.includes("invoices.manage")) {
        fail(403);
        return;
      }
      const id = nextId++;
      const cust = customers.get(Number(input.customer_id));
      const rec = {
        id,
        company_id: Number(input.company_id),
        branch_id: input.branch_id ? Number(input.branch_id) : null,
        customer_id: Number(input.customer_id),
        customer_name: cust?.name ?? null,
        created_by_name: user.name,
        note_type: String(input.note_type ?? "general"),
        promised_amount_minor:
          input.promised_amount_minor != null
            ? Number(input.promised_amount_minor)
            : null,
        promised_date: input.promised_date ?? null,
        status: "open",
        notes: String(input.notes ?? "").trim(),
        created_at: new Date().toISOString(),
      };
      collectionNotes.set(id, rec);
      completedWrites++;
      json(201, { data: rec });
      return;
    }
    if (req.method === "PATCH" && nid) {
      const rec = collectionNotes.get(nid);
      if (!rec) {
        fail(404);
        return;
      }
      if (input.status) rec.status = String(input.status);
      completedWrites++;
      json(200, { data: rec });
      return;
    }
  }

  const aprMatch = url.pathname.match(
    /^\/api\/v1\/approvals(?:\/(\d+)(?:\/(approve|reject))?)?$/,
  );
  if (aprMatch) {
    const aid = aprMatch[1] ? Number(aprMatch[1]) : null;
    const decision = aprMatch[2] ?? null;
    if (req.method === "GET" && !aid) {
      const companyId = Number(url.searchParams.get("company_id"));
      const st = url.searchParams.get("status");
      const tp = url.searchParams.get("type");
      const items = [...approvalRequests.values()]
        .filter((a) => {
          if (a.company_id !== companyId) return false;
          if (st && a.status !== st) return false;
          if (tp && a.type !== tp) return false;
          return true;
        })
        .sort((a, b) => b.id - a.id);
      json(200, {
        data: items,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length },
      });
      return;
    }
    if (req.method === "POST" && !aid) {
      const id = nextId++;
      const rec = {
        id,
        company_id: Number(input.company_id),
        branch_id: input.branch_id ? Number(input.branch_id) : null,
        type: String(input.type ?? "credit_limit"),
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ? Number(input.entity_id) : null,
        title: String(input.title ?? "").trim(),
        requester_id: user.id,
        requester_name: user.name,
        approver_id: null,
        approver_name: null,
        previous_value: input.previous_value ?? null,
        requested_value: String(input.requested_value ?? "").trim(),
        approved_value: null,
        reason: String(input.reason ?? "").trim(),
        decision_notes: null,
        status: "pending",
        decided_at: null,
        created_at: new Date().toISOString(),
      };
      approvalRequests.set(id, rec);
      completedWrites++;
      json(201, { data: rec });
      return;
    }
    if (req.method === "POST" && aid && decision) {
      const rec = approvalRequests.get(aid);
      if (!rec) {
        fail(404);
        return;
      }
      if (rec.status !== "pending") {
        fail(409);
        return;
      }
      // Strict segregation of duties: requester cannot approve/reject own request
      if (rec.requester_id === user.id) {
        fail(403);
        return;
      }
      const canDecide =
        user.is_platform_admin ||
        user.permissions.includes("quotations.approve_discount") ||
        user.permissions.includes("purchase_orders.approve") ||
        user.permissions.includes("invoices.manage");
      if (!canDecide) {
        fail(403);
        return;
      }
      rec.status = decision === "approve" ? "approved" : "rejected";
      rec.approver_id = user.id;
      rec.approver_name = user.name;
      rec.approved_value =
        decision === "approve"
          ? String(input.approved_value ?? rec.requested_value)
          : null;
      rec.decision_notes = input.decision_notes ? String(input.decision_notes) : null;
      rec.decided_at = new Date().toISOString();
      if (rec.entity_type === "supplier_invoice" && rec.entity_id) {
        const si = supplierInvoices.get(rec.entity_id);
        if (si && decision === "approve") si.status = "approved";
      }
      if (rec.entity_type === "fixed_asset" && rec.entity_id) {
        const fa = fixedAssets.get(rec.entity_id);
        if (fa) fa.disposal_approval_status = rec.status;
      }
      completedWrites++;
      json(200, { data: rec });
      return;
    }
  }

  if (url.pathname === "/api/v1/compliance/expiries" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("documents.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const bucketFilter = url.searchParams.get("bucket");
    const catFilter = url.searchParams.get("category");
    const nowMs = Date.now();
    const allRows = [...documents.values()]
      .filter((d) => d.company_id === companyId && d.expires_at)
      .map((d) => {
        const diffDays = Math.ceil(
          (Date.parse(d.expires_at) - nowMs) / 86_400_000,
        );
        const bucket =
          diffDays < 0
            ? "expired"
            : diffDays <= 7
              ? "d7"
              : diffDays <= 14
                ? "d14"
                : diffDays <= 30
                  ? "d30"
                  : "valid";
        const entityLabel =
          d.entity_type === "vehicle"
            ? vehicles.get(d.entity_id)?.registration ?? `Vehicle #${d.entity_id}`
            : d.entity_type === "customer"
              ? customers.get(d.entity_id)?.name ?? `Customer #${d.entity_id}`
              : null;
        return {
          document_id: d.id,
          company_id: d.company_id,
          branch_id: d.branch_id,
          entity_type: d.entity_type ?? null,
          entity_id: d.entity_id ?? null,
          entity_label: entityLabel,
          original_name: d.original_name,
          category: d.category ?? "insurance",
          expires_at: d.expires_at,
          days_remaining: diffDays,
          bucket,
        };
      });
    const summary = {
      expired: allRows.filter((r) => r.bucket === "expired").length,
      d7: allRows.filter((r) => r.bucket === "d7").length,
      d14: allRows.filter((r) => r.bucket === "d14").length,
      d30: allRows.filter((r) => r.bucket === "d30").length,
      valid: allRows.filter((r) => r.bucket === "valid").length,
    };
    const filtered = allRows.filter(
      (r) =>
        (!bucketFilter || r.bucket === bucketFilter) &&
        (!catFilter || r.category === catFilter),
    );
    json(200, {
      data: filtered,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 25,
        total: filtered.length,
        summary,
      },
    });
    return;
  }

  // --- M15 Full Accounting: AP, Credit Notes, Bank Reconciliation, Fixed Assets & Financial Statements ---
  const hasFinanceView =
    user.is_platform_admin ||
    user.permissions.includes("invoices.view") ||
    user.permissions.includes("expenses.view") ||
    user.permissions.includes("gl.view");
  const hasFinanceManage =
    user.is_platform_admin ||
    user.permissions.includes("invoices.manage") ||
    user.permissions.includes("expenses.manage");

  const postGl = (companyId, branchId, sourceType, sourceId, memo, lines) => {
    const jeId = nextId++;
    journalEntries.set(jeId, {
      id: jeId,
      company_id: companyId,
      branch_id: branchId ?? 2,
      entry_number: `JE-${jeId}`,
      source_type: sourceType,
      source_id: sourceId,
      memo,
      posted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      lines: lines.map((l, idx) => ({
        id: jeId * 10 + idx,
        account_code: l.code,
        account_name:
          SYSTEM_GL_ACCOUNTS.find((a) => a.code === l.code)?.name ??
          `GL ${l.code}`,
        debit_minor: l.debit ?? 0,
        credit_minor: l.credit ?? 0,
      })),
    });
    return jeId;
  };

  if (url.pathname === "/api/v1/ap/ageing" && req.method === "GET") {
    if (!hasFinanceView) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const nowMs = Date.now();
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
    for (const inv of supplierInvoices.values()) {
      if (inv.company_id !== companyId || inv.outstanding_minor <= 0 || inv.status === "void")
        continue;
      const overdueDays = Math.floor((nowMs - Date.parse(inv.due_at)) / 86_400_000);
      if (overdueDays <= 0) buckets.current += inv.outstanding_minor;
      else if (overdueDays <= 30) buckets.d1_30 += inv.outstanding_minor;
      else if (overdueDays <= 60) buckets.d31_60 += inv.outstanding_minor;
      else if (overdueDays <= 90) buckets.d61_90 += inv.outstanding_minor;
      else buckets.d90_plus += inv.outstanding_minor;
    }
    const total =
      buckets.current +
      buckets.d1_30 +
      buckets.d31_60 +
      buckets.d61_90 +
      buckets.d90_plus;
    json(200, { data: { total_open_minor: total, buckets } });
    return;
  }

  const apPayMatch = url.pathname.match(/^\/api\/v1\/ap\/invoices\/(\d+)\/payments$/);
  if (apPayMatch && req.method === "POST") {
    if (!hasFinanceManage) {
      fail(403);
      return;
    }
    const inv = supplierInvoices.get(Number(apPayMatch[1]));
    if (!inv) {
      fail(404);
      return;
    }
    if (inv.match_status === "variance" && inv.status === "pending_approval") {
      fail(409);
      return;
    }
    const amt = Number(input.amount_minor ?? 0);
    if (!Number.isInteger(amt) || amt <= 0 || amt > inv.outstanding_minor) {
      fail(422, { amount_minor: ["Payment exceeds outstanding balance."] });
      return;
    }
    const spId = nextId++;
    inv.paid_minor += amt;
    inv.outstanding_minor -= amt;
    inv.status = inv.outstanding_minor === 0 ? "paid" : "partially_paid";
    supplierPayments.set(spId, {
      id: spId,
      company_id: inv.company_id,
      supplier_invoice_id: inv.id,
      amount_minor: amt,
      method: String(input.method ?? "bank_transfer"),
      paid_at: String(input.paid_at ?? new Date().toISOString().slice(0, 10)),
    });
    postGl(inv.company_id, inv.branch_id, "supplier_payment", spId, `Supplier payment ${inv.invoice_number}`, [
      { code: "2000", debit: amt, credit: 0 },
      { code: "1000", debit: 0, credit: amt },
    ]);
    completedWrites++;
    json(200, { data: inv });
    return;
  }

  if (url.pathname === "/api/v1/ap/invoices") {
    if (req.method === "GET") {
      if (!hasFinanceView) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const qStr = (url.searchParams.get("q") ?? "").toLowerCase();
      const msFilter = url.searchParams.get("match_status");
      const rows = [...supplierInvoices.values()].filter(
        (i) =>
          i.company_id === companyId &&
          (!msFilter || i.match_status === msFilter) &&
          (!qStr ||
            i.invoice_number.toLowerCase().includes(qStr) ||
            (i.supplier_name ?? "").toLowerCase().includes(qStr)),
      );
      json(200, {
        data: rows,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: rows.length },
      });
      return;
    }
    if (req.method === "POST") {
      if (!hasFinanceManage) {
        fail(403);
        return;
      }
      const companyId = Number(input.company_id ?? 1);
      const branchId = Number(input.branch_id ?? 2);
      const supplierId = Number(input.supplier_id);
      const poId = input.purchase_order_id ? Number(input.purchase_order_id) : null;
      const sub = Number(input.subtotal_minor ?? 0);
      const vat = Number(input.vat_minor ?? 0);
      const total = sub + vat;
      let matchStatus = "non_po";
      let variance = 0;
      let status = "approved";
      if (poId) {
        const po = purchaseOrders.get(poId);
        const poTotal = po?.total_minor ?? total;
        variance = total - poTotal;
        matchStatus = variance === 0 ? "matched" : "variance";
        status = variance === 0 ? "approved" : "pending_approval";
      }
      const id = nextId++;
      const sup = suppliers.get(supplierId);
      const rec = {
        id,
        company_id: companyId,
        branch_id: branchId,
        supplier_id: supplierId,
        supplier_name: sup?.name ?? `Supplier #${supplierId}`,
        purchase_order_id: poId,
        invoice_number: String(input.invoice_number ?? `SUP-${id}`),
        invoice_date: String(input.invoice_date ?? new Date().toISOString().slice(0, 10)),
        due_at: String(input.due_at ?? new Date().toISOString().slice(0, 10)),
        subtotal_minor: sub,
        vat_minor: vat,
        total_minor: total,
        paid_minor: 0,
        outstanding_minor: total,
        expense_account_code: poId ? null : String(input.expense_account_code ?? "5000"),
        match_status: matchStatus,
        variance_minor: variance,
        approval_request_id: null,
        status,
        notes: input.notes ? String(input.notes) : null,
        created_at: new Date().toISOString(),
      };
      supplierInvoices.set(id, rec);
      if (!poId) {
        postGl(companyId, branchId, "supplier_invoice", id, `Non-PO bill ${rec.invoice_number}`, [
          { code: rec.expense_account_code ?? "5000", debit: total, credit: 0 },
          { code: "2000", debit: 0, credit: total },
        ]);
      }
      completedWrites++;
      json(201, { data: rec });
      return;
    }
  }

  const cnPostMatch = url.pathname.match(/^\/api\/v1\/invoices\/(\d+)\/credit-notes$/);
  if (cnPostMatch && req.method === "POST") {
    if (!hasFinanceManage) {
      fail(403);
      return;
    }
    const inv = invoices.get(Number(cnPostMatch[1]));
    if (!inv) {
      fail(404);
      return;
    }
    if (inv.status !== "issued") {
      fail(409);
      return;
    }
    const sub = Number(input.subtotal_minor ?? 0);
    const vat = Number(input.vat_minor ?? 0);
    const total = sub + vat;
    if (total <= 0 || total > inv.outstanding_minor) {
      fail(422, { subtotal_minor: ["Credit note exceeds remaining invoice balance."] });
      return;
    }
    const id = nextId++;
    inv.outstanding_minor = Math.max(0, inv.outstanding_minor - total);
    const cn = {
      id,
      company_id: inv.company_id,
      branch_id: inv.branch_id,
      invoice_id: inv.id,
      invoice_number: `INV-${inv.id}`,
      customer_id: inv.customer_id ?? 10,
      customer_name: inv.customer_name ?? inv.custom_customer_name ?? "Customer",
      credit_note_number: `CN-${id}`,
      subtotal_minor: sub,
      vat_minor: vat,
      total_minor: total,
      reason: String(input.reason ?? ""),
      status: "posted",
      approval_request_id: null,
      posted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    creditNotes.set(id, cn);
    postGl(inv.company_id, inv.branch_id, "credit_note", id, `Credit note ${cn.credit_note_number}`, [
      { code: "4000", debit: sub, credit: 0 },
      ...(vat > 0 ? [{ code: "2100", debit: vat, credit: 0 }] : []),
      { code: "1100", debit: 0, credit: total },
    ]);
    completedWrites++;
    json(201, { data: cn });
    return;
  }

  if (url.pathname === "/api/v1/credit-notes" && req.method === "GET") {
    if (!hasFinanceView) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const rows = [...creditNotes.values()].filter((c) => c.company_id === companyId);
    json(200, {
      data: rows,
      meta: { current_page: 1, last_page: 1, per_page: 25, total: rows.length },
    });
    return;
  }

  if (url.pathname === "/api/v1/bank-accounts") {
    if (req.method === "GET") {
      if (!hasFinanceView) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const rows = [...bankAccounts.values()].filter((b) => b.company_id === companyId);
      json(200, { data: rows });
      return;
    }
    if (req.method === "POST") {
      if (!hasFinanceManage) {
        fail(403);
        return;
      }
      const id = nextId++;
      const openBal = Number(input.opening_balance_minor ?? 0);
      const acct = {
        id,
        company_id: Number(input.company_id ?? 1),
        branch_id: input.branch_id ? Number(input.branch_id) : null,
        name: String(input.name ?? "Operating Account"),
        bank_name: String(input.bank_name ?? "Bank"),
        account_number_masked: String(input.account_number_masked ?? "****0000"),
        currency: String(input.currency ?? "ZMW"),
        gl_account_code: String(input.gl_account_code ?? "1010"),
        opening_balance_minor: openBal,
        ledger_balance_minor: openBal,
        last_reconciled_at: null,
        is_active: true,
      };
      bankAccounts.set(id, acct);
      completedWrites++;
      json(201, { data: acct });
      return;
    }
  }

  const bankTxMatch = url.pathname.match(/^\/api\/v1\/bank-accounts\/(\d+)\/transactions$/);
  if (bankTxMatch) {
    const acctId = Number(bankTxMatch[1]);
    const acct = bankAccounts.get(acctId);
    if (!acct) {
      fail(404);
      return;
    }
    if (req.method === "GET") {
      if (!hasFinanceView) {
        fail(403);
        return;
      }
      const rows = [...bankTransactions.values()].filter(
        (t) => t.bank_account_id === acctId,
      );
      json(200, {
        data: rows,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: rows.length },
      });
      return;
    }
    if (req.method === "POST") {
      if (!hasFinanceManage) {
        fail(403);
        return;
      }
      const lines = Array.isArray(input.lines) ? input.lines : [];
      const created = [];
      for (const l of lines) {
        const id = nextId++;
        const tx = {
          id,
          bank_account_id: acctId,
          transaction_date: String(l.transaction_date),
          description: String(l.description),
          reference: l.reference ? String(l.reference) : null,
          amount_minor: Number(l.amount_minor),
          match_status: "unmatched",
          matched_entity_type: null,
          matched_entity_id: null,
          matched_label: null,
          reconciliation_id: null,
          suggested_matches: [],
        };
        bankTransactions.set(id, tx);
        created.push(tx);
      }
      completedWrites++;
      json(201, { data: created });
      return;
    }
  }

  const txActionMatch = url.pathname.match(/^\/api\/v1\/bank-transactions\/(\d+)\/(match|unmatch)$/);
  if (txActionMatch && req.method === "POST") {
    if (!hasFinanceManage) {
      fail(403);
      return;
    }
    const tx = bankTransactions.get(Number(txActionMatch[1]));
    if (!tx) {
      fail(404);
      return;
    }
    if (tx.reconciliation_id !== null) {
      fail(409);
      return;
    }
    if (txActionMatch[2] === "unmatch") {
      tx.match_status = "unmatched";
      tx.matched_entity_type = null;
      tx.matched_entity_id = null;
      tx.matched_label = null;
    } else if (input.mode === "adjustment") {
      const acct = bankAccounts.get(tx.bank_account_id);
      const absAmt = Math.abs(tx.amount_minor);
      const jeId = postGl(
        acct?.company_id ?? 1,
        acct?.branch_id ?? 2,
        "bank_adjustment",
        tx.id,
        `Bank fee adjustment: ${tx.description}`,
        tx.amount_minor < 0
          ? [
              { code: String(input.gl_account_code ?? "5600"), debit: absAmt, credit: 0 },
              { code: "1000", debit: 0, credit: absAmt },
            ]
          : [
              { code: "1000", debit: absAmt, credit: 0 },
              { code: String(input.gl_account_code ?? "4000"), debit: 0, credit: absAmt },
            ],
      );
      if (acct) acct.ledger_balance_minor += tx.amount_minor;
      tx.match_status = "adjusted";
      tx.matched_entity_type = "journal_entry";
      tx.matched_entity_id = jeId;
      tx.matched_label = `GL ${input.gl_account_code ?? "5600"} (JE-${jeId})`;
    } else {
      tx.match_status = "matched";
      tx.matched_entity_type = String(input.entity_type ?? "payment");
      tx.matched_entity_id = Number(input.entity_id ?? 1);
      tx.matched_label = `${tx.matched_entity_type} #${tx.matched_entity_id}`;
    }
    completedWrites++;
    json(200, { data: tx });
    return;
  }

  const reconMatch = url.pathname.match(/^\/api\/v1\/bank-accounts\/(\d+)\/reconciliations$/);
  if (reconMatch && req.method === "POST") {
    if (!hasFinanceManage) {
      fail(403);
      return;
    }
    const acct = bankAccounts.get(Number(reconMatch[1]));
    if (!acct) {
      fail(404);
      return;
    }
    const matchedTxs = [...bankTransactions.values()].filter(
      (t) =>
        t.bank_account_id === acct.id &&
        t.match_status !== "unmatched" &&
        t.reconciliation_id === null,
    );
    const reconciledBal =
      acct.opening_balance_minor +
      matchedTxs.reduce((s, t) => s + t.amount_minor, 0);
    const stmtBal = Number(input.statement_closing_balance_minor ?? 0);
    if (stmtBal !== reconciledBal) {
      fail(422, {
        statement_closing_balance_minor: [
          "Statement closing balance does not equal reconciled balance.",
        ],
      });
      return;
    }
    const reconId = nextId++;
    const recon = {
      id: reconId,
      bank_account_id: acct.id,
      statement_date: String(input.statement_date ?? new Date().toISOString().slice(0, 10)),
      statement_closing_balance_minor: stmtBal,
      reconciled_balance_minor: reconciledBal,
      status: "closed",
      closed_at: new Date().toISOString(),
    };
    bankReconciliations.set(reconId, recon);
    for (const t of matchedTxs) t.reconciliation_id = reconId;
    acct.last_reconciled_at = recon.closed_at;
    completedWrites++;
    json(201, { data: recon });
    return;
  }

  if (url.pathname === "/api/v1/fixed-assets/depreciate" && req.method === "POST") {
    if (!hasFinanceManage) {
      fail(403);
      return;
    }
    const companyId = Number(input.company_id ?? 1);
    const period = String(input.period_month ?? new Date().toISOString().slice(0, 7));
    let postedCount = 0;
    let skippedCount = 0;
    let totalDep = 0;
    for (const a of fixedAssets.values()) {
      if (a.company_id !== companyId || a.status !== "active") continue;
      const key = `${a.id}:${period}`;
      if (depreciationEntries.has(key) || a.net_book_value_minor <= a.residual_value_minor) {
        skippedCount++;
        continue;
      }
      const depreciable = Math.max(0, a.acquisition_cost_minor - a.residual_value_minor);
      const rawMonthly =
        a.depreciation_method === "reducing_balance"
          ? Math.round((a.net_book_value_minor * 2) / a.useful_life_months)
          : Math.round(depreciable / a.useful_life_months);
      const amt = Math.min(rawMonthly, a.net_book_value_minor - a.residual_value_minor);
      if (amt <= 0) {
        skippedCount++;
        continue;
      }
      a.accumulated_depreciation_minor += amt;
      a.net_book_value_minor -= amt;
      const jeId = postGl(companyId, a.branch_id, "depreciation", a.id, `Depreciation ${period} · ${a.asset_code}`, [
        { code: "5500", debit: amt, credit: 0 },
        { code: "1590", debit: 0, credit: amt },
      ]);
      depreciationEntries.set(key, {
        id: nextId++,
        fixed_asset_id: a.id,
        period_month: period,
        amount_minor: amt,
        journal_entry_id: jeId,
      });
      postedCount++;
      totalDep += amt;
    }
    completedWrites++;
    json(200, {
      data: {
        period_month: period,
        posted_count: postedCount,
        skipped_count: skippedCount,
        total_depreciation_minor: totalDep,
      },
    });
    return;
  }

  const assetDispMatch = url.pathname.match(
    /^\/api\/v1\/fixed-assets\/(\d+)\/(request-disposal|dispose)$/,
  );
  if (assetDispMatch && req.method === "POST") {
    if (!hasFinanceManage) {
      fail(403);
      return;
    }
    const asset = fixedAssets.get(Number(assetDispMatch[1]));
    if (!asset) {
      fail(404);
      return;
    }
    if (assetDispMatch[2] === "request-disposal") {
      if (asset.vehicle_id) {
        const veh = vehicles.get(asset.vehicle_id);
        if (veh && veh.status === "rented") {
          fail(409);
          return;
        }
      }
      const aprId = nextId++;
      const proceeds = Number(input.disposal_proceeds_minor ?? 0);
      approvalRequests.set(aprId, {
        id: aprId,
        company_id: asset.company_id,
        branch_id: asset.branch_id,
        type: "vehicle_disposal",
        entity_type: "fixed_asset",
        entity_id: asset.id,
        title: `Asset disposal · ${asset.asset_code}`,
        requester_id: user.id,
        requester_name: user.name,
        approver_id: null,
        approver_name: null,
        previous_value: `NBV ${(asset.net_book_value_minor / 100).toFixed(2)}`,
        requested_value: `${input.disposal_type ?? "sold"} · ${(proceeds / 100).toFixed(2)}`,
        approved_value: null,
        reason: String(input.reason ?? "Fleet disposal"),
        decision_notes: null,
        status: "pending",
        decided_at: null,
        created_at: new Date().toISOString(),
      });
      asset.status = "pending_disposal";
      asset.disposal_type = String(input.disposal_type ?? "sold");
      asset.disposal_date = String(input.disposal_date ?? new Date().toISOString().slice(0, 10));
      asset.disposal_proceeds_minor = proceeds;
      asset.disposal_approval_id = aprId;
      asset.disposal_approval_status = "pending";
      completedWrites++;
      json(200, { data: asset });
      return;
    } else {
      if (asset.disposal_approval_status !== "approved") {
        fail(409);
        return;
      }
      const proceeds = Number(
        input.disposal_proceeds_minor ?? asset.disposal_proceeds_minor ?? 0,
      );
      const gainLoss = proceeds - asset.net_book_value_minor;
      asset.status = "disposed";
      asset.disposal_proceeds_minor = proceeds;
      asset.disposal_gain_loss_minor = gainLoss;
      const lines = [
        ...(proceeds > 0 ? [{ code: "1000", debit: proceeds, credit: 0 }] : []),
        ...(asset.accumulated_depreciation_minor > 0
          ? [{ code: "1590", debit: asset.accumulated_depreciation_minor, credit: 0 }]
          : []),
        { code: "1500", debit: 0, credit: asset.acquisition_cost_minor },
        ...(gainLoss > 0
          ? [{ code: "4900", debit: 0, credit: gainLoss }]
          : gainLoss < 0
            ? [{ code: "5900", debit: Math.abs(gainLoss), credit: 0 }]
            : []),
      ];
      postGl(asset.company_id, asset.branch_id, "asset_disposal", asset.id, `Asset disposal ${asset.asset_code}`, lines);
      if (asset.vehicle_id) {
        const veh = vehicles.get(asset.vehicle_id);
        if (veh) veh.status = asset.disposal_type ?? "sold";
      }
      completedWrites++;
      json(200, { data: asset });
      return;
    }
  }

  if (url.pathname === "/api/v1/fixed-assets") {
    if (req.method === "GET") {
      if (!hasFinanceView) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const vehFilter = url.searchParams.get("vehicle_id");
      const rows = [...fixedAssets.values()].filter(
        (a) =>
          a.company_id === companyId &&
          (!vehFilter || a.vehicle_id === Number(vehFilter)),
      );
      json(200, {
        data: rows,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: rows.length },
      });
      return;
    }
    if (req.method === "POST") {
      if (!hasFinanceManage) {
        fail(403);
        return;
      }
      const id = nextId++;
      const cost = Number(input.acquisition_cost_minor ?? 0);
      const res = Number(input.residual_value_minor ?? 0);
      const vehId = input.vehicle_id ? Number(input.vehicle_id) : null;
      const veh = vehId ? vehicles.get(vehId) : null;
      const asset = {
        id,
        company_id: Number(input.company_id ?? 1),
        branch_id: Number(input.branch_id ?? 2),
        vehicle_id: vehId,
        vehicle_registration: veh?.registration ?? null,
        asset_code: String(input.asset_code ?? `FA-${id}`),
        name: String(input.name ?? "Fixed Asset"),
        category: String(input.category ?? "vehicle"),
        acquisition_cost_minor: cost,
        residual_value_minor: res,
        capitalisation_date: String(
          input.capitalisation_date ?? new Date().toISOString().slice(0, 10),
        ),
        useful_life_months: Number(input.useful_life_months ?? 60),
        depreciation_method: String(input.depreciation_method ?? "straight_line"),
        accumulated_depreciation_minor: 0,
        net_book_value_minor: cost,
        status: "active",
        disposal_type: null,
        disposal_date: null,
        disposal_proceeds_minor: null,
        disposal_gain_loss_minor: null,
        disposal_approval_id: null,
        disposal_approval_status: null,
      };
      fixedAssets.set(id, asset);
      postGl(asset.company_id, asset.branch_id, "asset_capitalisation", id, `Capitalised ${asset.asset_code}`, [
        { code: "1500", debit: cost, credit: 0 },
        { code: "1000", debit: 0, credit: cost },
      ]);
      completedWrites++;
      json(201, { data: asset });
      return;
    }
  }

  const stmtMatch = url.pathname.match(
    /^\/api\/v1\/reports\/statements\/(pnl|balance-sheet|cash-flow|vat-return)$/,
  );
  if (stmtMatch && req.method === "GET") {
    if (!hasFinanceView) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    if (stmtMatch[1] === "vat-return") {
      const issuedAr = [...invoices.values()].filter(
        (i) => i.company_id === companyId && i.status === "issued",
      );
      const postedCn = [...creditNotes.values()].filter(
        (c) => c.company_id === companyId && c.status === "posted",
      );
      const apBills = [...supplierInvoices.values()].filter(
        (b) => b.company_id === companyId && b.status !== "void",
      );
      const taxableSales = issuedAr.reduce((s, i) => s + Number(i.subtotal_minor ?? 0), 0);
      const outputVat = issuedAr.reduce((s, i) => s + Number(i.vat_minor ?? 0), 0);
      const cnVat = postedCn.reduce((s, c) => s + Number(c.vat_minor ?? 0), 0);
      const netOutputVat = Math.max(0, outputVat - cnVat);
      const taxablePurchases = apBills.reduce((s, b) => s + Number(b.subtotal_minor ?? 0), 0);
      const inputVat = apBills.reduce((s, b) => s + Number(b.vat_minor ?? 0), 0);
      json(200, {
        data: {
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          output_vat_minor: outputVat,
          credit_note_vat_minor: cnVat,
          net_output_vat_minor: netOutputVat,
          input_vat_minor: inputVat,
          net_vat_payable_minor: netOutputVat - inputVat,
          taxable_sales_minor: taxableSales,
          taxable_purchases_minor: taxablePurchases,
        },
      });
      return;
    }
    const balances = new Map();
    for (const je of journalEntries.values()) {
      if (je.company_id !== companyId) continue;
      for (const line of je.lines ?? []) {
        const prev = balances.get(line.account_code) ?? {
          account_code: line.account_code,
          account_name: line.account_name,
          debit: 0,
          credit: 0,
        };
        prev.debit += Number(line.debit_minor ?? 0);
        prev.credit += Number(line.credit_minor ?? 0);
        balances.set(line.account_code, prev);
      }
    }
    const revenueLines = [];
    const expenseLines = [];
    const assetLines = [];
    const liabilityLines = [];
    const equityLines = [];
    for (const b of balances.values()) {
      const code = String(b.account_code);
      if (code.startsWith("4")) {
        revenueLines.push({
          account_code: code,
          account_name: b.account_name,
          amount_minor: b.credit - b.debit,
        });
      } else if (code.startsWith("5")) {
        expenseLines.push({
          account_code: code,
          account_name: b.account_name,
          amount_minor: b.debit - b.credit,
        });
      } else if (code.startsWith("1")) {
        assetLines.push({
          account_code: code,
          account_name: b.account_name,
          amount_minor: b.debit - b.credit,
        });
      } else if (code.startsWith("2")) {
        liabilityLines.push({
          account_code: code,
          account_name: b.account_name,
          amount_minor: b.credit - b.debit,
        });
      } else if (code.startsWith("3")) {
        equityLines.push({
          account_code: code,
          account_name: b.account_name,
          amount_minor: b.credit - b.debit,
        });
      }
    }
    const totalRev = revenueLines.reduce((s, l) => s + l.amount_minor, 0);
    const totalExp = expenseLines.reduce((s, l) => s + l.amount_minor, 0);
    const netProfit = totalRev - totalExp;

    if (stmtMatch[1] === "pnl") {
      json(200, {
        data: {
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          revenue_lines: revenueLines,
          expense_lines: expenseLines,
          total_revenue_minor: totalRev,
          total_expenses_minor: totalExp,
          net_profit_minor: netProfit,
        },
      });
      return;
    }
    if (stmtMatch[1] === "balance-sheet") {
      if (netProfit !== 0) {
        equityLines.push({
          account_code: "3900",
          account_name: "Current Period Net Profit / (Loss)",
          amount_minor: netProfit,
        });
      }
      const totalAssets = assetLines.reduce((s, l) => s + l.amount_minor, 0);
      const totalLiab = liabilityLines.reduce((s, l) => s + l.amount_minor, 0);
      const totalEq = equityLines.reduce((s, l) => s + l.amount_minor, 0);
      json(200, {
        data: {
          as_of: url.searchParams.get("as_of") ?? new Date().toISOString().slice(0, 10),
          asset_lines: assetLines,
          liability_lines: liabilityLines,
          equity_lines: equityLines,
          total_assets_minor: totalAssets,
          total_liabilities_minor: totalLiab,
          total_equity_minor: totalEq,
          is_balanced: totalAssets === totalLiab + totalEq,
        },
      });
      return;
    }
    const cashLine = assetLines.find((l) => l.account_code === "1000");
    const cashDelta = cashLine?.amount_minor ?? 0;
    const operatingLines = [
      {
        account_code: "1000",
        account_name: "Net operating cash movement",
        amount_minor: cashDelta,
      },
    ];
    json(200, {
      data: {
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        operating_lines: operatingLines,
        investing_lines: [],
        financing_lines: [],
        operating_total_minor: cashDelta,
        investing_total_minor: 0,
        financing_total_minor: 0,
        net_cash_change_minor: cashDelta,
        opening_cash_minor: 0,
        closing_cash_minor: cashDelta,
      },
    });
    return;
  }

  // --- M16.5 Complete SRS Gap Parity Handlers ---
  const vehHistMatch = url.pathname.match(/^\/api\/v1\/vehicles\/(\d+)\/history$/);
  if (vehHistMatch && req.method === "GET") {
    const vid = Number(vehHistMatch[1]);
    const veh = vehicles.get(vid);
    if (!veh) {
      fail(404);
      return;
    }
    const vehRentals = [...rentals.values()]
      .filter((r) => r.vehicle_id === vid)
      .map((r) => {
        const dec = decorateRental(r);
        const linkedInv = [...invoices.values()].find((inv) => inv.rental_id === r.id);
        return {
          id: r.id,
          customer_name: dec.customer_name ?? "Customer",
          status: r.status,
          started_at: r.handed_over_at ?? dec.starts_at ?? null,
          returned_at: r.returned_at ?? null,
          revenue_minor: linkedInv?.total_minor ?? null,
        };
      });
    const vehFuel = [...fuelTransactions.values()]
      .filter((f) => f.vehicle_id === vid)
      .map((f) => ({
        id: f.id,
        filled_at: f.fuel_date,
        litres: f.litres,
        amount_minor: f.amount_minor,
        odometer_km: f.odometer,
        litres_per_100km: f.litres_per_100km,
        is_abnormal: f.is_abnormal,
      }));
    const vehWo = [...workOrders.values()]
      .filter((w) => w.vehicle_id === vid)
      .map((w) => ({
        id: w.id,
        title: w.title,
        status: w.status,
        total_cost_minor: w.total_cost_minor ?? 0,
        created_at: w.created_at ?? null,
      }));
    const vehInc = [...incidents.values()].filter((i) => i.vehicle_id === vid);
    json(200, {
      data: {
        vehicle_id: vid,
        rentals: vehRentals,
        fuel: vehFuel,
        work_orders: vehWo,
        incidents: vehInc,
        compliance: {
          insurance_policy_number: veh.insurance_policy_number ?? null,
          insurance_provider: veh.insurance_provider ?? null,
          insurance_expires_at: veh.insurance_expires_at ?? null,
          roadworthy_expires_at: veh.roadworthy_expires_at ?? null,
          licence_expires_at: veh.licence_expires_at ?? null,
        },
      },
    });
    return;
  }

  const incWoMatch = url.pathname.match(/^\/api\/v1\/incidents\/(\d+)\/create-work-order$/);
  if (incWoMatch && req.method === "POST") {
    const inc = incidents.get(Number(incWoMatch[1]));
    if (!inc) {
      fail(404);
      return;
    }
    const woId = nextId++;
    const nowIso = new Date().toISOString();
    const wo = {
      id: woId,
      company_id: inc.company_id,
      branch_id: inc.branch_id,
      vehicle_id: inc.vehicle_id,
      created_by: user.id,
      assigned_to: null,
      title: `Incident #${inc.id} repair (${inc.incident_type})`,
      description: inc.description,
      status: "open",
      priority: inc.severity === "major" || inc.severity === "total_loss" ? "high" : "normal",
      due_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      started_at: null,
      completed_at: null,
      odometer_at_service: vehicles.get(inc.vehicle_id)?.odometer ?? 0,
      labor_cost_minor: inc.estimated_cost_minor ?? 0,
      parts_cost_minor: 0,
      total_cost_minor: inc.estimated_cost_minor ?? 0,
      notes: inc.insurance_claim_number ? `Insurance claim ${inc.insurance_claim_number}` : null,
      items: [],
      created_at: nowIso,
      updated_at: nowIso,
    };
    workOrders.set(woId, wo);
    inc.work_order_id = woId;
    inc.status = "repairing";
    completedWrites++;
    json(201, { data: { incident: inc, work_order: wo } });
    return;
  }

  const incMatch = url.pathname.match(/^\/api\/v1\/incidents(?:\/(\d+))?$/);
  if (incMatch) {
    const incId = incMatch[1] ? Number(incMatch[1]) : null;
    if (req.method === "GET" && !incId) {
      const companyId = Number(url.searchParams.get("company_id"));
      const typeFilter = url.searchParams.get("incident_type");
      const stFilter = url.searchParams.get("status");
      const rows = [...incidents.values()]
        .filter(
          (i) =>
            i.company_id === companyId &&
            (!typeFilter || i.incident_type === typeFilter) &&
            (!stFilter || i.status === stFilter),
        )
        .sort((a, b) => b.id - a.id);
      json(200, {
        data: rows,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: rows.length },
      });
      return;
    }
    if (req.method === "POST" && !incId) {
      const id = nextId++;
      const vid = Number(input.vehicle_id);
      const veh = vehicles.get(vid);
      const rec = {
        id,
        company_id: Number(input.company_id ?? veh?.company_id ?? 1),
        branch_id: Number(input.branch_id ?? veh?.branch_id ?? 2),
        vehicle_id: vid,
        vehicle_registration: veh?.registration ?? null,
        rental_id: input.rental_id ? Number(input.rental_id) : null,
        driver_name: input.driver_name ? String(input.driver_name) : null,
        incident_type: String(input.incident_type ?? "accident"),
        severity: String(input.severity ?? "minor"),
        occurred_at: String(
          input.occurred_at ?? input.incident_date ?? new Date().toISOString().slice(0, 10),
        ),
        location: input.location ? String(input.location) : null,
        description: String(input.description ?? ""),
        insurance_claim_number: input.insurance_claim_number
          ? String(input.insurance_claim_number)
          : null,
        estimated_cost_minor:
          input.estimated_cost_minor != null ? Number(input.estimated_cost_minor) : null,
        work_order_id: null,
        status: "reported",
        created_at: new Date().toISOString(),
      };
      incidents.set(id, rec);
      if (veh && (input.mark_vehicle_unsafe || input.mark_vehicle_status)) {
        veh.status = input.mark_vehicle_status
          ? String(input.mark_vehicle_status)
          : rec.incident_type === "accident"
            ? "accident"
            : "awaiting_repair";
      }
      completedWrites++;
      json(201, { data: rec });
      return;
    }
    if (req.method === "PATCH" && incId) {
      const rec = incidents.get(incId);
      if (!rec) {
        fail(404);
        return;
      }
      Object.assign(rec, input, { id: incId });
      completedWrites++;
      json(200, { data: rec });
      return;
    }
  }

  const quoteAcceptMatch = url.pathname.match(/^\/api\/v1\/quotations\/(\d+)\/accept$/);
  if (quoteAcceptMatch && req.method === "POST") {
    const q = quotations.get(Number(quoteAcceptMatch[1]));
    if (!q) {
      fail(404);
      return;
    }
    q.customer_accepted_at = new Date().toISOString();
    q.customer_acceptance_ref = String(
      input.customer_acceptance_ref ?? "Customer accepted",
    );
    q.updated_at = new Date().toISOString();
    completedWrites++;
    json(200, { data: q });
    return;
  }

  const rentalAmendMatch = url.pathname.match(/^\/api\/v1\/rentals\/(\d+)\/amend$/);
  if (rentalAmendMatch && req.method === "POST") {
    const r = rentals.get(Number(rentalAmendMatch[1]));
    if (!r) {
      fail(404);
      return;
    }
    if (input.new_ends_at) {
      const resRec = reservations.get(r.reservation_id);
      if (resRec) resRec.ends_at = String(input.new_ends_at);
    }
    if (input.security_deposit_minor !== undefined && input.security_deposit_minor !== null) {
      r.security_deposit_minor = Number(input.security_deposit_minor);
    }
    if (input.deposit_status) {
      r.deposit_status = String(input.deposit_status);
    }
    r.updated_at = new Date().toISOString();
    completedWrites++;
    json(200, { data: decorateRental(r) });
    return;
  }

  const reqActionMatch = url.pathname.match(
    /^\/api\/v1\/purchase-requisitions\/(\d+)\/(approve|reject|convert-to-po)$/,
  );
  if (reqActionMatch && req.method === "POST") {
    const pr = purchaseRequisitions.get(Number(reqActionMatch[1]));
    if (!pr) {
      fail(404);
      return;
    }
    const act = reqActionMatch[2];
    if (act === "approve" || act === "reject") {
      pr.status = act === "approve" ? "approved" : "rejected";
      pr.decided_by_name = user.name;
      pr.decided_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: pr });
      return;
    }
    // convert-to-po
    if (pr.status !== "approved") {
      fail(409);
      return;
    }
    const poId = nextId++;
    const nowIso = new Date().toISOString();
    const firstSup =
      (pr.supplier_id ? suppliers.get(pr.supplier_id) : null) ??
      [...suppliers.values()].find((s) => s.company_id === pr.company_id) ??
      { id: 1, name: "Default Supplier" };
    const poItems = (pr.items ?? []).map((it, idx) => ({
      id: idx + 1,
      part_id: null,
      sku: null,
      description: it.description,
      quantity: it.quantity,
      unit_cost_minor: it.estimated_unit_minor,
      line_total_minor: it.quantity * it.estimated_unit_minor,
    }));
    const total = poItems.reduce((s, it) => s + it.line_total_minor, 0);
    const po = {
      id: poId,
      company_id: pr.company_id,
      branch_id: pr.branch_id,
      supplier_id: firstSup.id,
      supplier_name: firstSup.name,
      created_by: user.id,
      approved_by: null,
      po_number: `PO-${String(poId).padStart(5, "0")}`,
      status: "draft",
      expected_at: pr.needed_by,
      received_at: null,
      subtotal_minor: total,
      total_minor: total,
      notes: `Converted from ${pr.requisition_number}: ${pr.justification}`,
      items: poItems,
      created_at: nowIso,
      updated_at: nowIso,
    };
    purchaseOrders.set(poId, po);
    pr.status = "converted";
    pr.purchase_order_id = poId;
    completedWrites++;
    json(201, { data: { requisition: pr, purchase_order: po } });
    return;
  }

  if (url.pathname === "/api/v1/purchase-requisitions") {
    if (req.method === "GET") {
      const companyId = Number(url.searchParams.get("company_id"));
      const stFilter = url.searchParams.get("status");
      const rows = [...purchaseRequisitions.values()]
        .filter((p) => p.company_id === companyId && (!stFilter || p.status === stFilter))
        .sort((a, b) => b.id - a.id);
      json(200, {
        data: rows,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: rows.length },
      });
      return;
    }
    if (req.method === "POST") {
      const id = nextId++;
      const items = Array.isArray(input.items) ? input.items : [];
      const estTotal = items.reduce(
        (s, it) => s + Number(it.quantity ?? 1) * Number(it.estimated_unit_minor ?? 0),
        0,
      );
      const supId = input.supplier_id ? Number(input.supplier_id) : null;
      const sup = supId ? suppliers.get(supId) : null;
      const rec = {
        id,
        company_id: Number(input.company_id ?? 1),
        branch_id: Number(input.branch_id ?? 2),
        requisition_number: `REQ-${String(id).padStart(5, "0")}`,
        department: String(input.department ?? "Operations"),
        requester_id: user.id,
        requester_name: user.name,
        approver_id: null,
        approver_name: null,
        supplier_id: supId,
        supplier_name: sup?.name ?? null,
        needed_by: String(input.needed_by ?? new Date().toISOString().slice(0, 10)),
        justification: String(input.justification ?? ""),
        status: "pending",
        estimated_total_minor: estTotal,
        items,
        purchase_order_id: null,
        created_at: new Date().toISOString(),
      };
      purchaseRequisitions.set(id, rec);
      completedWrites++;
      json(201, { data: rec });
      return;
    }
  }

  const supStmtMatch = url.pathname.match(/^\/api\/v1\/suppliers\/(\d+)\/statement$/);
  if (supStmtMatch && req.method === "GET") {
    const sid = Number(supStmtMatch[1]);
    const sup = suppliers.get(sid);
    if (!sup) {
      fail(404);
      return;
    }
    const bills = [...supplierInvoices.values()].filter((b) => b.supplier_id === sid);
    const billIds = new Set(bills.map((b) => b.id));
    const pays = [...supplierPayments.values()].filter((p) =>
      billIds.has(p.supplier_invoice_id),
    );
    const entries = [
      ...bills.map((b) => ({
        date: b.invoice_date,
        type: "supplier_invoice",
        reference: b.invoice_number,
        description: `Supplier Invoice (${b.match_status})`,
        debit_minor: 0,
        credit_minor: b.total_minor,
      })),
      ...pays.map((p) => ({
        date: p.paid_at,
        type: "supplier_payment",
        reference: `PAY-${p.id}`,
        description: `Supplier Payment (${p.method})`,
        debit_minor: p.amount_minor,
        credit_minor: 0,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const rows = entries.map((e) => {
      running += e.credit_minor - e.debit_minor;
      return { ...e, balance_minor: running };
    });
    json(200, {
      data: {
        supplier_id: sid,
        supplier_name: sup.name,
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        opening_balance_minor: 0,
        closing_balance_minor: running,
        rows,
      },
    });
    return;
  }

  const thrMatch = url.pathname.match(/^\/api\/v1\/companies\/(\d+)\/approval-thresholds$/);
  if (thrMatch) {
    const cid = Number(thrMatch[1]);
    if (req.method === "GET") {
      json(200, { data: approvalThresholds.get(cid) ?? defaultApprovalThresholds() });
      return;
    }
    if (req.method === "PATCH") {
      if (!user.is_platform_admin && !user.permissions.includes("settings.manage")) {
        fail(403);
        return;
      }
      const next = Array.isArray(input.thresholds)
        ? input.thresholds
        : defaultApprovalThresholds();
      approvalThresholds.set(cid, next);
      completedWrites++;
      json(200, { data: next });
      return;
    }
  }

  // --- M13 Inspections, Rate Cards, Preventive Schedules, Tyres/Batteries & Fuel ---
  const rcMatch = url.pathname.match(/^\/api\/v1\/rate-cards(?:\/(\d+))?$/);
  if (rcMatch) {
    const rcId = rcMatch[1] ? Number(rcMatch[1]) : null;
    if (req.method === "GET" && !rcId) {
      const companyId = Number(url.searchParams.get("company_id"));
      const items = [...rateCards.values()]
        .filter((r) => r.company_id === companyId)
        .sort((a, b) => b.id - a.id);
      json(200, {
        data: items,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length },
      });
      return;
    }
    if (req.method === "POST" && !rcId) {
      const id = nextId++;
      const rec = {
        id,
        company_id: Number(input.company_id),
        branch_id: input.branch_id ? Number(input.branch_id) : null,
        customer_id: input.customer_id ? Number(input.customer_id) : null,
        customer_name: null,
        name: String(input.name ?? "").trim(),
        vehicle_category: input.vehicle_category ? String(input.vehicle_category) : null,
        daily_rate_minor: Number(input.daily_rate_minor ?? 0),
        weekly_rate_minor:
          input.weekly_rate_minor != null ? Number(input.weekly_rate_minor) : null,
        monthly_rate_minor:
          input.monthly_rate_minor != null ? Number(input.monthly_rate_minor) : null,
        chauffeur_daily_minor:
          input.chauffeur_daily_minor != null ? Number(input.chauffeur_daily_minor) : null,
        daily_km_limit:
          input.daily_km_limit != null ? Number(input.daily_km_limit) : null,
        excess_km_rate_minor: Number(input.excess_km_rate_minor ?? 0),
        security_deposit_minor: Number(input.security_deposit_minor ?? 0),
        late_return_hourly_minor: Number(input.late_return_hourly_minor ?? 0),
        fuel_policy: String(input.fuel_policy ?? "full_to_full"),
        is_active: input.is_active !== false,
        created_at: new Date().toISOString(),
      };
      rateCards.set(id, rec);
      completedWrites++;
      json(201, { data: rec });
      return;
    }
  }

  if (url.pathname === "/api/v1/inspections" && req.method === "GET") {
    const companyId = Number(url.searchParams.get("company_id"));
    const rentalId = url.searchParams.get("rental_id")
      ? Number(url.searchParams.get("rental_id"))
      : null;
    const vehicleId = url.searchParams.get("vehicle_id")
      ? Number(url.searchParams.get("vehicle_id"))
      : null;
    const items = [...inspections.values()].filter((i) => {
      if (i.company_id !== companyId) return false;
      if (rentalId !== null && i.rental_id !== rentalId) return false;
      if (vehicleId !== null && i.vehicle_id !== vehicleId) return false;
      return true;
    });
    json(200, {
      data: items,
      meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length },
    });
    return;
  }

  const schedMatch = url.pathname.match(
    /^\/api\/v1\/maintenance-schedules(?:\/(\d+))?$/,
  );
  if (schedMatch) {
    const scId = schedMatch[1] ? Number(schedMatch[1]) : null;
    const decorateSched = (s) => {
      const v = vehicles.get(s.vehicle_id);
      const curOdo = v?.odometer ?? 0;
      const nextOdo = s.interval_km ? s.last_service_odometer + s.interval_km : null;
      let status = "ok";
      if (nextOdo !== null && curOdo >= nextOdo) status = "overdue";
      else if (nextOdo !== null && curOdo >= nextOdo - 1000) status = "due_soon";
      return {
        ...s,
        vehicle_registration: v?.registration ?? null,
        vehicle_label: v ? `${v.make} ${v.model}` : null,
        current_odometer: curOdo,
        next_due_odometer: nextOdo,
        next_due_at: s.next_due_at ?? null,
        status,
      };
    };
    if (req.method === "GET" && !scId) {
      const companyId = Number(url.searchParams.get("company_id"));
      const stFilter = url.searchParams.get("status");
      const items = [...maintenanceSchedules.values()]
        .filter((s) => s.company_id === companyId)
        .map(decorateSched)
        .filter((s) => !stFilter || s.status === stFilter)
        .sort((a, b) => b.id - a.id);
      json(200, {
        data: items,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length },
      });
      return;
    }
    if (req.method === "POST" && !scId) {
      const id = nextId++;
      const rec = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id ?? 2),
        vehicle_id: Number(input.vehicle_id),
        service_name: String(input.service_name ?? "").trim(),
        interval_km: input.interval_km ? Number(input.interval_km) : null,
        interval_days: input.interval_days ? Number(input.interval_days) : null,
        last_service_odometer: Number(input.last_service_odometer ?? 0),
        last_service_at: input.last_service_at ?? null,
        next_due_at: null,
        is_active: true,
      };
      maintenanceSchedules.set(id, rec);
      completedWrites++;
      json(201, { data: decorateSched(rec) });
      return;
    }
  }

  const compMatch = url.pathname.match(
    /^\/api\/v1\/vehicle-components(?:\/(\d+))?$/,
  );
  if (compMatch) {
    const cid = compMatch[1] ? Number(compMatch[1]) : null;
    const decorateComp = (c) => ({
      ...c,
      vehicle_registration: vehicles.get(c.vehicle_id)?.registration ?? null,
    });
    if (req.method === "GET" && !cid) {
      const companyId = Number(url.searchParams.get("company_id"));
      const ct = url.searchParams.get("component_type");
      const items = [...vehicleComponents.values()]
        .filter((c) => c.company_id === companyId && (!ct || c.component_type === ct))
        .map(decorateComp)
        .sort((a, b) => b.id - a.id);
      json(200, {
        data: items,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length },
      });
      return;
    }
    if (req.method === "POST" && !cid) {
      const id = nextId++;
      const rec = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id ?? 2),
        vehicle_id: Number(input.vehicle_id),
        component_type: String(input.component_type ?? "tyre"),
        serial_number: String(input.serial_number ?? "").trim(),
        brand_model: String(input.brand_model ?? "").trim(),
        position: String(input.position ?? "FL"),
        installed_at: String(input.installed_at ?? "2026-11-22"),
        installed_odometer: Number(input.installed_odometer ?? 0),
        warranty_expires_at: input.warranty_expires_at ?? null,
        status: "active",
        replaced_at: null,
        notes: input.notes ?? null,
      };
      vehicleComponents.set(id, rec);
      completedWrites++;
      json(201, { data: decorateComp(rec) });
      return;
    }
    if (req.method === "PATCH" && cid) {
      const rec = vehicleComponents.get(cid);
      if (!rec) {
        fail(404);
        return;
      }
      if (input.status) rec.status = String(input.status);
      if (input.replaced_at !== undefined) rec.replaced_at = input.replaced_at;
      completedWrites++;
      json(200, { data: decorateComp(rec) });
      return;
    }
  }

  if (url.pathname === "/api/v1/fuel-transactions") {
    if (req.method === "GET") {
      const companyId = Number(url.searchParams.get("company_id"));
      const abn = url.searchParams.get("abnormal_only") === "1";
      const items = [...fuelTransactions.values()]
        .filter((f) => f.company_id === companyId && (!abn || f.is_abnormal))
        .map((f) => ({
          ...f,
          vehicle_registration: vehicles.get(f.vehicle_id)?.registration ?? null,
        }))
        .sort((a, b) => b.id - a.id);
      json(200, {
        data: items,
        meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length },
      });
      return;
    }
    if (req.method === "POST") {
      const vehicleId = Number(input.vehicle_id);
      const litres = Number(input.litres);
      const amountMinor = Number(input.amount_minor);
      const odometer = Number(input.odometer);
      const prevFills = [...fuelTransactions.values()]
        .filter((f) => f.vehicle_id === vehicleId)
        .sort((a, b) => b.odometer - a.odometer);
      const prev = prevFills[0] ?? null;
      if (prev && odometer < prev.odometer) {
        fail(422, { odometer: ["Odometer cannot be lower than previous fuel fill."] });
        return;
      }
      const kmSinceLast = prev ? odometer - prev.odometer : null;
      const lPer100 =
        kmSinceLast && kmSinceLast > 0
          ? Number(((litres / kmSinceLast) * 100).toFixed(2))
          : null;
      const costPerKm =
        kmSinceLast && kmSinceLast > 0
          ? Math.round(amountMinor / kmSinceLast)
          : null;
      const isAbnormal = lPer100 !== null && lPer100 > 33.3;

      const v = vehicles.get(vehicleId);
      const expId = nextId++;
      const nowIso = new Date().toISOString();
      expenses.set(expId, {
        id: expId,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id ?? v?.branch_id ?? 2),
        vehicle_id: vehicleId,
        vehicle_registration: v?.registration ?? null,
        recorded_by: user.id,
        category: "fuel",
        description: `Fuel fill (${litres} L${input.station ? ` at ${input.station}` : ""})`,
        amount_minor: amountMinor,
        incurred_at: String(input.fuel_date ?? nowIso.slice(0, 10)),
        created_at: nowIso,
      });
      postJournalEntry({
        companyId: Number(input.company_id),
        branchId: Number(input.branch_id ?? v?.branch_id ?? 2),
        createdBy: user.id,
        sourceType: "expense",
        sourceId: expId,
        reference: `FUEL-${expId}`,
        memo: `Fuel fill for ${v?.registration ?? `Vehicle #${vehicleId}`}`,
        lines: [
          { account_code: "5000", debit_minor: amountMinor, credit_minor: 0 },
          { account_code: "1000", debit_minor: 0, credit_minor: amountMinor },
        ],
      });

      const id = nextId++;
      const rec = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id ?? v?.branch_id ?? 2),
        vehicle_id: vehicleId,
        vehicle_registration: v?.registration ?? null,
        driver_user_id: user.id,
        driver_name: user.name,
        rental_id: input.rental_id ? Number(input.rental_id) : null,
        expense_id: expId,
        fuel_date: String(input.fuel_date ?? nowIso.slice(0, 10)),
        station: input.station ? String(input.station) : null,
        litres,
        amount_minor: amountMinor,
        odometer,
        payment_method: String(input.payment_method ?? "cash"),
        km_since_last: kmSinceLast,
        litres_per_100km: lPer100,
        cost_per_km_minor: costPerKm,
        is_abnormal: isAbnormal,
        created_at: nowIso,
      };
      fuelTransactions.set(id, rec);
      completedWrites++;
      json(201, { data: rec });
      return;
    }
  }

  // --- M11 Detailed Stats, Customer 360 & Saved Filters ---
  function inDateRange(iso, from, to) {
    if (!from && !to) return true;
    if (!iso) return false;
    const day = iso.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  }

  function computeCustomerStats(c, { from, to, canSeeFinance }) {
    const custRentals = [...rentals.values()].filter(
      (r) => r.customer_id === c.id && inDateRange(r.started_at || r.created_at, from, to),
    );
    const allCustRentals = [...rentals.values()].filter(
      (r) => r.customer_id === c.id,
    );
    const sortedRentals = [...allCustRentals].sort((a, b) =>
      String(b.started_at || b.created_at).localeCompare(
        String(a.started_at || a.created_at),
      ),
    );
    const last_rental_at = sortedRentals[0]
      ? sortedRentals[0].started_at || sortedRentals[0].created_at
      : null;

    if (!canSeeFinance) {
      return {
        rental_count: custRentals.length,
        last_rental_at,
        total_spent_minor: null,
        total_invoiced_minor: null,
        open_ar_minor: null,
        avg_rental_value_minor: null,
      };
    }

    const allIssued = [...invoices.values()]
      .map(decorateInvoice)
      .filter((i) => i.customer_id === c.id && i.status === "issued");
    // Open AR is ALWAYS live point-in-time regardless of from/to
    const open_ar_minor = allIssued.reduce(
      (sum, i) => sum + i.outstanding_minor,
      0,
    );
    const periodIssued = allIssued.filter((i) =>
      inDateRange(i.issued_at || i.created_at, from, to),
    );
    const total_invoiced_minor = periodIssued.reduce(
      (sum, i) => sum + i.total_minor,
      0,
    );
    const custInvoiceIds = new Set(allIssued.map((i) => i.id));
    const periodPaid = [...payments.values()]
      .filter(
        (p) =>
          custInvoiceIds.has(p.invoice_id) &&
          inDateRange(p.paid_at || p.created_at, from, to),
      )
      .reduce((sum, p) => sum + p.amount_minor, 0);
    const periodRefunded = [...refunds.values()]
      .filter(
        (rf) =>
          custInvoiceIds.has(rf.invoice_id) &&
          inDateRange(rf.refunded_at || rf.created_at, from, to),
      )
      .reduce((sum, rf) => sum + rf.amount_minor, 0);
    const total_spent_minor = Math.max(0, periodPaid - periodRefunded);
    const avg_rental_value_minor =
      custRentals.length > 0
        ? Math.round(total_invoiced_minor / custRentals.length)
        : 0;

    return {
      rental_count: custRentals.length,
      last_rental_at,
      total_spent_minor,
      total_invoiced_minor,
      open_ar_minor,
      avg_rental_value_minor,
    };
  }

  function computeVehicleStats(v, { from, to, canSeeFinance }) {
    const vehRentals = [...rentals.values()].filter(
      (r) =>
        r.vehicle_id === v.id &&
        inDateRange(r.started_at || r.created_at, from, to),
    );
    const utilization_pct =
      v.status === "rented"
        ? 100
        : Math.min(95, vehRentals.length * 25);
    const total_km_driven = vehRentals.reduce(
      (sum, r) =>
        sum +
        Math.max(
          0,
          (r.end_odometer ?? r.start_odometer ?? 0) - (r.start_odometer ?? 0),
        ),
      0,
    );
    const idle_days =
      v.status === "rented" ? 0 : vehRentals.length > 0 ? 5 : 21;

    if (!canSeeFinance) {
      return {
        rental_count: vehRentals.length,
        utilization_pct,
        total_km_driven,
        idle_days,
        revenue_minor: null,
        expense_minor: null,
        net_roi_minor: null,
      };
    }

    const rentalIds = new Set(vehRentals.map((r) => r.id));
    const revenue_minor = [...invoices.values()]
      .map(decorateInvoice)
      .filter(
        (i) =>
          i.status === "issued" &&
          i.rental_id &&
          rentalIds.has(i.rental_id) &&
          inDateRange(i.issued_at || i.created_at, from, to),
      )
      .reduce((sum, i) => sum + Math.max(0, i.total_minor - i.refunded_minor), 0);
    const expense_minor = [...expenses.values()]
      .filter(
        (e) =>
          e.vehicle_id === v.id &&
          inDateRange(e.incurred_at || e.created_at, from, to),
      )
      .reduce((sum, e) => sum + e.amount_minor, 0);

    return {
      rental_count: vehRentals.length,
      utilization_pct,
      total_km_driven,
      idle_days,
      revenue_minor,
      expense_minor,
      net_roi_minor: revenue_minor - expense_minor,
    };
  }

  const custSummaryMatch = url.pathname.match(
    /^\/api\/v1\/customers\/(\d+)\/summary$/,
  );
  if (custSummaryMatch && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("customers.view")) {
      fail(403);
      return;
    }
    const custId = Number(custSummaryMatch[1]);
    const c = customers.get(custId);
    if (!c) {
      fail(404);
      return;
    }
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const stats = computeCustomerStats(c, {
      from: "",
      to: "",
      canSeeFinance,
    });
    const recent_rentals = [...rentals.values()]
      .filter((r) => r.customer_id === custId)
      .sort((a, b) => b.id - a.id)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        vehicle_registration: vehicles.get(r.vehicle_id)?.registration ?? null,
        status: r.status,
        started_at: r.started_at ?? r.created_at ?? null,
        returned_at: r.returned_at ?? null,
      }));
    const recent_invoices = canSeeFinance
      ? [...invoices.values()]
          .map(decorateInvoice)
          .filter((i) => i.customer_id === custId)
          .sort((a, b) => b.id - a.id)
          .slice(0, 5)
          .map((i) => ({
            id: i.id,
            invoice_number: i.invoice_number ?? `INV-${i.id}`,
            status: i.status,
            total_minor: i.total_minor,
            outstanding_minor: i.outstanding_minor,
            due_at: i.due_at ?? null,
          }))
      : [];
    json(200, {
      data: {
        customer_id: custId,
        ...stats,
        recent_rentals,
        recent_invoices,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/stats/branches" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("reports.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const reqBranch = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const membership = user.companies.find((c) => c.id === companyId);
    const effectiveBranch =
      !user.is_platform_admin && membership?.branch_id !== null
        ? membership.branch_id
        : reqBranch;
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");

    const scopedBranches = [...branches.values()].filter(
      (b) =>
        b.company_id === companyId &&
        (effectiveBranch === null || b.id === effectiveBranch),
    );
    const rows = scopedBranches.map((b) => {
      const bVehs = [...vehicles.values()].filter(
        (v) => v.company_id === companyId && v.branch_id === b.id,
      );
      const rented = bVehs.filter((v) => v.status === "rented").length;
      const bRentals = [...rentals.values()].filter(
        (r) =>
          r.company_id === companyId &&
          r.branch_id === b.id &&
          inDateRange(r.started_at || r.created_at, from, to),
      );
      const bWos = [...workOrders.values()].filter(
        (w) => w.company_id === companyId && w.branch_id === b.id,
      );
      const bInvoices = [...invoices.values()]
        .map(decorateInvoice)
        .filter(
          (i) =>
            i.company_id === companyId &&
            i.branch_id === b.id &&
            i.status === "issued",
        );
      const periodInvoices = bInvoices.filter((i) =>
        inDateRange(i.issued_at || i.created_at, from, to),
      );
      const bExpenses = [...expenses.values()].filter(
        (e) =>
          e.company_id === companyId &&
          e.branch_id === b.id &&
          inDateRange(e.incurred_at || e.created_at, from, to),
      );
      const rev = periodInvoices.reduce(
        (s, i) => s + Math.max(0, i.total_minor - i.refunded_minor),
        0,
      );
      const exp = bExpenses.reduce((s, e) => s + e.amount_minor, 0);
      const openAr = bInvoices.reduce((s, i) => s + i.outstanding_minor, 0);
      return {
        branch_id: b.id,
        branch_name: b.name,
        fleet_total: bVehs.length,
        utilization_pct:
          bVehs.length > 0 ? Math.round((rented / bVehs.length) * 100) : 0,
        rental_count: bRentals.length,
        work_order_count: bWos.length,
        downtime_hours: bWos.length * 4,
        revenue_minor: canSeeFinance ? rev : null,
        expenses_minor: canSeeFinance ? exp : null,
        net_position_minor: canSeeFinance ? rev - exp : null,
        open_ar_minor: canSeeFinance ? openAr : null,
      };
    });
    json(200, { data: rows });
    return;
  }

  const sfMatch = url.pathname.match(/^\/api\/v1\/saved-filters(?:\/(\d+))?$/);
  if (sfMatch) {
    const sfId = sfMatch[1] ? Number(sfMatch[1]) : null;
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const isAdmin =
      user.is_platform_admin ||
      user.roles.includes("company-admin") ||
      user.permissions.includes("users.manage");

    if (req.method === "GET" && !sfId) {
      const companyId = Number(url.searchParams.get("company_id"));
      const mod = url.searchParams.get("module");
      const items = [...savedFilters.values()].filter((f) => {
        if (f.company_id !== companyId) return false;
        if (mod && f.module !== mod) return false;
        if (f.is_shared) {
          if (f.requires_finance && !canSeeFinance) return false;
          return true;
        }
        return f.user_id === user.id;
      });
      json(200, { data: items });
      return;
    }

    if (req.method === "POST" && !sfId) {
      const companyId = Number(input.company_id);
      const mod = String(input.module ?? "");
      const name = String(input.name ?? "").trim();
      const filtersObj =
        input.filters && typeof input.filters === "object" ? input.filters : {};
      const wantShared = Boolean(input.is_shared);
      if (!name || name.length > 80) {
        fail(422, { name: ["Provide a view name up to 80 characters."] });
        return;
      }
      if (wantShared && !isAdmin) {
        fail(403);
        return;
      }
      const existingCount = [...savedFilters.values()].filter(
        (f) => f.company_id === companyId && f.module === mod,
      ).length;
      if (existingCount >= 50) {
        fail(422, { name: ["Maximum of 50 saved views reached for this module."] });
        return;
      }
      const monetaryKeys = new Set([
        "min_spend_minor",
        "max_spend_minor",
        "has_open_ar",
      ]);
      const monetarySorts = new Set([
        "total_spent_minor",
        "open_ar_minor",
        "revenue_minor",
        "net_roi_minor",
      ]);
      const requiresFinance =
        Object.keys(filtersObj).some((k) => monetaryKeys.has(k)) ||
        monetarySorts.has(String(filtersObj.sort ?? ""));
      if (requiresFinance && !canSeeFinance) {
        fail(403);
        return;
      }
      const id = nextId++;
      const rec = {
        id,
        company_id: companyId,
        user_id: user.id,
        module: mod,
        name,
        filters: filtersObj,
        is_shared: wantShared,
        requires_finance: requiresFinance,
        created_at: new Date().toISOString(),
      };
      savedFilters.set(id, rec);
      completedWrites++;
      json(201, { data: rec });
      return;
    }

    if (req.method === "DELETE" && sfId) {
      const rec = savedFilters.get(sfId);
      if (!rec) {
        fail(404);
        return;
      }
      const allowed =
        (!rec.is_shared && rec.user_id === user.id) ||
        (rec.is_shared && isAdmin);
      if (!allowed) {
        fail(403);
        return;
      }
      savedFilters.delete(sfId);
      completedWrites++;
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // --- M10 Dashboard Summary, Messages, Notifications, Reports & Audit ---
  const isDriverOnly =
    !user.is_platform_admin &&
    user.roles.includes("driver") &&
    !user.permissions.includes("rentals.view");

  if (url.pathname === "/api/v1/dashboard/summary" && req.method === "GET") {
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const vehs = [...vehicles.values()].filter(
      (v) =>
        v.company_id === companyId &&
        (branchId === null || v.branch_id === branchId),
    );
    const total = vehs.length;
    const available = vehs.filter((v) => v.status === "available").length;
    const rented = vehs.filter((v) => v.status === "rented").length;
    const maintenance = vehs.filter((v) => v.status === "maintenance").length;
    const damaged = vehs.filter((v) => v.status === "damaged").length;
    const utilization_pct = total > 0 ? Math.round((rented / total) * 100) : 0;

    const scopedQuotes = [...quotations.values()].filter(
      (q) =>
        q.company_id === companyId &&
        (branchId === null || q.branch_id === branchId),
    );
    const scopedRes = [...reservations.values()].filter(
      (r) =>
        r.company_id === companyId &&
        (branchId === null || r.branch_id === branchId),
    );
    const scopedRentals = [...rentals.values()].filter(
      (r) =>
        r.company_id === companyId &&
        (branchId === null || r.branch_id === branchId),
    );
    const scopedInvoices = [...invoices.values()]
      .map(decorateInvoice)
      .filter(
        (i) =>
          i.company_id === companyId &&
          (branchId === null || i.branch_id === branchId),
      );
    const scopedExpenses = [...expenses.values()].filter(
      (e) =>
        e.company_id === companyId &&
        (branchId === null || e.branch_id === branchId),
    );
    const scopedPos = [...purchaseOrders.values()].filter(
      (po) =>
        po.company_id === companyId &&
        (branchId === null || po.branch_id === branchId),
    );
    const scopedParts = [...parts.values()]
      .map(decoratePart)
      .filter(
        (p) =>
          p.company_id === companyId &&
          (branchId === null || p.branch_id === branchId),
      );

    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const issued = scopedInvoices.filter((i) => i.status === "issued");
    const finance = canSeeFinance
      ? (() => {
          const revenue_minor = issued.reduce(
            (s, i) => s + Math.max(0, i.total_minor - i.refunded_minor),
            0,
          );
          const vat_minor = issued.reduce((s, i) => s + i.vat_minor, 0);
          const receipts_minor = issued.reduce((s, i) => s + i.net_paid_minor, 0);
          const expenses_minor = scopedExpenses.reduce(
            (s, e) => s + e.amount_minor,
            0,
          );
          const outstanding_ar_minor = issued.reduce(
            (s, i) => s + i.outstanding_minor,
            0,
          );
          return {
            revenue_minor,
            vat_minor,
            receipts_minor,
            expenses_minor,
            outstanding_ar_minor,
            net_position_minor: revenue_minor - expenses_minor,
          };
        })()
      : null;

    const driver_summary = isDriverOnly
      ? {
          active_rentals: scopedRentals.filter(
            (r) => r.driver_user_id === user.id && r.status === "active",
          ).length,
          upcoming_rentals: scopedRentals.filter(
            (r) => r.driver_user_id === user.id && r.status === "draft",
          ).length,
        }
      : null;

    const nowMs = Date.now();
    const scopedDocs = [...documents.values()].filter(
      (d) =>
        d.company_id === companyId &&
        (branchId === null || d.branch_id === branchId) &&
        d.expires_at,
    );
    const expiredDocs = scopedDocs.filter((d) => Date.parse(d.expires_at) < nowMs).length;
    const expiring30Docs = scopedDocs.filter((d) => {
      const ms = Date.parse(d.expires_at);
      return ms >= nowMs && ms <= nowMs + 30 * 86400000;
    }).length;
    const scopedCreditProfiles = [...creditProfiles.values()].filter((cp) => {
      const c = customers.get(cp.customer_id);
      return c && c.company_id === companyId;
    });
    const customersOnHold = scopedCreditProfiles.filter((cp) => cp.on_credit_hold).length;
    const overdue90 = issued
      .filter((i) => i.outstanding_minor > 0 && i.due_at && nowMs - Date.parse(i.due_at) > 90 * 86400000)
      .reduce((s, i) => s + i.outstanding_minor, 0);
    const totalAr = issued.reduce((s, i) => s + i.outstanding_minor, 0);
    const pendingAprCount = [...approvalRequests.values()].filter(
      (a) => a.company_id === companyId && a.status === "pending",
    ).length;
    const overdueReturns = scopedRentals.filter((r) => {
      if (r.status !== "active") return false;
      const resRec = reservations.get(r.reservation_id);
      return resRec && Date.parse(resRec.ends_at) < nowMs;
    }).length;
    const vehicleProfitability = canSeeFinance
      ? vehs.slice(0, 6).map((v) => {
          const rev = issued
            .filter((i) => {
              const r = i.rental_id ? rentals.get(i.rental_id) : null;
              return r && r.vehicle_id === v.id;
            })
            .reduce((s, i) => s + i.total_minor, 0);
          const cost = scopedExpenses
            .filter((e) => e.vehicle_id === v.id)
            .reduce((s, e) => s + e.amount_minor, 0);
          return {
            vehicle_id: v.id,
            registration: v.registration,
            make_model: `${v.make} ${v.model}`,
            revenue_minor: rev,
            cost_minor: cost,
            profit_minor: rev - cost,
          };
        })
      : undefined;

    json(200, {
      data: {
        fleet: { total, available, rented, maintenance, damaged, utilization_pct },
        pipeline: {
          quotations: scopedQuotes.length,
          reservations: scopedRes.length,
          active_rentals: scopedRentals.filter((r) => r.status === "active").length,
          issued_invoices: issued.length,
        },
        approvals: {
          pending_discount_quotes: scopedQuotes.filter(
            (q) => q.status === "pending_approval",
          ).length,
          pending_purchase_orders: scopedPos.filter(
            (po) => po.status === "submitted",
          ).length,
          low_stock_parts: scopedParts.filter((p) => p.is_low_stock).length,
          overdue_invoices: issued.filter((i) => i.is_overdue).length,
        },
        finance,
        driver_summary,
        credit: {
          total_receivables_minor: totalAr,
          overdue_90_plus_minor: overdue90,
          customers_on_hold: customersOnHold,
        },
        compliance: {
          expired: expiredDocs,
          expiring_30d: expiring30Docs,
        },
        operations_alerts: {
          overdue_returns: overdueReturns,
          awaiting_inspection: vehs.filter((v) => v.status === "awaiting_inspection").length,
          accident_or_repair: vehs.filter(
            (v) => v.status === "accident" || v.status === "awaiting_repair",
          ).length,
          pending_approvals: pendingAprCount,
        },
        ...(vehicleProfitability ? { vehicle_profitability: vehicleProfitability } : {}),
      },
    });
    return;
  }

  const msgMatch = url.pathname.match(/^\/api\/v1\/messages(?:\/(\d+)\/read)?$/);
  if (msgMatch) {
    const readId = msgMatch[1] ? Number(msgMatch[1]) : null;
    if (req.method === "GET" && !readId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("messages.view") &&
        !isDriverOnly
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const channel = url.searchParams.get("channel");
      if (
        isDriverOnly &&
        channel &&
        !["drivers", "dispatch"].includes(channel)
      ) {
        fail(403);
        return;
      }
      const scoped = [...messages.values()]
        .filter((m) => {
          if (m.company_id !== companyId) return false;
          if (branchId !== null && m.branch_id !== null && m.branch_id !== branchId)
            return false;
          if (isDriverOnly && !["drivers", "dispatch"].includes(m.channel))
            return false;
          if (channel && m.channel !== channel) return false;
          return true;
        })
        .sort((a, b) => b.id - a.id)
        .map((m) => ({
          id: m.id,
          company_id: m.company_id,
          branch_id: m.branch_id,
          sender_user_id: m.sender_user_id,
          sender_name: m.sender_name,
          channel: m.channel,
          body: m.body,
          related_entity_type: m.related_entity_type,
          related_entity_id: m.related_entity_id,
          is_read: Array.isArray(m.read_by) ? m.read_by.includes(user.id) : false,
          created_at: m.created_at,
        }));
      const unread_count = scoped.filter((m) => !m.is_read).length;
      json(200, {
        data: scoped.slice(0, 25),
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 25,
          total: scoped.length,
          unread_count,
        },
      });
      return;
    }
    if (req.method === "POST" && !readId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("messages.send") &&
        !isDriverOnly
      ) {
        fail(403);
        return;
      }
      const channel = String(input.channel ?? "dispatch");
      if (isDriverOnly && !["drivers", "dispatch"].includes(channel)) {
        fail(403);
        return;
      }
      const bodyStr = String(input.body ?? "").trim();
      if (!bodyStr || bodyStr.length > 1000) {
        fail(422, { body: ["Enter a message between 1 and 1000 characters."] });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: input.branch_id ? Number(input.branch_id) : null,
        sender_user_id: user.id,
        sender_name: user.name,
        channel,
        body: bodyStr,
        related_entity_type: input.related_entity_type ?? null,
        related_entity_id: input.related_entity_id
          ? Number(input.related_entity_id)
          : null,
        read_by: [user.id],
        created_at: new Date().toISOString(),
      };
      messages.set(id, created);
      completedWrites++;
      json(201, { data: { ...created, is_read: true } });
      return;
    }
    if (req.method === "POST" && readId) {
      const m = messages.get(readId);
      if (!m) {
        fail(404);
        return;
      }
      if (!m.read_by.includes(user.id)) m.read_by.push(user.id);
      json(200, { data: { ok: true } });
      return;
    }
  }

  const meetingMatch = url.pathname.match(
    /^\/api\/v1\/meetings(?:\/(\d+)(?:\/(rsvp|start|end|cancel))?)?$/,
  );
  if (meetingMatch) {
    const meetingId = meetingMatch[1] ? Number(meetingMatch[1]) : null;
    const action = meetingMatch[2] ?? null;
    const isDriverOnly =
      user.roles.includes("driver") &&
      !user.is_platform_admin &&
      !user.permissions.includes("meetings.view") &&
      !user.permissions.includes("meetings.manage");
    const isAdminUser =
      user.is_platform_admin ||
      user.roles.includes("system-administrator") ||
      user.roles.includes("company-admin");
    const canViewMeetings =
      user.is_platform_admin ||
      user.permissions.includes("meetings.view") ||
      user.permissions.includes("meetings.manage") ||
      user.permissions.includes("messages.view") ||
      isDriverOnly;
    const canManageMeetings =
      !isDriverOnly &&
      (user.is_platform_admin ||
        user.permissions.includes("meetings.manage") ||
        user.permissions.includes("messages.send"));

    if (req.method === "GET" && !meetingId) {
      if (!canViewMeetings) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const scopeFilter = url.searchParams.get("scope") ?? "all";

      const visible = [...meetings.values()]
        .filter((m) => {
          if (m.company_id !== companyId) return false;
          if (branchId !== null && m.branch_id !== null && m.branch_id !== branchId)
            return false;
          if (isDriverOnly) {
            const invited =
              m.organizer_user_id === user.id ||
              m.participants.some((p) => p.user_id === user.id);
            if (!invited) return false;
          }
          return true;
        })
        .sort((a, b) => {
          if (a.status === "live" && b.status !== "live") return -1;
          if (b.status === "live" && a.status !== "live") return 1;
          return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
        });

      const live_count = visible.filter((m) => m.status === "live").length;
      const filtered = visible.filter((m) => {
        if (statusFilter && m.status !== statusFilter) return false;
        if (scopeFilter === "upcoming") {
          return m.status === "live" || m.status === "scheduled";
        }
        if (scopeFilter === "past") {
          return m.status === "ended";
        }
        return true;
      });

      json(200, {
        data: filtered.slice(0, 25),
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 25,
          total: filtered.length,
          live_count,
        },
      });
      return;
    }

    if (req.method === "POST" && !meetingId) {
      if (!canManageMeetings) {
        fail(403);
        return;
      }
      const title = String(input.title ?? "").trim();
      if (!title || title.length > 160) {
        fail(422, { title: ["Meeting title must be between 1 and 160 characters."] });
        return;
      }
      const provider = String(input.provider ?? "jitsi_embedded");
      if (!["jitsi_embedded", "zoom", "teams", "google_meet"].includes(provider)) {
        fail(422, { provider: ["Unsupported meeting provider."] });
        return;
      }
      const companyId = Number(input.company_id);
      const branchId = input.branch_id ? Number(input.branch_id) : null;
      const durationMinutes = Math.min(
        480,
        Math.max(5, Number(input.duration_minutes ?? 30)),
      );
      const startNow = Boolean(input.start_now);
      const startDate = startNow
        ? new Date()
        : new Date(String(input.starts_at ?? new Date().toISOString()));
      if (Number.isNaN(startDate.getTime())) {
        fail(422, { starts_at: ["Invalid start timestamp."] });
        return;
      }
      const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

      let roomSlug = null;
      let joinUrl = "";
      if (provider === "jitsi_embedded") {
        roomSlug = `drivecore-${companyId}-${randomUUID().slice(0, 8)}`;
        joinUrl = `https://meet.jit.si/${roomSlug}`;
      } else {
        const rawUrl = String(input.external_join_url ?? "").trim();
        try {
          const parsed = new URL(rawUrl);
          if (parsed.protocol !== "https:") throw new Error("https required");
          joinUrl = parsed.toString();
        } catch {
          fail(422, {
            external_join_url: ["A valid https:// meeting URL is required."],
          });
          return;
        }
      }

      const id = nextId++;
      const nowIso = new Date().toISOString();
      const requestedIds = Array.isArray(input.participant_user_ids)
        ? input.participant_user_ids.map(Number).filter((n) => Number.isFinite(n))
        : [];
      const uniqueIds = new Set([user.id, ...requestedIds]);
      const participants = [...uniqueIds].map((uid) => {
        const found = managedUsers.get(uid);
        const isOrganizer = uid === user.id;
        return {
          user_id: uid,
          name: isOrganizer
            ? user.name
            : (found?.name ?? `Team Member #${uid}`),
          email: isOrganizer
            ? user.email
            : (found?.email ?? `user${uid}@drivecore.demo`),
          rsvp_status: isOrganizer ? "accepted" : "pending",
          responded_at: isOrganizer ? nowIso : null,
        };
      });

      const channel = input.post_to_channel
        ? String(input.channel ?? "dispatch")
        : null;
      const created = {
        id,
        company_id: companyId,
        branch_id: branchId,
        organizer_user_id: user.id,
        organizer_name: user.name,
        title,
        agenda: input.agenda ? String(input.agenda).trim() : null,
        provider,
        room_slug: roomSlug,
        join_url: joinUrl,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        status: startNow ? "live" : "scheduled",
        channel,
        related_entity_type: input.related_entity_type ?? null,
        related_entity_id: input.related_entity_id
          ? Number(input.related_entity_id)
          : null,
        minutes: null,
        participants,
        created_at: nowIso,
        updated_at: nowIso,
      };
      meetings.set(id, created);

      if (input.post_to_channel && channel) {
        const msgId = nextId++;
        messages.set(msgId, {
          id: msgId,
          company_id: companyId,
          branch_id: branchId,
          sender_user_id: user.id,
          sender_name: user.name,
          channel,
          body: `${startNow ? "Live meeting started" : "Meeting scheduled"}: ${title}`,
          related_entity_type: "meeting",
          related_entity_id: id,
          read_by: [user.id],
          created_at: nowIso,
        });
      }

      const notifId = nextId++;
      notifications.set(notifId, {
        id: notifId,
        company_id: companyId,
        branch_id: branchId,
        required_permission: "meetings.view",
        severity: "info",
        title: startNow ? `Live meeting: ${title}` : `Meeting invite: ${title}`,
        body: `${user.name} ${startNow ? "started" : "scheduled"} an internal virtual meeting.`,
        href: null,
        read_by: [user.id],
        created_at: nowIso,
      });

      completedWrites++;
      json(201, { data: created });
      return;
    }

    const existing = meetingId ? meetings.get(meetingId) : null;
    if (!existing) {
      fail(404);
      return;
    }
    if (
      isDriverOnly &&
      existing.organizer_user_id !== user.id &&
      !existing.participants.some((p) => p.user_id === user.id)
    ) {
      fail(404);
      return;
    }

    if (req.method === "GET" && !action) {
      if (!canViewMeetings) {
        fail(403);
        return;
      }
      json(200, { data: existing });
      return;
    }

    if (req.method === "POST" && action === "rsvp") {
      if (!canViewMeetings) {
        fail(403);
        return;
      }
      const nextStatus = String(input.rsvp_status ?? "");
      if (!["accepted", "tentative", "declined"].includes(nextStatus)) {
        fail(422, { rsvp_status: ["Invalid RSVP status."] });
        return;
      }
      const nowIso = new Date().toISOString();
      const idx = existing.participants.findIndex((p) => p.user_id === user.id);
      if (idx >= 0) {
        existing.participants[idx] = {
          ...existing.participants[idx],
          rsvp_status: nextStatus,
          responded_at: nowIso,
        };
      } else {
        existing.participants.push({
          user_id: user.id,
          name: user.name,
          email: user.email,
          rsvp_status: nextStatus,
          responded_at: nowIso,
        });
      }
      existing.updated_at = nowIso;
      completedWrites++;
      json(200, { data: existing });
      return;
    }

    const canOrganize = existing.organizer_user_id === user.id || isAdminUser;
    if (!canOrganize) {
      fail(403);
      return;
    }

    if (req.method === "PATCH" && !action) {
      const nowIso = new Date().toISOString();
      if (typeof input.title === "string" && input.title.trim()) {
        existing.title = input.title.trim().slice(0, 160);
      }
      if ("agenda" in input) {
        existing.agenda = input.agenda ? String(input.agenda).trim() : null;
      }
      if ("minutes" in input) {
        existing.minutes = input.minutes ? String(input.minutes).trim() : null;
      }
      if (typeof input.starts_at === "string") {
        const startDate = new Date(input.starts_at);
        if (!Number.isNaN(startDate.getTime())) {
          const durationMinutes = Math.min(
            480,
            Math.max(5, Number(input.duration_minutes ?? 30)),
          );
          existing.starts_at = startDate.toISOString();
          existing.ends_at = new Date(
            startDate.getTime() + durationMinutes * 60_000,
          ).toISOString();
        }
      }
      if (
        typeof input.provider === "string" &&
        ["jitsi_embedded", "zoom", "teams", "google_meet"].includes(input.provider)
      ) {
        existing.provider = input.provider;
        if (input.provider === "jitsi_embedded") {
          existing.room_slug =
            existing.room_slug ||
            `drivecore-${existing.company_id}-${randomUUID().slice(0, 8)}`;
          existing.join_url = `https://meet.jit.si/${existing.room_slug}`;
        } else if (typeof input.external_join_url === "string") {
          try {
            const parsed = new URL(input.external_join_url.trim());
            if (parsed.protocol !== "https:") throw new Error("https required");
            existing.join_url = parsed.toString();
            existing.room_slug = null;
          } catch {
            fail(422, {
              external_join_url: ["A valid https:// meeting URL is required."],
            });
            return;
          }
        }
      }
      existing.updated_at = nowIso;
      completedWrites++;
      json(200, { data: existing });
      return;
    }

    if (req.method === "POST" && action === "start") {
      if (existing.status === "ended" || existing.status === "cancelled") {
        fail(409);
        return;
      }
      existing.status = "live";
      existing.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: existing });
      return;
    }

    if (req.method === "POST" && action === "end") {
      if (existing.status === "cancelled") {
        fail(409);
        return;
      }
      existing.status = "ended";
      if ("minutes" in input) {
        existing.minutes = input.minutes ? String(input.minutes).trim() : null;
      }
      existing.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: existing });
      return;
    }

    if (req.method === "POST" && action === "cancel") {
      if (existing.status === "ended" || existing.status === "cancelled") {
        fail(409);
        return;
      }
      existing.status = "cancelled";
      existing.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: existing });
      return;
    }
  }

  const notifMatch = url.pathname.match(
    /^\/api\/v1\/notifications(?:\/(read-all|(\d+)\/read))?$/,
  );
  if (notifMatch) {
    if (req.method === "GET" && !notifMatch[1]) {
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const scoped = [...notifications.values()]
        .filter((n) => {
          if (n.company_id !== companyId) return false;
          if (branchId !== null && n.branch_id !== null && n.branch_id !== branchId)
            return false;
          if (
            n.required_permission &&
            !user.is_platform_admin &&
            !user.permissions.includes(n.required_permission)
          )
            return false;
          return true;
        })
        .sort((a, b) => b.id - a.id)
        .map((n) => ({
          id: n.id,
          company_id: n.company_id,
          branch_id: n.branch_id,
          severity: n.severity,
          title: n.title,
          body: n.body,
          href: n.href,
          read_at: n.read_by.includes(user.id) ? n.created_at : null,
          created_at: n.created_at,
        }));
      const unread_count = scoped.filter((n) => !n.read_at).length;
      json(200, {
        data: scoped.slice(0, 25),
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 25,
          total: scoped.length,
          unread_count,
        },
      });
      return;
    }
    if (req.method === "POST" && notifMatch[1] === "read-all") {
      const companyId = Number(input.company_id);
      for (const n of notifications.values()) {
        if (n.company_id === companyId && !n.read_by.includes(user.id)) {
          n.read_by.push(user.id);
        }
      }
      json(200, { data: { ok: true } });
      return;
    }
    if (req.method === "POST" && notifMatch[2]) {
      const n = notifications.get(Number(notifMatch[2]));
      if (!n) {
        fail(404);
        return;
      }
      if (!n.read_by.includes(user.id)) n.read_by.push(user.id);
      json(200, { data: { ok: true } });
      return;
    }
  }

  if (url.pathname === "/api/v1/reports/financial" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const invs = [...invoices.values()]
      .map(decorateInvoice)
      .filter(
        (i) =>
          i.company_id === companyId &&
          (branchId === null || i.branch_id === branchId) &&
          i.status === "issued",
      );
    const exps = [...expenses.values()].filter(
      (e) =>
        e.company_id === companyId &&
        (branchId === null || e.branch_id === branchId),
    );
    const invoiced_minor = invs.reduce((s, i) => s + i.total_minor, 0);
    const vat_minor = invs.reduce((s, i) => s + i.vat_minor, 0);
    const receipts_minor = invs.reduce((s, i) => s + i.paid_minor, 0);
    const refunds_minor = invs.reduce((s, i) => s + i.refunded_minor, 0);
    const expenses_minor = exps.reduce((s, e) => s + e.amount_minor, 0);
    const outstanding_ar_minor = invs.reduce((s, i) => s + i.outstanding_minor, 0);
    const rows = [
      ...invs.map((i) => ({
        id: `inv-${i.id}`,
        date: i.issued_at ?? i.created_at,
        type: "invoice",
        reference: i.invoice_number,
        counterparty: i.customer_name ?? i.custom_customer_name ?? "Customer",
        amount_minor: i.total_minor,
        vat_minor: i.vat_minor,
        status: i.outstanding_minor === 0 ? "paid" : "issued",
      })),
      ...exps.map((e) => ({
        id: `exp-${e.id}`,
        date: e.incurred_at,
        type: "expense",
        reference: `EXP-${e.id}`,
        counterparty: e.description,
        amount_minor: -e.amount_minor,
        vat_minor: 0,
        status: e.category,
      })),
    ];
    json(200, {
      data: {
        summary: {
          invoiced_minor,
          vat_minor,
          receipts_minor,
          refunds_minor,
          expenses_minor,
          outstanding_ar_minor,
          net_position_minor: invoiced_minor - refunds_minor - expenses_minor,
        },
        rows,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/reports/fleet" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("vehicles.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const rows = [...vehicles.values()]
      .filter(
        (v) =>
          v.company_id === companyId &&
          (branchId === null || v.branch_id === branchId),
      )
      .map((v) => {
        const vehRentals = [...rentals.values()].filter(
          (r) => r.vehicle_id === v.id,
        );
        const vehWos = [...workOrders.values()].filter(
          (w) => w.vehicle_id === v.id,
        );
        const maintCost = vehWos
          .filter((w) => w.status === "completed")
          .reduce((s, w) => s + w.labour_cost_minor + w.parts_cost_minor, 0);
        const rentalIds = new Set(vehRentals.map((r) => r.id));
        const rev = [...invoices.values()]
          .filter((i) => i.status === "issued" && i.rental_id && rentalIds.has(i.rental_id))
          .reduce((s, i) => s + i.total_minor, 0);
        return {
          vehicle_id: v.id,
          registration: v.registration,
          make_model: `${v.make} ${v.model}`,
          status: v.status,
          rental_count: vehRentals.length,
          work_order_count: vehWos.length,
          downtime_hours: vehWos.filter((w) => w.started_at).length * 2,
          revenue_minor: canSeeFinance ? rev : null,
          maintenance_cost_minor: canSeeFinance ? maintCost : null,
          net_roi_minor: canSeeFinance ? rev - maintCost : null,
        };
      });
    json(200, { data: rows });
    return;
  }

  if (url.pathname === "/api/v1/audit-events" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("audit.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...auditEvents.values()]
      .filter((a) => {
        if (a.company_id !== companyId) return false;
        if (
          q &&
          ![a.actor_name ?? "", a.action, a.summary].some((s) =>
            s.toLowerCase().includes(q),
          )
        )
          return false;
        return true;
      })
      .sort((a, b) => b.id - a.id);
    paginateSlice(items);
    return;
  }

  // --- M9 Maintenance, Inventory, Procurement & Vehicle 360 ---
  function partOnHand(partId) {
    return [...stockMovements.values()]
      .filter((m) => m.part_id === partId)
      .reduce((sum, m) => sum + m.quantity, 0);
  }

  function decoratePart(part) {
    const on_hand = partOnHand(part.id);
    return { ...part, on_hand, is_low_stock: on_hand <= part.min_stock };
  }

  function decorateMovement(m) {
    const p = parts.get(m.part_id);
    return { ...m, part_sku: p?.sku ?? null, part_name: p?.name ?? null };
  }

  function decorateWorkOrder(wo) {
    const v = vehicles.get(wo.vehicle_id);
    const movements = [...stockMovements.values()]
      .filter((m) => m.work_order_id === wo.id)
      .map(decorateMovement);
    return {
      ...wo,
      vehicle_registration: v?.registration ?? null,
      vehicle_label: v ? `${v.make} ${v.model}` : null,
      total_cost_minor: wo.labour_cost_minor + wo.parts_cost_minor,
      movements,
    };
  }

  function decoratePo(po) {
    const sup = suppliers.get(po.supplier_id);
    return {
      ...po,
      supplier_name: sup?.name ?? null,
      lines: po.lines.map((l) => {
        const p = parts.get(l.part_id);
        return { ...l, part_sku: p?.sku ?? null, part_name: p?.name ?? null };
      }),
    };
  }

  const summaryMatch = url.pathname.match(/^\/api\/v1\/vehicles\/(\d+)\/summary$/);
  if (summaryMatch && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("vehicles.view")) {
      fail(403);
      return;
    }
    const vehicleId = Number(summaryMatch[1]);
    const v = vehicles.get(vehicleId);
    if (!v) {
      fail(404);
      return;
    }
    const vehWos = [...workOrders.values()]
      .filter((w) => w.vehicle_id === vehicleId)
      .sort((a, b) => b.id - a.id);
    const nowMs = Date.now();
    const totalDowntimeHours = vehWos.reduce((hrs, w) => {
      if (!w.started_at) return hrs;
      const endMs = w.completed_at ? Date.parse(w.completed_at) : nowMs;
      return hrs + Math.max(0, (endMs - Date.parse(w.started_at)) / 3_600_000);
    }, 0);
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    let cumulativeRevenue = null;
    let maintCost = null;
    let otherExpenses = null;
    let netRoi = null;
    if (canSeeFinance) {
      const vehRentalIds = new Set(
        [...rentals.values()]
          .filter((r) => r.vehicle_id === vehicleId)
          .map((r) => r.id),
      );
      cumulativeRevenue = [...invoices.values()]
        .filter((i) => i.status === "issued" && i.rental_id && vehRentalIds.has(i.rental_id))
        .reduce((sum, i) => {
          const dec = decorateInvoice(i);
          return sum + Math.max(0, dec.total_minor - dec.refunded_minor);
        }, 0);
      maintCost = vehWos
        .filter((w) => w.status === "completed")
        .reduce((sum, w) => sum + w.labour_cost_minor + w.parts_cost_minor, 0);
      const woExpenseIds = new Set(
        vehWos.map((w) => w.expense_id).filter(Boolean),
      );
      otherExpenses = [...expenses.values()]
        .filter((e) => e.vehicle_id === vehicleId && !woExpenseIds.has(e.id))
        .reduce((sum, e) => sum + e.amount_minor, 0);
      netRoi = cumulativeRevenue - maintCost - otherExpenses;
    }
    json(200, {
      data: {
        vehicle_id: vehicleId,
        work_order_count: vehWos.length,
        open_work_order_count: vehWos.filter(
          (w) => w.status === "open" || w.status === "in_progress",
        ).length,
        total_downtime_hours: Number(totalDowntimeHours.toFixed(1)),
        cumulative_revenue_minor: cumulativeRevenue,
        maintenance_cost_minor: maintCost,
        other_expenses_minor: otherExpenses,
        net_roi_minor: netRoi,
        recent_work_orders: vehWos.slice(0, 5).map(decorateWorkOrder),
      },
    });
    return;
  }

  const woMatch = url.pathname.match(
    /^\/api\/v1\/work-orders(?:\/(\d+)(?:\/(start|consume-parts|complete|cancel))?)?$/,
  );
  if (woMatch) {
    const woId = woMatch[1] ? Number(woMatch[1]) : null;
    const action = woMatch[2] ?? null;
    if (req.method === "GET" && !woId) {
      if (!user.is_platform_admin && !user.permissions.includes("work_orders.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const vehicleFilter = url.searchParams.get("vehicle_id")
        ? Number(url.searchParams.get("vehicle_id"))
        : null;
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...workOrders.values()]
        .map(decorateWorkOrder)
        .filter((w) => {
          if (w.company_id !== companyId) return false;
          if (branchId !== null && w.branch_id !== branchId) return false;
          if (statusFilter && w.status !== statusFilter) return false;
          if (vehicleFilter !== null && w.vehicle_id !== vehicleFilter) return false;
          if (
            q &&
            ![w.title, w.vehicle_registration ?? "", w.notes ?? ""].some((s) =>
              s.toLowerCase().includes(q),
            )
          )
            return false;
          return true;
        });
      paginateSlice(
        sortItems(items, {
          id: (w) => w.id,
          vehicle_registration: (w) => w.vehicle_registration,
          title: (w) => w.title,
          due_at: (w) => w.due_at,
          total_cost_minor: (w) => w.total_cost_minor,
          status: (w) => w.status,
        }),
      );
      return;
    }
    if (req.method === "GET" && woId && !action) {
      if (!user.is_platform_admin && !user.permissions.includes("work_orders.view")) {
        fail(403);
        return;
      }
      const wo = workOrders.get(woId);
      if (!wo) fail(404);
      else json(200, { data: decorateWorkOrder(wo) });
      return;
    }
    if (req.method === "POST" && !woId) {
      if (!user.is_platform_admin && !user.permissions.includes("work_orders.manage")) {
        fail(403);
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        vehicle_id: Number(input.vehicle_id),
        created_by: user.id,
        title: String(input.title ?? "").trim(),
        status: "open",
        due_at: input.due_at || new Date(Date.now() + 86_400_000).toISOString(),
        started_at: null,
        completed_at: null,
        labour_cost_minor: Number(input.labour_cost_minor ?? 0),
        parts_cost_minor: 0,
        notes: input.notes ? String(input.notes) : null,
        completion_notes: null,
        expense_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      workOrders.set(id, created);
      completedWrites++;
      json(201, { data: decorateWorkOrder(created) });
      return;
    }
    if (req.method === "POST" && woId && action) {
      if (!user.is_platform_admin && !user.permissions.includes("work_orders.manage")) {
        fail(403);
        return;
      }
      const wo = workOrders.get(woId);
      if (!wo) {
        fail(404);
        return;
      }
      const v = vehicles.get(wo.vehicle_id);
      if (action === "start") {
        const hasFutureRes = [...reservations.values()].some(
          (r) =>
            r.vehicle_id === wo.vehicle_id &&
            r.status === "confirmed" &&
            Date.parse(r.ends_at) > Date.now(),
        );
        const hasActiveWo = [...workOrders.values()].some(
          (other) =>
            other.id !== wo.id &&
            other.vehicle_id === wo.vehicle_id &&
            other.status === "in_progress",
        );
        if (
          wo.status !== "open" ||
          !v ||
          v.status === "rented" ||
          hasFutureRes ||
          hasActiveWo
        ) {
          fail(409);
          return;
        }
        wo.status = "in_progress";
        wo.started_at = new Date().toISOString();
        wo.updated_at = wo.started_at;
        v.status = "maintenance";
        completedWrites++;
        json(200, { data: decorateWorkOrder(wo) });
        return;
      }
      if (action === "consume-parts") {
        if (wo.status !== "in_progress") {
          fail(409);
          return;
        }
        const part = parts.get(Number(input.part_id));
        const qty = Number(input.quantity);
        if (!part || !Number.isInteger(qty) || qty < 1) {
          fail(422, { quantity: ["Select a valid part and positive quantity."] });
          return;
        }
        if (partOnHand(part.id) < qty) {
          fail(422, { quantity: ["Insufficient stock on hand for this part."] });
          return;
        }
        const mId = nextId++;
        stockMovements.set(mId, {
          id: mId,
          company_id: wo.company_id,
          branch_id: wo.branch_id,
          part_id: part.id,
          recorded_by: user.id,
          quantity: -qty,
          unit_cost_minor: part.unit_cost_minor,
          reason: "Maintenance consumption",
          work_order_id: wo.id,
          purchase_order_id: null,
          created_at: new Date().toISOString(),
        });
        const lineCost = qty * part.unit_cost_minor;
        wo.parts_cost_minor += lineCost;
        wo.updated_at = new Date().toISOString();
        if (lineCost > 0) {
          postJournalEntry({
            companyId: wo.company_id,
            branchId: wo.branch_id,
            createdBy: user.id,
            sourceType: "work_order",
            sourceId: wo.id,
            reference: `WO-${wo.id}`,
            memo: `Parts consumed on WO #${wo.id}`,
            lines: [
              { account_code: "1250", debit_minor: lineCost, credit_minor: 0 },
              { account_code: "1200", debit_minor: 0, credit_minor: lineCost },
            ],
          });
        }
        completedWrites++;
        json(200, { data: decorateWorkOrder(wo) });
        return;
      }
      if (action === "complete") {
        if (wo.status !== "in_progress") {
          fail(409);
          return;
        }
        if (input.labour_cost_minor !== undefined) {
          wo.labour_cost_minor = Math.max(0, Number(input.labour_cost_minor));
        }
        if (input.completion_notes) {
          wo.completion_notes = String(input.completion_notes);
        }
        wo.status = "completed";
        wo.completed_at = new Date().toISOString();
        wo.updated_at = wo.completed_at;
        if (v) v.status = "available";
        const total = wo.labour_cost_minor + wo.parts_cost_minor;
        if (total > 0) {
          const expId = nextId++;
          expenses.set(expId, {
            id: expId,
            company_id: wo.company_id,
            branch_id: wo.branch_id,
            vehicle_id: wo.vehicle_id,
            vehicle_registration: v?.registration ?? null,
            recorded_by: user.id,
            category: "maintenance",
            description: `Work order #${wo.id}: ${wo.title}`,
            amount_minor: total,
            incurred_at: wo.completed_at,
            created_at: wo.completed_at,
          });
          wo.expense_id = expId;
          postJournalEntry({
            companyId: wo.company_id,
            branchId: wo.branch_id,
            createdBy: user.id,
            sourceType: "work_order",
            sourceId: wo.id,
            reference: `WO-${wo.id}`,
            memo: `Completed work order #${wo.id}: ${wo.title}`,
            lines: [
              { account_code: "5000", debit_minor: total, credit_minor: 0 },
              {
                account_code: "1250",
                debit_minor: 0,
                credit_minor: wo.parts_cost_minor,
              },
              {
                account_code: "1000",
                debit_minor: 0,
                credit_minor: wo.labour_cost_minor,
              },
            ],
          });
        }
        completedWrites++;
        json(200, { data: decorateWorkOrder(wo) });
        return;
      }
      if (action === "cancel") {
        if (wo.status !== "open") {
          fail(409);
          return;
        }
        wo.status = "cancelled";
        wo.updated_at = new Date().toISOString();
        completedWrites++;
        json(200, { data: decorateWorkOrder(wo) });
        return;
      }
    }
    fail(404);
    return;
  }

  const partMatch = url.pathname.match(/^\/api\/v1\/parts(?:\/(\d+)(?:\/(adjust))?)?$/);
  if (partMatch) {
    const partId = partMatch[1] ? Number(partMatch[1]) : null;
    const action = partMatch[2] ?? null;
    if (req.method === "GET" && !partId) {
      if (!user.is_platform_admin && !user.permissions.includes("parts.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const lowOnly =
        url.searchParams.get("low_stock_only") === "1" ||
        url.searchParams.get("low_stock_only") === "true";
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...parts.values()]
        .map(decoratePart)
        .filter((p) => {
          if (p.company_id !== companyId) return false;
          if (branchId !== null && p.branch_id !== branchId) return false;
          if (lowOnly && !p.is_low_stock) return false;
          if (
            q &&
            ![p.sku, p.name].some((s) => s.toLowerCase().includes(q))
          )
            return false;
          return true;
        });
      paginateSlice(
        sortItems(items, {
          id: (p) => p.id,
          sku: (p) => p.sku,
          name: (p) => p.name,
          unit_cost_minor: (p) => p.unit_cost_minor,
          on_hand: (p) => p.on_hand,
          min_stock: (p) => p.min_stock,
        }),
      );
      return;
    }
    if (req.method === "POST" && !partId) {
      if (!user.is_platform_admin && !user.permissions.includes("parts.manage")) {
        fail(403);
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        sku: String(input.sku ?? "").trim().toUpperCase(),
        name: String(input.name ?? "").trim(),
        unit_cost_minor: Math.max(0, Number(input.unit_cost_minor ?? 0)),
        min_stock: Math.max(0, Number(input.min_stock ?? 0)),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      parts.set(id, created);
      completedWrites++;
      json(201, { data: decoratePart(created) });
      return;
    }
    if (req.method === "PATCH" && partId && !action) {
      if (!user.is_platform_admin && !user.permissions.includes("parts.manage")) {
        fail(403);
        return;
      }
      const p = parts.get(partId);
      if (!p) {
        fail(404);
        return;
      }
      Object.assign(p, {
        sku: input.sku ? String(input.sku).trim().toUpperCase() : p.sku,
        name: input.name ? String(input.name).trim() : p.name,
        unit_cost_minor:
          input.unit_cost_minor !== undefined
            ? Math.max(0, Number(input.unit_cost_minor))
            : p.unit_cost_minor,
        min_stock:
          input.min_stock !== undefined
            ? Math.max(0, Number(input.min_stock))
            : p.min_stock,
        updated_at: new Date().toISOString(),
      });
      completedWrites++;
      json(200, { data: decoratePart(p) });
      return;
    }
    if (req.method === "POST" && partId && action === "adjust") {
      if (!user.is_platform_admin && !user.permissions.includes("parts.manage")) {
        fail(403);
        return;
      }
      const p = parts.get(partId);
      if (!p) {
        fail(404);
        return;
      }
      const qty = Number(input.quantity);
      if (!Number.isInteger(qty) || qty === 0) {
        fail(422, { quantity: ["Enter a nonzero whole stock adjustment."] });
        return;
      }
      if (partOnHand(p.id) + qty < 0) {
        fail(422, { quantity: ["Stock on hand cannot become negative."] });
        return;
      }
      const mId = nextId++;
      stockMovements.set(mId, {
        id: mId,
        company_id: p.company_id,
        branch_id: p.branch_id,
        part_id: p.id,
        recorded_by: user.id,
        quantity: qty,
        unit_cost_minor: p.unit_cost_minor,
        reason: String(input.reason ?? "Stock adjustment").trim(),
        work_order_id: null,
        purchase_order_id: null,
        created_at: new Date().toISOString(),
      });
      const val = Math.abs(qty) * p.unit_cost_minor;
      if (val > 0) {
        postJournalEntry({
          companyId: p.company_id,
          branchId: p.branch_id,
          createdBy: user.id,
          sourceType: "stock_adjustment",
          sourceId: mId,
          reference: `ADJ-${mId} (${p.sku})`,
          memo: String(input.reason ?? "Stock adjustment").trim(),
          lines:
            qty > 0
              ? [
                  { account_code: "1200", debit_minor: val, credit_minor: 0 },
                  { account_code: "5000", debit_minor: 0, credit_minor: val },
                ]
              : [
                  { account_code: "5000", debit_minor: val, credit_minor: 0 },
                  { account_code: "1200", debit_minor: 0, credit_minor: val },
                ],
        });
      }
      completedWrites++;
      json(200, { data: decoratePart(p) });
      return;
    }
    fail(404);
    return;
  }

  if (url.pathname === "/api/v1/stock-movements" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("parts.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...stockMovements.values()]
      .map(decorateMovement)
      .filter((m) => {
        if (m.company_id !== companyId) return false;
        if (branchId !== null && m.branch_id !== branchId) return false;
        if (
          q &&
          ![m.part_name ?? "", m.part_sku ?? "", m.reason].some((s) =>
            s.toLowerCase().includes(q),
          )
        )
          return false;
        return true;
      })
      .sort((a, b) => b.id - a.id);
    paginateSlice(
      sortItems(items, {
        id: (m) => m.id,
        created_at: (m) => m.created_at,
        part_name: (m) => m.part_name,
        quantity: (m) => m.quantity,
        unit_cost_minor: (m) => m.unit_cost_minor,
      }),
    );
    return;
  }

  const supMatch = url.pathname.match(/^\/api\/v1\/suppliers(?:\/(\d+))?$/);
  if (supMatch) {
    const supId = supMatch[1] ? Number(supMatch[1]) : null;
    if (req.method === "GET" && !supId) {
      if (!user.is_platform_admin && !user.permissions.includes("suppliers.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...suppliers.values()].filter((s) => {
        if (s.company_id !== companyId) return false;
        if (q && ![s.name, s.email ?? ""].some((v) => v.toLowerCase().includes(q)))
          return false;
        return true;
      });
      paginateSlice(
        sortItems(items, {
          id: (s) => s.id,
          name: (s) => s.name,
          email: (s) => s.email,
          is_active: (s) => s.is_active,
        }),
      );
      return;
    }
    if (req.method === "POST" && !supId) {
      if (!user.is_platform_admin && !user.permissions.includes("suppliers.manage")) {
        fail(403);
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        name: String(input.name ?? "").trim(),
        email: input.email ? String(input.email).trim() : null,
        phone: input.phone ? String(input.phone).trim() : null,
        is_active: input.is_active !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      suppliers.set(id, created);
      completedWrites++;
      json(201, { data: created });
      return;
    }
    fail(404);
    return;
  }

  const poMatch = url.pathname.match(
    /^\/api\/v1\/purchase-orders(?:\/(\d+)(?:\/(submit|approve|receive|cancel))?)?$/,
  );
  if (poMatch) {
    const poId = poMatch[1] ? Number(poMatch[1]) : null;
    const action = poMatch[2] ?? null;
    if (req.method === "GET" && !poId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("purchase_orders.view")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...purchaseOrders.values()]
        .map(decoratePo)
        .filter((po) => {
          if (po.company_id !== companyId) return false;
          if (branchId !== null && po.branch_id !== branchId) return false;
          if (statusFilter && po.status !== statusFilter) return false;
          if (
            q &&
            ![po.po_number, po.supplier_name ?? ""].some((s) =>
              s.toLowerCase().includes(q),
            )
          )
            return false;
          return true;
        });
      paginateSlice(
        sortItems(items, {
          id: (po) => po.id,
          supplier_name: (po) => po.supplier_name,
          total_minor: (po) => po.total_minor,
          status: (po) => po.status,
          created_at: (po) => po.created_at,
        }),
      );
      return;
    }
    if (req.method === "GET" && poId && !action) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("purchase_orders.view")
      ) {
        fail(403);
        return;
      }
      const po = purchaseOrders.get(poId);
      if (!po) fail(404);
      else json(200, { data: decoratePo(po) });
      return;
    }
    if (req.method === "POST" && !poId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("purchase_orders.manage")
      ) {
        fail(403);
        return;
      }
      const rawLines = Array.isArray(input.lines) ? input.lines : [];
      if (rawLines.length === 0) {
        fail(422, { lines: ["Add at least one order line."] });
        return;
      }
      const normLines = rawLines.map((l, idx) => {
        const qty = Math.max(1, Number(l.quantity));
        const cost = Math.max(0, Number(l.unit_cost_minor));
        return {
          id: idx + 1,
          part_id: Number(l.part_id),
          quantity: qty,
          unit_cost_minor: cost,
          line_total_minor: qty * cost,
        };
      });
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        supplier_id: Number(input.supplier_id),
        created_by: user.id,
        approved_by: null,
        approved_by_name: null,
        po_number: `PO-${String(id).padStart(5, "0")}`,
        status: "draft",
        total_minor: normLines.reduce((s, l) => s + l.line_total_minor, 0),
        notes: input.notes ? String(input.notes) : null,
        submitted_at: null,
        approved_at: null,
        received_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        lines: normLines,
      };
      purchaseOrders.set(id, created);
      completedWrites++;
      json(201, { data: decoratePo(created) });
      return;
    }
    if (req.method === "POST" && poId && action) {
      const reqPerm =
        action === "approve"
          ? "purchase_orders.approve"
          : "purchase_orders.manage";
      if (!user.is_platform_admin && !user.permissions.includes(reqPerm)) {
        fail(403);
        return;
      }
      const po = purchaseOrders.get(poId);
      if (!po) {
        fail(404);
        return;
      }
      if (action === "submit") {
        if (po.status !== "draft") {
          fail(409);
          return;
        }
        po.status = "submitted";
        po.submitted_at = new Date().toISOString();
      } else if (action === "approve") {
        if (po.status !== "submitted") {
          fail(409);
          return;
        }
        po.status = "approved";
        po.approved_by = user.id;
        po.approved_by_name = user.name;
        po.approved_at = new Date().toISOString();
      } else if (action === "receive") {
        if (po.status !== "approved") {
          fail(409);
          return;
        }
        po.status = "received";
        po.received_at = new Date().toISOString();
        for (const line of po.lines) {
          const mId = nextId++;
          stockMovements.set(mId, {
            id: mId,
            company_id: po.company_id,
            branch_id: po.branch_id,
            part_id: line.part_id,
            recorded_by: user.id,
            quantity: line.quantity,
            unit_cost_minor: line.unit_cost_minor,
            reason: `Purchase receipt (${po.po_number})`,
            work_order_id: null,
            purchase_order_id: po.id,
            created_at: po.received_at,
          });
        }
        if (po.total_minor > 0) {
          postJournalEntry({
            companyId: po.company_id,
            branchId: po.branch_id,
            createdBy: user.id,
            sourceType: "purchase_order",
            sourceId: po.id,
            reference: po.po_number,
            memo: `Received goods on ${po.po_number}`,
            lines: [
              { account_code: "1200", debit_minor: po.total_minor, credit_minor: 0 },
              { account_code: "2000", debit_minor: 0, credit_minor: po.total_minor },
            ],
          });
        }
      } else if (action === "cancel") {
        if (!["draft", "submitted", "approved"].includes(po.status)) {
          fail(409);
          return;
        }
        po.status = "cancelled";
      }
      po.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: decoratePo(po) });
      return;
    }
    fail(404);
    return;
  }

  // --- M8 Live Finance, Invoicing, Payments, Refunds, Expenses & GL ---
  if (url.pathname === "/api/v1/invoices/ageing" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const buckets = [
      { key: "current", label: "Current", count: 0, amount_minor: 0 },
      { key: "d1_30", label: "1–30 Days", count: 0, amount_minor: 0 },
      { key: "d31_60", label: "31–60 Days", count: 0, amount_minor: 0 },
      { key: "d61_90", label: "61–90 Days", count: 0, amount_minor: 0 },
      { key: "d90_plus", label: "90+ Days", count: 0, amount_minor: 0 },
    ];
    let totalOutstanding = 0;
    const byCust = new Map();
    const nowMs = Date.now();
    for (const rawInv of invoices.values()) {
      if (rawInv.company_id !== companyId) continue;
      if (branchId !== null && rawInv.branch_id !== branchId) continue;
      const inv = decorateInvoice(rawInv);
      if (inv.status !== "issued" || inv.outstanding_minor <= 0) continue;
      const daysPastDue = Math.floor((nowMs - Date.parse(inv.due_at)) / 86_400_000);
      const idx =
        daysPastDue > 90
          ? 4
          : daysPastDue > 60
            ? 3
            : daysPastDue > 30
              ? 2
              : daysPastDue > 0
                ? 1
                : 0;
      buckets[idx].count += 1;
      buckets[idx].amount_minor += inv.outstanding_minor;
      totalOutstanding += inv.outstanding_minor;
      const expKey =
        inv.customer_id !== null
          ? `crm:${inv.customer_id}`
          : `custom:${inv.customer_name ?? "Custom"}`;
      const cur = byCust.get(expKey) ?? {
        customer_id: inv.customer_id,
        customer_name:
          inv.customer_name ??
          (inv.customer_id ? `Customer #${inv.customer_id}` : "Custom customer"),
        customer_type:
          inv.customer_id !== null
            ? (customers.get(inv.customer_id)?.type ?? "individual")
            : "custom",
        outstanding_minor: 0,
        overdue_count: 0,
      };
      cur.outstanding_minor += inv.outstanding_minor;
      if (daysPastDue > 0) cur.overdue_count += 1;
      byCust.set(expKey, cur);
    }
    json(200, {
      data: {
        buckets,
        total_outstanding_minor: totalOutstanding,
        exposures: [...byCust.values()].sort(
          (a, b) => b.outstanding_minor - a.outstanding_minor,
        ),
      },
    });
    return;
  }

  const invoiceMatch = url.pathname.match(
    /^\/api\/v1\/invoices(?:\/(\d+)(?:\/(issue|void|payments|refunds))?)?$/,
  );
  if (invoiceMatch) {
    const invoiceId = invoiceMatch[1] ? Number(invoiceMatch[1]) : null;
    const action = invoiceMatch[2] ?? null;

    if (req.method === "GET" && !invoiceId) {
      if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const customerFilter = url.searchParams.get("customer_id")
        ? Number(url.searchParams.get("customer_id"))
        : null;
      const rentalFilter = url.searchParams.get("rental_id")
        ? Number(url.searchParams.get("rental_id"))
        : null;
      const bucketFilter = url.searchParams.get("ageing_bucket");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const nowMs = Date.now();
      const items = [...invoices.values()]
        .map(decorateInvoice)
        .filter((inv) => {
          if (inv.company_id !== companyId) return false;
          if (branchId !== null && inv.branch_id !== branchId) return false;
          if (customerFilter !== null && inv.customer_id !== customerFilter)
            return false;
          if (rentalFilter !== null && inv.rental_id !== rentalFilter)
            return false;
          if (statusFilter) {
            const disp =
              inv.status === "void"
                ? "void"
                : inv.status === "draft"
                  ? "draft"
                  : inv.outstanding_minor === 0 && inv.paid_minor > 0
                    ? "paid"
                    : inv.is_overdue
                      ? "overdue"
                      : "issued";
            if (statusFilter === "issued") {
              if (inv.status !== "issued") return false;
            } else if (disp !== statusFilter) {
              return false;
            }
          }
          if (bucketFilter) {
            if (inv.status !== "issued" || inv.outstanding_minor <= 0)
              return false;
            const daysPastDue = Math.floor(
              (nowMs - Date.parse(inv.due_at)) / 86_400_000,
            );
            const bKey =
              daysPastDue > 90
                ? "d90_plus"
                : daysPastDue > 60
                  ? "d61_90"
                  : daysPastDue > 30
                    ? "d31_60"
                    : daysPastDue > 0
                      ? "d1_30"
                      : "current";
            if (bKey !== bucketFilter) return false;
          }
          if (
            q &&
            ![
              inv.invoice_number,
              inv.customer_name ?? "",
              inv.notes ?? "",
            ].some((s) => s.toLowerCase().includes(q))
          ) {
            return false;
          }
          return true;
        });
      paginateSlice(
        sortItems(items, {
          id: (inv) => inv.id,
          customer_name: (inv) => inv.customer_name,
          due_at: (inv) => inv.due_at,
          total_minor: (inv) => inv.total_minor,
          outstanding_minor: (inv) => inv.outstanding_minor,
          status: (inv) => inv.status,
          created_at: (inv) => inv.created_at,
        }),
      );
      return;
    }

    if (req.method === "GET" && invoiceId && !action) {
      if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) fail(404);
      else json(200, { data: decorateInvoice(inv) });
      return;
    }

    if (req.method === "POST" && !invoiceId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("invoices.manage")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(input.company_id);
      const branchId = Number(input.branch_id);
      const hasCustomerId =
        input.customer_id !== undefined && input.customer_id !== null;
      const customName = String(input.custom_customer_name ?? "").trim();
      if ((hasCustomerId && customName) || (!hasCustomerId && !customName)) {
        fail(422, {
          custom_customer_name: [
            "Provide either an existing customer or a custom customer name.",
          ],
        });
        return;
      }
      const customerId = hasCustomerId ? Number(input.customer_id) : null;
      const rawLines = Array.isArray(input.lines) ? input.lines : [];
      if (rawLines.length === 0) {
        fail(422, { lines: ["At least one line item is required."] });
        return;
      }
      const settings = companySettings.get(companyId) ?? { vat_rate_pct: 15 };
      const discountPct = Number(input.discount_pct ?? 0);
      const totals = computeInvoiceTotals(
        rawLines,
        discountPct,
        settings.vat_rate_pct,
      );
      const id = nextId++;
      const created = {
        id,
        company_id: companyId,
        branch_id: branchId,
        customer_id: customerId,
        custom_customer_name: customerId === null ? customName : null,
        custom_customer_email:
          customerId === null && input.custom_customer_email
            ? String(input.custom_customer_email).trim()
            : null,
        custom_customer_phone:
          customerId === null && input.custom_customer_phone
            ? String(input.custom_customer_phone).trim()
            : null,
        rental_id: null,
        created_by: user.id,
        invoice_number: `INV-${String(id).padStart(5, "0")}`,
        status: "draft",
        due_at: input.due_at || new Date(Date.now() + 14 * 86_400_000).toISOString(),
        issued_at: null,
        voided_at: null,
        discount_pct: discountPct,
        vat_rate_pct: settings.vat_rate_pct,
        ...totals,
        notes: input.notes ? String(input.notes) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      invoices.set(id, created);
      completedWrites++;
      json(201, { data: decorateInvoice(created) });
      return;
    }

    if (req.method === "PATCH" && invoiceId && !action) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("invoices.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      if (inv.status !== "draft") {
        fail(409);
        return;
      }
      const rawLines = Array.isArray(input.lines) ? input.lines : inv.lines;
      if (rawLines.length === 0) {
        fail(422, { lines: ["At least one line item is required."] });
        return;
      }
      const discountPct =
        input.discount_pct !== undefined
          ? Number(input.discount_pct)
          : inv.discount_pct;
      const totals = computeInvoiceTotals(rawLines, discountPct, inv.vat_rate_pct);
      Object.assign(inv, totals, {
        discount_pct: discountPct,
        due_at: input.due_at || inv.due_at,
        ...(inv.customer_id === null && input.custom_customer_name !== undefined
          ? {
              custom_customer_name: String(input.custom_customer_name).trim(),
              custom_customer_email: input.custom_customer_email
                ? String(input.custom_customer_email).trim()
                : null,
              custom_customer_phone: input.custom_customer_phone
                ? String(input.custom_customer_phone).trim()
                : null,
            }
          : {}),
        notes:
          input.notes !== undefined
            ? input.notes
              ? String(input.notes)
              : null
            : inv.notes,
        updated_at: new Date().toISOString(),
      });
      completedWrites++;
      json(200, { data: decorateInvoice(inv) });
      return;
    }

    if (req.method === "POST" && invoiceId && action === "issue") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("invoices.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      if (inv.status !== "draft") {
        fail(409);
        return;
      }
      if (inv.total_minor <= 0) {
        fail(422, { lines: ["Invoice total must be greater than zero to issue."] });
        return;
      }
      inv.status = "issued";
      inv.issued_at = new Date().toISOString();
      inv.updated_at = inv.issued_at;
      postJournalEntry({
        companyId: inv.company_id,
        branchId: inv.branch_id,
        createdBy: user.id,
        sourceType: "invoice",
        sourceId: inv.id,
        reference: inv.invoice_number,
        memo: `Issued invoice ${inv.invoice_number}`,
        lines: [
          { account_code: "1100", debit_minor: inv.total_minor, credit_minor: 0 },
          {
            account_code: "4000",
            debit_minor: 0,
            credit_minor: inv.total_minor - inv.vat_minor,
          },
          { account_code: "2100", debit_minor: 0, credit_minor: inv.vat_minor },
        ],
      });
      completedWrites++;
      json(200, { data: decorateInvoice(inv) });
      return;
    }

    if (req.method === "POST" && invoiceId && action === "void") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("invoices.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      const dec = decorateInvoice(inv);
      if (inv.status === "void" || dec.paid_minor > 0) {
        fail(409);
        return;
      }
      const wasIssued = inv.status === "issued";
      inv.status = "void";
      inv.voided_at = new Date().toISOString();
      inv.updated_at = inv.voided_at;
      if (wasIssued) {
        postJournalEntry({
          companyId: inv.company_id,
          branchId: inv.branch_id,
          createdBy: user.id,
          sourceType: "invoice",
          sourceId: inv.id,
          reference: `${inv.invoice_number} (VOID)`,
          memo: `Voided issued invoice ${inv.invoice_number}`,
          lines: [
            {
              account_code: "4000",
              debit_minor: inv.total_minor - inv.vat_minor,
              credit_minor: 0,
            },
            { account_code: "2100", debit_minor: inv.vat_minor, credit_minor: 0 },
            { account_code: "1100", debit_minor: 0, credit_minor: inv.total_minor },
          ],
        });
      }
      completedWrites++;
      json(200, { data: decorateInvoice(inv) });
      return;
    }

    if (req.method === "POST" && invoiceId && action === "payments") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("payments.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      if (inv.status !== "issued") {
        fail(409);
        return;
      }
      const dec = decorateInvoice(inv);
      const amountMinor = Number(input.amount_minor);
      if (
        !Number.isInteger(amountMinor) ||
        amountMinor <= 0 ||
        amountMinor > dec.outstanding_minor
      ) {
        fail(422, {
          amount_minor: [
            "Payment amount must be positive and cannot exceed the outstanding balance.",
          ],
        });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: inv.company_id,
        branch_id: inv.branch_id,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: dec.customer_name,
        recorded_by: user.id,
        amount_minor: amountMinor,
        method: input.method || "bank_transfer",
        reference: String(input.reference || `RCPT-${id}`),
        paid_at: input.paid_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      payments.set(id, created);
      postJournalEntry({
        companyId: inv.company_id,
        branchId: inv.branch_id,
        createdBy: user.id,
        sourceType: "payment",
        sourceId: id,
        reference: created.reference,
        memo: `Payment on ${inv.invoice_number}`,
        lines: [
          { account_code: "1000", debit_minor: amountMinor, credit_minor: 0 },
          { account_code: "1100", debit_minor: 0, credit_minor: amountMinor },
        ],
      });
      completedWrites++;
      json(201, { data: created });
      return;
    }

    if (req.method === "POST" && invoiceId && action === "refunds") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("payments.manage")
      ) {
        fail(403);
        return;
      }
      const inv = invoices.get(invoiceId);
      if (!inv) {
        fail(404);
        return;
      }
      if (inv.status !== "issued") {
        fail(409);
        return;
      }
      const dec = decorateInvoice(inv);
      const amountMinor = Number(input.amount_minor);
      if (
        !Number.isInteger(amountMinor) ||
        amountMinor <= 0 ||
        amountMinor > dec.net_paid_minor
      ) {
        fail(422, {
          amount_minor: [
            "Refund amount must be positive and cannot exceed net recorded payments.",
          ],
        });
        return;
      }
      if (!String(input.reason ?? "").trim()) {
        fail(422, { reason: ["A refund reason is required."] });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: inv.company_id,
        branch_id: inv.branch_id,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: dec.customer_name,
        recorded_by: user.id,
        amount_minor: amountMinor,
        reason: String(input.reason).trim(),
        refunded_at: input.refunded_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      refunds.set(id, created);
      postJournalEntry({
        companyId: inv.company_id,
        branchId: inv.branch_id,
        createdBy: user.id,
        sourceType: "refund",
        sourceId: id,
        reference: `REF-${id} (${inv.invoice_number})`,
        memo: `Refund on ${inv.invoice_number}: ${created.reason}`,
        lines: [
          { account_code: "4100", debit_minor: amountMinor, credit_minor: 0 },
          { account_code: "1000", debit_minor: 0, credit_minor: amountMinor },
        ],
      });
      completedWrites++;
      json(201, { data: created });
      return;
    }

    fail(404);
    return;
  }

  if (url.pathname === "/api/v1/payments" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const methodFilter = url.searchParams.get("method");
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...payments.values()].filter((p) => {
      if (p.company_id !== companyId) return false;
      if (branchId !== null && p.branch_id !== branchId) return false;
      if (methodFilter && p.method !== methodFilter) return false;
      if (
        q &&
        ![p.reference, p.invoice_number ?? "", p.customer_name ?? ""].some((s) =>
          s.toLowerCase().includes(q),
        )
      )
        return false;
      return true;
    });
    paginateSlice(
      sortItems(items, {
        id: (p) => p.id,
        paid_at: (p) => p.paid_at,
        amount_minor: (p) => p.amount_minor,
        method: (p) => p.method,
      }),
    );
    return;
  }

  if (url.pathname === "/api/v1/refunds" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("invoices.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...refunds.values()].filter((r) => {
      if (r.company_id !== companyId) return false;
      if (branchId !== null && r.branch_id !== branchId) return false;
      if (
        q &&
        ![r.reason, r.invoice_number ?? "", r.customer_name ?? ""].some((s) =>
          s.toLowerCase().includes(q),
        )
      )
        return false;
      return true;
    });
    paginateSlice(
      sortItems(items, {
        id: (r) => r.id,
        refunded_at: (r) => r.refunded_at,
        amount_minor: (r) => r.amount_minor,
      }),
    );
    return;
  }

  if (url.pathname === "/api/v1/expenses") {
    if (req.method === "GET") {
      if (!user.is_platform_admin && !user.permissions.includes("expenses.view")) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const categoryFilter = url.searchParams.get("category");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...expenses.values()].filter((e) => {
        if (e.company_id !== companyId) return false;
        if (branchId !== null && e.branch_id !== branchId) return false;
        if (categoryFilter && e.category !== categoryFilter) return false;
        if (
          q &&
          ![e.description, e.vehicle_registration ?? ""].some((s) =>
            s.toLowerCase().includes(q),
          )
        )
          return false;
        return true;
      });
      paginateSlice(
        sortItems(items, {
          id: (e) => e.id,
          incurred_at: (e) => e.incurred_at,
          description: (e) => e.description,
          category: (e) => e.category,
          amount_minor: (e) => e.amount_minor,
        }),
      );
      return;
    }
    if (req.method === "POST") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("expenses.manage")
      ) {
        fail(403);
        return;
      }
      const amountMinor = Number(input.amount_minor);
      if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
        fail(422, { amount_minor: ["Expense amount must be greater than zero."] });
        return;
      }
      const vehicle = input.vehicle_id ? vehicles.get(Number(input.vehicle_id)) : null;
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        vehicle_id: vehicle?.id ?? null,
        vehicle_registration: vehicle?.registration ?? null,
        recorded_by: user.id,
        category: input.category || "general",
        description: String(input.description ?? "").trim(),
        amount_minor: amountMinor,
        incurred_at: input.incurred_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      expenses.set(id, created);
      postJournalEntry({
        companyId: created.company_id,
        branchId: created.branch_id,
        createdBy: user.id,
        sourceType: "expense",
        sourceId: id,
        reference: `EXP-${id}`,
        memo: `${created.category}: ${created.description}`,
        lines: [
          { account_code: "5000", debit_minor: amountMinor, credit_minor: 0 },
          { account_code: "1000", debit_minor: 0, credit_minor: amountMinor },
        ],
      });
      completedWrites++;
      json(201, { data: created });
      return;
    }
  }

  if (url.pathname === "/api/v1/gl/accounts" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("gl.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const totals = new Map(
      SYSTEM_GL_ACCOUNTS.map((a) => [a.code, { debit: 0, credit: 0 }]),
    );
    let totalDebits = 0;
    let totalCredits = 0;
    for (const entry of journalEntries.values()) {
      if (entry.company_id !== companyId) continue;
      if (branchId !== null && entry.branch_id !== branchId) continue;
      for (const line of entry.lines) {
        const cur = totals.get(line.account_code) ?? { debit: 0, credit: 0 };
        cur.debit += line.debit_minor;
        cur.credit += line.credit_minor;
        totals.set(line.account_code, cur);
        totalDebits += line.debit_minor;
        totalCredits += line.credit_minor;
      }
    }
    json(200, {
      data: {
        accounts: SYSTEM_GL_ACCOUNTS.map((a) => {
          const t = totals.get(a.code) ?? { debit: 0, credit: 0 };
          return {
            ...a,
            debit_minor: t.debit,
            credit_minor: t.credit,
            balance_minor: t.debit - t.credit,
          };
        }),
        total_debits_minor: totalDebits,
        total_credits_minor: totalCredits,
        is_balanced: totalDebits === totalCredits,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/gl/journal-entries" && req.method === "GET") {
    if (!user.is_platform_admin && !user.permissions.includes("gl.view")) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    const accountCode = url.searchParams.get("account_code");
    const sourceType = url.searchParams.get("source_type");
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = [...journalEntries.values()]
      .filter((e) => {
        if (e.company_id !== companyId) return false;
        if (branchId !== null && e.branch_id !== branchId) return false;
        if (sourceType && e.source_type !== sourceType) return false;
        if (accountCode && !e.lines.some((l) => l.account_code === accountCode))
          return false;
        if (
          q &&
          ![e.reference, e.memo].some((s) => s.toLowerCase().includes(q))
        )
          return false;
        return true;
      })
      .sort((a, b) => b.id - a.id);
    paginateSlice(items);
    return;
  }

  // --- M6 Reservations, Rentals & Documents ---
  const isDriverSelf =
    !user.is_platform_admin &&
    user.roles.includes("driver") &&
    !user.permissions.includes("rentals.view");

  const resMatch = url.pathname.match(
    /^\/api\/v1\/reservations(?:\/(\d+)(?:\/(cancel))?)?$/,
  );
  if (resMatch) {
    const resId = resMatch[1] ? Number(resMatch[1]) : null;
    const action = resMatch[2] ?? null;
    if (req.method === "GET" && !resId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("reservations.view")
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...reservations.values()]
        .filter((r) => {
          if (r.company_id !== companyId) return false;
          if (branchId !== null && r.branch_id !== branchId) return false;
          if (statusFilter && r.status !== statusFilter) return false;
          const dec = decorateReservation(r);
          if (
            q &&
            ![
              String(r.id),
              dec.customer_name ?? "",
              dec.vehicle_registration ?? "",
            ].some((s) => s.toLowerCase().includes(q))
          )
            return false;
          return true;
        })
        .map(decorateReservation);
      paginateSlice(
        sortItems(items, {
          id: (r) => r.id,
          customer_name: (r) => r.customer_name,
          vehicle_registration: (r) => r.vehicle_registration,
          starts_at: (r) => r.starts_at,
          ends_at: (r) => r.ends_at,
          status: (r) => r.status,
        }),
      );
      return;
    }
    if (req.method === "GET" && resId && !action) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("reservations.view")
      ) {
        fail(403);
        return;
      }
      const rec = reservations.get(resId);
      if (!rec) fail(404);
      else json(200, { data: decorateReservation(rec) });
      return;
    }
    if (req.method === "POST" && !resId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("reservations.manage")
      ) {
        fail(403);
        return;
      }
      const vehicle = vehicles.get(Number(input.vehicle_id));
      if (!vehicle || vehicle.status !== "available") {
        fail(422, { vehicle_id: ["Vehicle is not available."] });
        return;
      }
      const startMs = Date.parse(input.starts_at);
      const endMs = Date.parse(input.ends_at);
      const overlap = [...reservations.values()].some(
        (r) =>
          r.vehicle_id === vehicle.id &&
          r.status === "confirmed" &&
          Date.parse(r.starts_at) < endMs &&
          Date.parse(r.ends_at) > startMs,
      );
      if (overlap) {
        fail(422, {
          vehicle_id: ["vehicle_id could not be booked for this period."],
        });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(input.company_id),
        branch_id: Number(input.branch_id),
        customer_id: Number(input.customer_id),
        vehicle_id: Number(input.vehicle_id),
        created_by: user.id,
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(endMs).toISOString(),
        status: "confirmed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      reservations.set(id, created);
      completedWrites++;
      json(201, { data: decorateReservation(created) });
      return;
    }
    if (req.method === "POST" && resId && action === "cancel") {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("reservations.manage")
      ) {
        fail(403);
        return;
      }
      const rec = reservations.get(resId);
      if (!rec) {
        fail(404);
        return;
      }
      if (
        rec.status !== "confirmed" ||
        [...rentals.values()].some((r) => r.reservation_id === rec.id)
      ) {
        fail(409);
        return;
      }
      rec.status = "cancelled";
      rec.updated_at = new Date().toISOString();
      completedWrites++;
      json(200, { data: decorateReservation(rec) });
      return;
    }
    fail(404);
    return;
  }

  const rentalMatch = url.pathname.match(
    /^\/api\/v1\/rentals(?:\/(\d+)(?:\/(handover|return|extend|assign-driver))?)?$/,
  );
  if (rentalMatch) {
    const rentalId = rentalMatch[1] ? Number(rentalMatch[1]) : null;
    const action = rentalMatch[2] ?? null;
    if (req.method === "GET" && !rentalId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("rentals.view") &&
        !isDriverSelf
      ) {
        fail(403);
        return;
      }
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const statusFilter = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const items = [...rentals.values()]
        .filter((r) => {
          if (r.company_id !== companyId) return false;
          if (branchId !== null && r.branch_id !== branchId) return false;
          if (isDriverSelf && r.driver_user_id !== user.id) return false;
          if (statusFilter && r.status !== statusFilter) return false;
          const dec = decorateRental(r);
          if (
            q &&
            ![
              String(r.id),
              dec.vehicle_registration ?? "",
              dec.customer_name ?? "",
              r.handover_notes ?? "",
              r.return_notes ?? "",
            ].some((s) => s.toLowerCase().includes(q))
          )
            return false;
          return true;
        })
        .map(decorateRental);
      paginateSlice(
        sortItems(items, {
          id: (r) => r.id,
          vehicle_registration: (r) => r.vehicle_registration,
          customer_name: (r) => r.customer_name,
          driver_name: (r) => r.driver_name,
          status: (r) => r.status,
          handed_over_at: (r) => r.handed_over_at,
        }),
      );
      return;
    }
    if (req.method === "GET" && rentalId && !action) {
      const rec = rentals.get(rentalId);
      if (!rec) {
        fail(404);
        return;
      }
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("rentals.view") &&
        !(isDriverSelf && rec.driver_user_id === user.id)
      ) {
        fail(403);
        return;
      }
      json(200, { data: decorateRental(rec) });
      return;
    }
    if (req.method === "POST" && !rentalId) {
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("rentals.manage")
      ) {
        fail(403);
        return;
      }
      const resRec = reservations.get(Number(input.reservation_id));
      if (
        !resRec ||
        resRec.status !== "confirmed" ||
        [...rentals.values()].some((r) => r.reservation_id === resRec.id)
      ) {
        fail(409);
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: resRec.company_id,
        branch_id: resRec.branch_id,
        reservation_id: resRec.id,
        vehicle_id: resRec.vehicle_id,
        driver_user_id: input.driver_user_id
          ? Number(input.driver_user_id)
          : null,
        status: "draft",
        handed_over_at: null,
        returned_at: null,
        handover_odometer: null,
        return_odometer: null,
        handover_notes: null,
        return_notes: null,
        security_deposit_minor: input.security_deposit_minor
          ? Number(input.security_deposit_minor)
          : 0,
        deposit_status:
          input.security_deposit_minor && Number(input.security_deposit_minor) > 0
            ? "held"
            : "none",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      rentals.set(id, created);
      completedWrites++;
      json(201, { data: decorateRental(created) });
      return;
    }
    if (req.method === "POST" && rentalId && action) {
      const rec = rentals.get(rentalId);
      if (!rec) {
        fail(404);
        return;
      }
      const vehicle = vehicles.get(rec.vehicle_id);
      const resRec = reservations.get(rec.reservation_id);
      if (action === "handover" || action === "return") {
        if (
          !user.is_platform_admin &&
          !user.permissions.includes("rentals.manage") &&
          !(isDriverSelf && rec.driver_user_id === user.id)
        ) {
          fail(403);
          return;
        }
        if (action === "handover") {
          if (rec.status !== "draft" || vehicle?.status !== "available") {
            fail(409);
            return;
          }
          if (Number(input.odometer) < (vehicle?.odometer ?? 0)) {
            fail(422, { odometer: ["Odometer cannot decrease."] });
            return;
          }
          rec.status = "active";
          rec.handed_over_at = new Date().toISOString();
          rec.handover_odometer = Number(input.odometer);
          rec.handover_notes = String(input.notes ?? "");
          rec.updated_at = new Date().toISOString();
          if (vehicle) {
            vehicle.status = "rented";
            vehicle.odometer = Number(input.odometer);
          }
        } else {
          if (rec.status !== "active") {
            fail(409);
            return;
          }
          const minOdo = Math.max(
            vehicle?.odometer ?? 0,
            rec.handover_odometer ?? 0,
          );
          if (Number(input.odometer) < minOdo) {
            fail(422, { odometer: ["Odometer cannot decrease."] });
            return;
          }
          rec.status = "returned";
          rec.returned_at = new Date().toISOString();
          rec.return_odometer = Number(input.odometer);
          rec.return_notes = String(input.notes ?? "");
          rec.updated_at = new Date().toISOString();
          if (vehicle) {
            vehicle.status = input.vehicle_status ?? "available";
            vehicle.odometer = Number(input.odometer);
          }
          if (resRec) resRec.status = "completed";
          // Auto-create draft invoice on return carrying quotation discount/VAT or vehicle rate
          const settings = companySettings.get(rec.company_id) ?? {
            vat_rate_pct: 15,
          };
          const linkedQuote = [...quotations.values()].find((q) =>
            q.reservation_ids.includes(rec.reservation_id),
          );
          const quoteVeh = linkedQuote?.vehicles.find(
            (v) => v.vehicle_id === rec.vehicle_id,
          );
          const rentalDays = resRec
            ? Math.max(
                1,
                Math.ceil(
                  (Date.parse(resRec.ends_at) - Date.parse(resRec.starts_at)) /
                    86_400_000,
                ),
              )
            : 1;
          const unitRate =
            quoteVeh?.daily_rate_minor ?? vehicle?.daily_rate_minor ?? 0;
          const invLines = [
            {
              description: `Rental #${rec.id} (${vehicle?.registration ?? `Vehicle #${rec.vehicle_id}`})`,
              quantity: rentalDays,
              unit_price_minor: unitRate,
            },
          ];
          const extraMinor = Number(input.extra_charge_minor ?? 0);
          if (extraMinor > 0) {
            invLines.push({
              description:
                String(input.extra_charge_description ?? "").trim() ||
                "Additional return charge",
              quantity: 1,
              unit_price_minor: extraMinor,
            });
          }
          const discountPct = linkedQuote?.discount_pct ?? 0;
          const vatRatePct = linkedQuote?.vat_rate_pct ?? settings.vat_rate_pct;
          const totals = computeInvoiceTotals(invLines, discountPct, vatRatePct);
          const invId = nextId++;
          invoices.set(invId, {
            id: invId,
            company_id: rec.company_id,
            branch_id: rec.branch_id,
            customer_id: resRec?.customer_id ?? 10,
            rental_id: rec.id,
            created_by: user.id,
            invoice_number: `INV-${String(invId).padStart(5, "0")}`,
            status: "draft",
            due_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
            issued_at: null,
            voided_at: null,
            discount_pct: discountPct,
            vat_rate_pct: vatRatePct,
            ...totals,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        completedWrites++;
        json(200, { data: decorateRental(rec) });
        return;
      }
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("rentals.manage")
      ) {
        fail(403);
        return;
      }
      if (action === "extend") {
        if (rec.status !== "active" || !resRec) {
          fail(409);
          return;
        }
        const nextEnd = Date.parse(input.ends_at);
        const curEnd = Date.parse(resRec.ends_at);
        if (Number.isNaN(nextEnd) || nextEnd <= curEnd) {
          fail(422, { ends_at: ["New return date must be after current end."] });
          return;
        }
        const overlap = [...reservations.values()].some(
          (other) =>
            other.id !== resRec.id &&
            other.vehicle_id === rec.vehicle_id &&
            other.status === "confirmed" &&
            Date.parse(other.starts_at) < nextEnd &&
            Date.parse(other.ends_at) > curEnd,
        );
        if (overlap || control.extendConflict) {
          fail(409);
          return;
        }
        resRec.ends_at = new Date(nextEnd).toISOString();
        rec.updated_at = new Date().toISOString();
        completedWrites++;
        json(200, { data: decorateRental(rec) });
        return;
      }
      if (action === "assign-driver") {
        if (rec.status === "returned") {
          fail(409);
          return;
        }
        rec.driver_user_id = input.driver_user_id
          ? Number(input.driver_user_id)
          : null;
        rec.updated_at = new Date().toISOString();
        completedWrites++;
        json(200, { data: decorateRental(rec) });
        return;
      }
    }
    fail(404);
    return;
  }

  const docMatch = url.pathname.match(/^\/api\/v1\/documents(?:\/(\d+))?$/);
  if (docMatch) {
    const docId = docMatch[1] ? Number(docMatch[1]) : null;
    if (req.method === "GET" && !docId) {
      const companyId = Number(url.searchParams.get("company_id"));
      const branchId = url.searchParams.get("branch_id")
        ? Number(url.searchParams.get("branch_id"))
        : null;
      const entityType = url.searchParams.get("entity_type");
      const entityId = url.searchParams.get("entity_id")
        ? Number(url.searchParams.get("entity_id"))
        : null;
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      if (isDriverSelf) {
        const rental =
          entityType === "rental" && entityId ? rentals.get(entityId) : null;
        if (!rental || rental.driver_user_id !== user.id) {
          fail(403);
          return;
        }
      } else if (
        !user.is_platform_admin &&
        !user.permissions.includes("documents.view")
      ) {
        fail(403);
        return;
      }
      const items = [...documents.values()].filter((d) => {
        if (d.company_id !== companyId) return false;
        if (branchId !== null && d.branch_id !== branchId) return false;
        if (entityType && d.entity_type !== entityType) return false;
        if (entityId !== null && d.entity_id !== entityId) return false;
        if (
          q &&
          !d.original_name.toLowerCase().includes(q) &&
          !d.mime_type.toLowerCase().includes(q)
        )
          return false;
        return true;
      });
      paginateSlice(
        sortItems(items, {
          original_name: (d) => d.original_name,
          size: (d) => d.size,
          expires_at: (d) => d.expires_at,
          created_at: (d) => d.created_at,
        }),
      );
      return;
    }
    if (req.method === "GET" && docId) {
      const rec = documents.get(docId);
      if (!rec) {
        fail(404);
        return;
      }
      const allowedDriver =
        isDriverSelf &&
        rec.entity_type === "rental" &&
        rentals.get(rec.entity_id)?.driver_user_id === user.id;
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("documents.view") &&
        !allowedDriver
      ) {
        fail(403);
        return;
      }
      const blob =
        documentBlobs.get(docId) ?? Buffer.from("%PDF-1.4\n%%EOF", "utf8");
      res.writeHead(200, {
        "Content-Type": rec.mime_type,
        "Content-Disposition": `attachment; filename="${rec.original_name}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      });
      res.end(blob);
      return;
    }
    if (req.method === "POST" && !docId && multipartData) {
      const fields = multipartData.fields;
      const entityType = fields.entity_type || null;
      const entityId = fields.entity_id ? Number(fields.entity_id) : null;
      const allowedDriver =
        isDriverSelf &&
        entityType === "rental" &&
        entityId &&
        rentals.get(entityId)?.driver_user_id === user.id;
      if (
        !user.is_platform_admin &&
        !user.permissions.includes("documents.manage") &&
        !allowedDriver
      ) {
        fail(403);
        return;
      }
      if (!multipartData.file) {
        fail(422, { file: ["A file is required."] });
        return;
      }
      const id = nextId++;
      const created = {
        id,
        company_id: Number(fields.company_id),
        branch_id: Number(fields.branch_id),
        uploaded_by: user.id,
        entity_type: entityType,
        entity_id: entityId,
        original_name: multipartData.file.original_name,
        mime_type: multipartData.file.mime_type,
        size: multipartData.file.bytes.length,
        expires_at: fields.expires_at || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      documents.set(id, created);
      documentBlobs.set(id, multipartData.file.bytes);
      completedWrites++;
      // Mirror real Laravel multipart Document::create() returning string IDs before refresh()
      json(201, {
        data: {
          ...created,
          company_id: String(created.company_id),
          branch_id: String(created.branch_id),
        },
      });
      return;
    }
    fail(404);
    return;
  }

  // --- Customers & Vehicles ---
  const match = url.pathname.match(
    /^\/api\/v1\/(?:(stats)\/)?(customers|vehicles)(?:\/(\d+))?$/,
  );
  if (!match) {
    fail(404);
    return;
  }
  const isStatsEndpoint = match[1] === "stats";
  const domain = match[2];
  const id = match[3] ? Number(match[3]) : null;
  const records = domain === "customers" ? customers : vehicles;
  if (!id && req.method === "GET") {
    if (
      !user.is_platform_admin &&
      !user.permissions.includes(`${domain}.view`)
    ) {
      fail(403);
      return;
    }
    const companyId = Number(url.searchParams.get("company_id"));
    if (!Number.isInteger(companyId) || companyId < 1) {
      fail(422, { company_id: ["The company id field is required."] });
      return;
    }
    const membership = user.companies.find((c) => c.id === companyId);
    if (!user.is_platform_admin && !membership) {
      fail(404);
      return;
    }
    const branchId = url.searchParams.get("branch_id")
      ? Number(url.searchParams.get("branch_id"))
      : null;
    if (
      !user.is_platform_admin &&
      membership?.branch_id !== null &&
      branchId !== null &&
      membership.branch_id !== branchId
    ) {
      fail(404);
      return;
    }
    const canSeeFinance =
      user.is_platform_admin || user.permissions.includes("invoices.view");
    const sortParam = url.searchParams.get("sort") ?? "";
    const monetarySortKeys = [
      "total_spent_minor",
      "open_ar_minor",
      "revenue_minor",
      "net_roi_minor",
    ];
    if (
      !canSeeFinance &&
      (url.searchParams.has("min_spend_minor") ||
        url.searchParams.has("max_spend_minor") ||
        url.searchParams.get("has_open_ar") === "1" ||
        monetarySortKeys.includes(sortParam))
    ) {
      fail(403);
      return;
    }

    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const typeFilter = url.searchParams.get("type");
    const statusFilter = url.searchParams.get("status");
    const includeStats =
      isStatsEndpoint || url.searchParams.get("include_stats") === "1";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const minSpend = url.searchParams.has("min_spend_minor")
      ? Number(url.searchParams.get("min_spend_minor"))
      : null;
    const maxSpend = url.searchParams.has("max_spend_minor")
      ? Number(url.searchParams.get("max_spend_minor"))
      : null;
    const hasOpenAr = url.searchParams.get("has_open_ar") === "1";
    const minRate = url.searchParams.has("min_rate_minor")
      ? Number(url.searchParams.get("min_rate_minor"))
      : null;
    const maxRate = url.searchParams.has("max_rate_minor")
      ? Number(url.searchParams.get("max_rate_minor"))
      : null;
    const idleDaysMin = url.searchParams.has("idle_days_min")
      ? Number(url.searchParams.get("idle_days_min"))
      : null;
    const unpricedOnly = url.searchParams.get("unpriced_only") === "1";
    const functionsFilter = (url.searchParams.get("functions") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    collectionReads++;
    let items = [...records.values()].filter((r) => {
      if (r.company_id !== companyId) return false;
      if (
        !user.is_platform_admin &&
        membership?.branch_id !== null &&
        r.branch_id !== membership.branch_id
      )
        return false;
      if (branchId !== null && r.branch_id !== branchId) return false;
      if (domain === "customers") {
        if (typeFilter && r.type !== typeFilter) return false;
        if (
          q &&
          ![r.name, r.email ?? "", r.phone ?? ""].some((v) =>
            v.toLowerCase().includes(q),
          )
        )
          return false;
      } else {
        if (statusFilter && r.status !== statusFilter) return false;
        if (minRate !== null && r.daily_rate_minor < minRate) return false;
        if (maxRate !== null && r.daily_rate_minor > maxRate) return false;
        if (unpricedOnly && r.daily_rate_minor > 0) return false;
        if (functionsFilter.length) {
          const lowerFns = (r.functions ?? []).map((f) => f.toLowerCase());
          if (!functionsFilter.every((f) => lowerFns.includes(f))) return false;
        }
        if (
          q &&
          ![r.registration, r.make, r.model].some((v) =>
            v.toLowerCase().includes(q),
          )
        )
          return false;
      }
      return true;
    });

    if (includeStats) {
      if (domain === "customers") {
        items = items
          .map((c) => ({
            ...c,
            stats: computeCustomerStats(c, { from, to, canSeeFinance }),
          }))
          .filter((c) => {
            if (minSpend !== null && (c.stats.total_spent_minor ?? 0) < minSpend)
              return false;
            if (maxSpend !== null && (c.stats.total_spent_minor ?? 0) > maxSpend)
              return false;
            if (hasOpenAr && (c.stats.open_ar_minor ?? 0) <= 0) return false;
            return true;
          });
      } else {
        items = items
          .map((v) => ({
            ...v,
            stats: computeVehicleStats(v, { from, to, canSeeFinance }),
          }))
          .filter((v) => {
            if (
              idleDaysMin !== null &&
              (v.stats.idle_days === null || v.stats.idle_days < idleDaysMin)
            )
              return false;
            return true;
          });
      }
    }

    const sorted = sortItems(
      items,
      domain === "customers"
        ? {
            name: (r) => r.name,
            type: (r) => r.type,
            email: (r) => r.email,
            rental_count: (r) => r.stats?.rental_count ?? 0,
            total_spent_minor: (r) => r.stats?.total_spent_minor ?? 0,
            open_ar_minor: (r) => r.stats?.open_ar_minor ?? 0,
            last_rental_at: (r) => r.stats?.last_rental_at ?? "",
            id: (r) => r.id,
          }
        : {
            registration: (r) => r.registration,
            make: (r) => `${r.make} ${r.model}`,
            daily_rate_minor: (r) => r.daily_rate_minor,
            odometer: (r) => r.odometer,
            status: (r) => r.status,
            rental_count: (r) => r.stats?.rental_count ?? 0,
            utilization_pct: (r) => r.stats?.utilization_pct ?? 0,
            idle_days: (r) => r.stats?.idle_days ?? 0,
            revenue_minor: (r) => r.stats?.revenue_minor ?? 0,
            net_roi_minor: (r) => r.stats?.net_roi_minor ?? 0,
            id: (r) => r.id,
          },
    );

    const perPage = 25;
    const total = sorted.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const pageNum = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const slice = sorted.slice((pageNum - 1) * perPage, pageNum * perPage);
    let summary = undefined;
    if (includeStats) {
      if (domain === "customers") {
        const activeRentalsCount = [...rentals.values()].filter(
          (r) =>
            r.company_id === companyId &&
            (branchId === null || r.branch_id === branchId) &&
            r.status === "active",
        ).length;
        summary = {
          total_customers: total,
          active_rentals_count: activeRentalsCount,
          total_spent_minor: canSeeFinance
            ? sorted.reduce((s, c) => s + (c.stats?.total_spent_minor ?? 0), 0)
            : null,
          total_open_ar_minor: canSeeFinance
            ? sorted.reduce((s, c) => s + (c.stats?.open_ar_minor ?? 0), 0)
            : null,
        };
      } else {
        summary = {
          total_vehicles: total,
          avg_utilization_pct:
            total > 0
              ? Math.round(
                  sorted.reduce((s, v) => s + (v.stats?.utilization_pct ?? 0), 0) /
                    total,
                )
              : 0,
          idle_over_14d_count: sorted.filter(
            (v) => (v.stats?.idle_days ?? 0) >= 14,
          ).length,
          unpriced_count: sorted.filter((v) => v.daily_rate_minor === 0).length,
          total_net_roi_minor: canSeeFinance
            ? sorted.reduce((s, v) => s + (v.stats?.net_roi_minor ?? 0), 0)
            : null,
        };
      }
    }
    json(200, {
      data: slice,
      meta: {
        current_page: pageNum,
        last_page: lastPage,
        per_page: perPage,
        total,
        ...(summary ? { summary } : {}),
      },
    });
    return;
  }
  if (req.method === "GET") {
    if (control.delay)
      await new Promise((resolve) => setTimeout(resolve, control.delay));
    const record = records.get(id);
    if (!record) fail(404);
    else json(200, { data: record });
    return;
  }
  if (
    !user.is_platform_admin &&
    !user.permissions.includes(`${domain}.manage`)
  ) {
    fail(403);
    return;
  }
  if (control.validation) {
    fail(
      422,
      domain === "customers"
        ? { name: ["Synthetic name rejection."] }
        : { registration: ["The registration has already been taken."] },
    );
    return;
  }
  if (control.conflict) {
    fail(409);
    return;
  }
  const recordId = id ?? nextId++;
  const old = records.get(recordId);
  if (req.method === "PATCH" && !old) {
    fail(404);
    return;
  }
  if (
    domain === "vehicles" &&
    req.method === "PATCH" &&
    typeof input.odometer === "number" &&
    input.odometer < old.odometer
  ) {
    fail(422, { odometer: ["Odometer cannot decrease."] });
    return;
  }
  if (domain === "vehicles" && Array.isArray(input.functions)) {
    const normalized = input.functions.map((item) =>
      typeof item === "string" ? item.trim().replace(/\s+/g, " ") : item,
    );
    if (normalized.length > 20) {
      fail(422, { functions: ["The functions field must not have more than 20 items."] });
      return;
    }
    const seen = new Set();
    for (let i = 0; i < normalized.length; i++) {
      const fn = normalized[i];
      if (typeof fn !== "string" || fn.length < 1 || fn.length > 50) {
        fail(422, { [`functions.${i}`]: ["Each function must be between 1 and 50 characters."] });
        return;
      }
      const key = fn.toLowerCase();
      if (seen.has(key)) {
        fail(422, { [`functions.${i}`]: ["Duplicate vehicle function."] });
        return;
      }
      seen.add(key);
    }
    input.functions = normalized;
  }
  const sanitizedInput = { ...input };
  if (
    domain === "vehicles" &&
    !user.is_platform_admin &&
    !user.permissions.includes("invoices.manage") &&
    !user.permissions.includes("expenses.manage")
  ) {
    for (const finKey of [
      "acquisition_date",
      "acquisition_cost_minor",
      "financing_type",
      "financing_provider",
      "financing_monthly_minor",
      "financing_end_date",
      "current_book_value_minor",
      "residual_value_minor",
    ]) {
      delete sanitizedInput[finKey];
    }
  }
  const record = {
    ...base,
    ...(domain === "customers"
      ? { email: null, phone: null }
      : {
          year: null,
          status: "available",
          odometer: 0,
          odometer_unit: "km",
          daily_rate_minor: 0,
          functions: [],
        }),
    ...old,
    ...sanitizedInput,
    id: recordId,
    ...(domain === "vehicles" ? { odometer_unit: "km" } : {}),
    updated_at: new Date().toISOString(),
  };
  if (domain === "vehicles")
    record.registration = record.registration.toUpperCase();
  records.set(recordId, record);
  if (control.mutationDelay)
    await new Promise((resolve) => setTimeout(resolve, control.mutationDelay));
  completedWrites++;
  json(id ? 200 : 201, { data: record });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const boundPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        server,
        port: boundPort,
        url: `http://127.0.0.1:${boundPort}`,
      });
    });
  });
}
