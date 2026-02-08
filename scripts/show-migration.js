const fs = require('fs');
const path = require('path');

console.log('\n📋 Companies Table SQL Migration');
console.log('═'.repeat(80));

const sqlPath = path.join(__dirname, 'create-companies-table.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

console.log(sql);
console.log('═'.repeat(80));

console.log('\n✅ To create the companies table, follow these steps:\n');
console.log('1️⃣  Go to your Supabase Dashboard SQL Editor:');
console.log('   https://supabase.com/dashboard/project/jlwpktzfaqbvweluvvce/sql/new\n');
console.log('2️⃣  Copy the SQL above (or from scripts/create-companies-table.sql)\n');
console.log('3️⃣  Paste it into the SQL Editor\n');
console.log('4️⃣  Click "Run" to execute\n');
console.log('─'.repeat(80));
console.log('The SQL has been saved to: scripts/create-companies-table.sql');
console.log('─'.repeat(80));
