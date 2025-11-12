// Test categorization logic offline
const testIssues = [
  { summary: "Bidding 2.3", status: "In Progress" },
  { summary: "DragonFly (Consent with recordings)", status: "In Progress" },
  { summary: "Expert Networks Phase 2", status: "UAT" },  // Status=UAT not Testing phase
  { summary: "Client Portal - Phase 1", status: "In Progress" },
  { summary: "Centralised data tool management", status: "In Progress" },
  { summary: "Updated Client contacts table", status: "In Progress" },
  { summary: "Automatic discount calculation - Phase 2", status: "In Progress" },
  { summary: "Dynamic Audience Main/Sub Items", status: "In Progress" },
  { summary: "Wallet Member Notes", status: "Done" },
  { summary: "Bidding 2.2", status: "Done" },
  { summary: "Accrual Phase #3", status: "Done" },
  { summary: "Updates to the registration process", status: "Done" }
];

function categorizeIssue(issue){
  const summary = issue.summary || '';
  const status = issue.status || '';
  const text = `${summary} ${status}`.toLowerCase();
  const has = (re) => re.test(text);
  
  // Client Experience (portals, UI/UX, client-facing improvements) - check first as it's specific
  if (has(/client portal|customer portal|front[- ]end portal|user portal|self[- ]service/)) return 'client_experience';
  
  // Financial Systems (billing, payments, revenue, invoicing) - specific financial keywords
  if (has(/\bbilling\b|\binvoice\b|revenue|payment|pricing|\bfinance\b|financial system|discount program|incentive program|accrual calculation/)) return 'financial_systems';
  
  // Internal Tools & Admin (admin panels, internal tooling, system management)
  if (has(/admin tool|contact management|\bcontact.{0,15}table|account management|client contact|master.*tool|duplicate|system tool|internal tool|crm/)) return 'internal_tools';
  
  // Integration & APIs (third-party integrations, API work)
  if (has(/integration|\ api[\s\b]|sso|azure ad|authentication.*api|maven|hubspot|nexmo|third[- ]party|webhook|consent.*recording/)) return 'integration_apis';
  
  // Data & Analytics (reporting, data management, analytics tools)
  if (has(/\bdata\b.*tool|\breport|analytic|business intelligence|desk research|purchased data|centrali[sz]ed.*data/)) return 'data_analytics';
  
  // Testing & Quality (UAT, testing, QA) - prioritize as it's often in status
  if (has(/\buat\b|user acceptance test|testing phase|test coverage|qa phase|quality assurance|bug fix.*phase|defect/)) return 'testing_quality';
  
  // Product & Features (new offerings, major features, product development) - broader catch-all for products
  if (has(/bidding|dragonfly|expert network|audience.*dynamic|dynamic.*audience|wallet.*note|registration.*process|discount.*calculat/)) return 'product_features';
  
  // Performance & Reliability (optimization, stability, performance)
  if (has(/performance|speed improvement|latency|optimi[zs]ation|scalab|throughput|efficiency gain|reliability|stability|monitor|uptime/)) return 'performance_reliability';
  
  // Infrastructure & Platform (migrations, architecture, platform work)
  if (has(/infrastructure|migration|upgrade.*platform|platform.*upgrade|architecture|moderni[zs]|docker|kubernetes|deployment.*automat|devops/)) return 'infrastructure_platform';
  
  // Security & Compliance (security, auth, compliance, risk)
  if (has(/security|encrypt|compliance|gdpr|risk.*assess|privacy|pci|vulnerability|audit|pen[- ]?test/)) return 'security_compliance';
  
  return 'general_improvements';
}

console.log("Testing categorization:\n");
const counts = {};
testIssues.forEach(issue => {
  const cat = categorizeIssue(issue);
  counts[cat] = (counts[cat] || 0) + 1;
  console.log(`"${issue.summary}" → ${cat}`);
});

console.log("\nCategory counts:");
Object.entries(counts).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});
