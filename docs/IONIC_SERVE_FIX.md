# Ionic Serve Configuration Guide

## Issue
The `ionic serve` command fails with:
```
Error: Unknown arguments: host, port
```

This occurs because **Ionic CLI 7.2.1** doesn't natively support Angular 18's `ng run` command syntax.

## Solution - Use npm scripts instead:

### For development (port 4200):
```bash
npm run ionic
# or
npm start
```

### For Ionic/Capacitor testing (port 8100):
```bash
npm run serve-ionic
```

### Direct Angular CLI (port 4200):
```bash
ng serve
```

## Why this happens
- Ionic CLI 7.2.1 passes `--host=localhost --port=8100` as command-line arguments
- Angular CLI 18 expects these as `--host=VALUE --port=VALUE` (with spaces)
- The old `--host=VALUE` syntax no longer works with Angular 18+

## Workaround for `ionic serve`
If you need to use `ionic serve` specifically, consider upgrading to Ionic CLI 8.x or later, which has better Angular 18 support.

For now, the npm scripts provide full functionality and compatibility.
