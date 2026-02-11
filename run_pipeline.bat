@echo off
REM Daily pipeline: yfinance + Supabase + scoring. Run via Task Scheduler or double-click.
cd /d "%~dp0"
echo --- Run started %date% %time% --- >> pipeline_log.txt
python scripts/pipeline_daily.py >> pipeline_log.txt 2>&1
echo --- Run finished %date% %time% --- >> pipeline_log.txt
echo. >> pipeline_log.txt
