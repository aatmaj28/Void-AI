require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from("alerts").select("id").limit(1);
  if (error) {
    console.log("ALERTS TABLE ERROR:", error.message);
  } else {
    console.log("ALERTS TABLE EXISTS");
  }

  const { data: s, error: se } = await supabase.from("alert_settings").select("id").limit(1);
  if (se) {
    console.log("ALERT_SETTINGS TABLE ERROR:", se.message);
  } else {
    console.log("ALERT_SETTINGS TABLE EXISTS");
  }
}
check();
