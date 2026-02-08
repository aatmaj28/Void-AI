import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration(migrationFile: string) {
    console.log(`\n🔄 Running migration: ${migrationFile}`);

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration file not found: ${migrationPath}`);
        return false;
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    try {
        // Note: Supabase client doesn't support raw SQL execution directly
        // You'll need to run this via Supabase Dashboard SQL Editor or use the Supabase CLI
        console.log('📋 SQL to execute:');
        console.log('─'.repeat(80));
        console.log(sql);
        console.log('─'.repeat(80));
        console.log('\n⚠️  To run this migration, you have two options:\n');
        console.log('Option 1: Supabase Dashboard');
        console.log('  1. Go to: https://supabase.com/dashboard/project/jlwpktzfaqbvweluvvce/editor');
        console.log('  2. Click on "SQL Editor"');
        console.log('  3. Copy and paste the SQL above');
        console.log('  4. Click "Run"\n');
        console.log('Option 2: Supabase CLI (Recommended)');
        console.log('  1. Install: npm install -g supabase');
        console.log('  2. Link project: supabase link --project-ref jlwpktzfaqbvweluvvce');
        console.log('  3. Run: supabase db push\n');

        return true;
    } catch (error) {
        console.error('❌ Error reading migration:', error);
        return false;
    }
}

// Run the migration
runMigration('001_create_companies_table.sql')
    .then((success) => {
        if (success) {
            console.log('✅ Migration script completed');
        } else {
            console.error('❌ Migration failed');
            process.exit(1);
        }
    });
