const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://jlwpktzfaqbvweluvvce.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsd3BrdHpmYXFidndlbHV2dmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjE3MzksImV4cCI6MjA4NTk5NzczOX0.KSKDcKP9lrBNPx3kBZHaCNhrQXK_tVVQmiFV4QU9W70"
);

async function run() {
  // Test if tables exist by trying to query them
  const { data: br, error: brErr } = await supabase
    .from("backtest_results")
    .select("id")
    .limit(1);

  if (brErr && brErr.message.includes("does not exist")) {
    console.log("backtest_results table does NOT exist yet.");
    console.log("Please run the SQL migration in your Supabase dashboard:");
    console.log("  Dashboard > SQL Editor > paste contents of:");
    console.log("  supabase/migrations/018_create_backtest_results.sql");
  } else if (brErr) {
    console.log("backtest_results error:", brErr.message);
  } else {
    console.log("backtest_results: EXISTS (" + (br?.length ?? 0) + " rows)");
  }

  const { data: bs, error: bsErr } = await supabase
    .from("backtest_summary")
    .select("id")
    .limit(1);

  if (bsErr && bsErr.message.includes("does not exist")) {
    console.log("backtest_summary table does NOT exist yet.");
  } else if (bsErr) {
    console.log("backtest_summary error:", bsErr.message);
  } else {
    console.log("backtest_summary: EXISTS (" + (bs?.length ?? 0) + " rows)");
  }
}

run();
