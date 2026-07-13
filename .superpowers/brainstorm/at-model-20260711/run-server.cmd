@echo off
set "BRAINSTORM_DIR=C:\Users\Administrator\Desktop\test0628\.superpowers\brainstorm\at-model-20260711"
set "BRAINSTORM_HOST=127.0.0.1"
set "BRAINSTORM_URL_HOST=localhost"
set "BRAINSTORM_PORT=57924"
node "C:\Users\Administrator\.codex\skills\brainstorming\scripts\server.cjs" 1>"%BRAINSTORM_DIR%\state\server.log" 2>"%BRAINSTORM_DIR%\state\server.err"
