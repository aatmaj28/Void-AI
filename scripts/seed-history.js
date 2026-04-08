const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE config in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedHistory() {
  console.log("Seeding 90 days of historical gap score data...");
  const records = [];
  
  // Starting values
  let currentScore = 65;
  let currentOpps = 25;
  
  // Generate data for the past 90 days up to today
  const today = new Date();
  
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    
    // Slight random walk / trend logic
    // Add small random fluctuation, overall slight upward trend
    currentScore = Math.max(0, Math.min(100, currentScore + (Math.random() * 4 - 1.8)));
    currentOpps = Math.max(5, currentOpps + Math.floor(Math.random() * 5 - 2));

    records.push({
      date: d.toISOString().split('T')[0],
      avg_score: Number(currentScore.toFixed(2)),
      opportunities_count: currentOpps,
    });
  }

  // Insert in chunks
  const chunkSize = 30;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { data, error } = await supabase.from("gap_score_history").upsert(chunk, { onConflict: "date" });
    if (error) {
      console.error("Error inserting chunk:", error);
    } else {
      console.log(`Inserted chunk ${i / chunkSize + 1}`);
    }
  }
  
  console.log("Seeding complete!");
}

seedHistory();
