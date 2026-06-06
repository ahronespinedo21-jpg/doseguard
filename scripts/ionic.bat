@echo off
REM Ionic CLI Wrapper for DoseGuard App
REM This script provides a convenient way to run Ionic CLI commands

if "%1"==" " (
    echo Usage: ionic.bat [command] [options]
    echo Example: ionic.bat serve
    echo          ionic.bat capacitor resource
) else (
    if "%1"=="serve" (
        echo Starting DoseGuard with Angular development server...
        npm run ionic
    ) else (
        echo Running ionic %*
        call npx ionic %*
    )
)
