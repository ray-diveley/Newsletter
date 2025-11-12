// Analyze 6 months of historical data to validate categories
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('historical-clean.json', 'utf8'));

function categorizeIssue(issue){
  const summary = issue.summary || '';
  const status = issue.status || '';
  const labels = issue.labels || [];
  const comments = issue.comments || [];
  const commentsText = comments.map(c => c.text || '').join(' ');
  const text = `${summary} ${status} ${commentsText}`.toLowerCase();
  const labelText = labels.map(l => String(l).toLowerCase()).join(' ');
  const has = (re) => re.test(text) || re.test(labelText);
  
  // Client Experience
  if (has(/client portal|customer portal|front[- ]end portal|user portal|self[- ]service/)) return 'client_experience';
  
  // Integration & APIs
  if (has(/integration|\ api[\s\b]|sso|azure ad|authentication.*api|maven|hubspot|nexmo|third[- ]party|webhook|consent.*recording|expert.*network/)) return 'integration_apis';
  
  // Financial Systems
  if (has(/\bbilling\b|\binvoice\b|revenue|payment|pricing|\bfinance\b|financial system|discount program|incentive program|accrual/)) return 'financial_systems';
  
  // Internal Tools & Admin
  if (has(/admin tool|contact management|\bcontact.{0,15}table|account management|client contact|master.*tool|duplicate|system tool|internal tool|crm/)) return 'internal_tools';
  
  // Data & Analytics
  if (has(/\bdata\b.*tool|\breport|analytic|business intelligence|desk research|purchased data|centrali[sz]ed.*data|kpi|intel/)) return 'data_analytics';
  
  // Product & Features
  if (has(/bidding|dragonfly|audience.*dynamic|dynamic.*audience|wallet.*note|registration.*process|discount.*calculat|bulk.*email|campaign.*automat|list.*match|verification.*tool|m3teor|feasibility/)) return 'product_features';
  
  // Testing & Quality
  if (has(/\buat\b|user acceptance test|testing phase|test coverage|qa phase|quality assurance|bug fix.*phase|defect/)) return 'testing_quality';
  
  // Performance & Reliability
  if (has(/performance|speed improvement|latency|optimi[zs]ation|scalab|throughput|efficiency gain|reliability|stability|monitor|uptime|boost/)) return 'performance_reliability';
  
  // Infrastructure & Platform
  if (has(/infrastructure|migration|upgrade.*platform|platform.*upgrade|architecture|moderni[zs]|docker|kubernetes|deployment.*automat|devops/)) return 'infrastructure_platform';
  
  // Security & Compliance
  if (has(/security|encrypt|compliance|gdpr|risk.*assess|privacy|pci|vulnerability|audit|pen[- ]?test|authentication.*permission/)) return 'security_compliance';
  
  return 'general_improvements';
}

const categoryCounts = {};
const categoryExamples = {};

data.issues.forEach(issue => {
  const cat = categorizeIssue(issue);
  categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  if (!categoryExamples[cat]) categoryExamples[cat] = [];
  if (categoryExamples[cat].length < 3) {
    categoryExamples[cat].push(issue.summary);
  }
});

const total = data.issues.length;

console.log(`\n📊 6-Month Historical Analysis (${total} issues)\n`);
console.log('Category Distribution:\n');

const sorted = Object.entries(categoryCounts).sort((a,b) => b[1] - a[1]);
sorted.forEach(([cat, count]) => {
  const percent = ((count / total) * 100).toFixed(1);
  console.log(`${cat.padEnd(25)} ${count.toString().padStart(3)} issues (${percent}%)`);
  console.log(`  Examples: ${categoryExamples[cat].slice(0,2).join(', ')}`);
  console.log('');
});

console.log('\n💡 Insights:');
if (categoryCounts.general_improvements > total * 0.2) {
  console.log(`⚠️  ${categoryCounts.general_improvements} issues (${((categoryCounts.general_improvements/total)*100).toFixed(1)}%) are "general_improvements" - may need more specific patterns`);
}
if (categoryCounts.product_features > total * 0.4) {
  console.log(`✅ Product & Features is ${((categoryCounts.product_features/total)*100).toFixed(1)}% - healthy product development focus`);
}
