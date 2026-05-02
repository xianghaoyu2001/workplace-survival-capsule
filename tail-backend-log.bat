@echo off
powershell -ExecutionPolicy Bypass -NoExit -Command "cd /d 'D:\job_project\workplace-survival-capsule\backend'; if (!(Test-Path logs)) { New-Item -ItemType Directory logs | Out-Null }; if (!(Test-Path logs\backend.log)) { New-Item -ItemType File logs\backend.log | Out-Null }; Get-Content logs\backend.log -Wait -Tail 80"

