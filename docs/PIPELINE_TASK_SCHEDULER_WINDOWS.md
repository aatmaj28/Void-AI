# Run the Daily Pipeline on Windows Task Scheduler

Use these steps to run the pipeline **every day at a set time** (e.g. 6:00 AM or 9:00 AM) on your Windows laptop. Your `.env.local` is used automatically.

---

## Step 1: Create the batch file (already in the repo)

The project includes **`run_pipeline.bat`** in the repo root. It:

- Changes to the project folder (works even if you move the folder).
- Runs `python scripts/pipeline_daily.py`.

If you prefer to create it yourself, in the project root create **`run_pipeline.bat`** with:

```bat
@echo off
cd /d "%~dp0"
python scripts/pipeline_daily.py
```

---

## Step 2: Test the batch file

1. Open **File Explorer** and go to your project folder (e.g. `D:\NEU\NEU Subjects\Sem 4 - Spring 2026\Applied Prog\Project\void ai`).
2. Double‑click **`run_pipeline.bat`**.
3. A command window will open and run the pipeline. You should see “Daily pipeline — fetch yfinance + Supabase + scoring” and progress. When it finishes, the window closes.
4. If you get “python is not recognized”, install Python and make sure “Add Python to PATH” was checked, or use the full path to `python.exe` in the batch file.

---

## Step 3: Open Task Scheduler

1. Press **Win + R** to open the Run dialog.
2. Type **`taskschd.msc`** and press **Enter**.
3. **Task Scheduler** opens.

---

## Step 4: Create a new task

1. On the right, click **Create Basic Task…** (or **Create Task…** if you want more options).
2. **Name:** e.g. `Void AI Daily Pipeline`.
3. **Description (optional):** e.g. `Fetch yfinance data and update Supabase coverage_gap_scores`.
4. Click **Next**.

---

## Step 5: Set the trigger (when to run)

1. **Trigger:** choose **Daily**. Click **Next**.
2. **Start:** pick the date (today is fine) and **time** (e.g. **6:00:00 AM** or **9:00:00 AM**).
3. **Recur every:** 1 day.
4. Click **Next**.

---

## Step 6: Set the action (what to run)

1. **Action:** choose **Start a program**. Click **Next**.
2. **Program/script:** click **Browse** and select **`run_pipeline.bat`** in your project folder  
   (e.g. `D:\NEU\NEU Subjects\Sem 4 - Spring 2026\Applied Prog\Project\void ai\run_pipeline.bat`).
3. **Start in (optional):** leave empty; the batch file already changes to the project folder.
4. Click **Next**, then **Finish**.

---

## Step 7: Make sure it runs when you’re logged off (optional)

1. In Task Scheduler, find your task in the list (e.g. **Void AI Daily Pipeline**).
2. Right‑click it → **Properties**.
3. **General** tab: if you want it to run even when you’re not logged in, select **Run whether user is logged on or not** (you may need to enter your Windows password).  
   If you prefer it to run only when you’re logged in, keep **Run only when user is logged on**.
4. Click **OK**.

---

## Step 8: Run it once to test

1. In Task Scheduler, right‑click your task → **Run**.
2. Wait a few seconds, then check:
   - **Last Run Result** (column or in task Properties → **History**) should be **0x0** (success) when the pipeline finishes without error.
   - In Supabase, **coverage_gap_scores** (and related tables) should have recent **updated_at** after a successful run.

---

## Summary

| Step | What to do |
|------|------------|
| 1 | Use **`run_pipeline.bat`** in the project root (or create it as above). |
| 2 | Test by double‑clicking the batch file. |
| 3 | Open **Task Scheduler** (`taskschd.msc`). |
| 4 | **Create Basic Task** → name (e.g. Void AI Daily Pipeline) → Next. |
| 5 | Trigger: **Daily** at your chosen time (e.g. 6:00 AM) → Next. |
| 6 | Action: **Start a program** → Browse to **run_pipeline.bat** → Next → Finish. |
| 7 | (Optional) In task Properties, set “Run whether user is logged on or not” if you want it to run when locked. |
| 8 | Right‑click task → **Run** to test. |

The pipeline will run at the scheduled time whenever the PC is on (and, if you chose it, even when you’re not logged in). It uses **`.env.local`** in the project folder for `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
