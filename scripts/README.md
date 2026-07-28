# Migration Scripts

This directory contains scripts for migrating data during the architecture transition from localStorage to SQLite backend.

## Files

| File | Purpose |
|------|---------|
| `migrate-localstorage-to-sqlite.js` | Main migration script - copy and paste into browser console |
| `MIGRATION_GUIDE.md` | Detailed step-by-step guide |
| `README.md` | This file |

## Quick Start

Your data is **safe** in browser localStorage. To migrate it:

```
1. Start backend: node server/server.js
2. Log in to ImmoPi in your browser
3. Open DevTools (F12) → Console tab
4. Copy contents of migrate-localstorage-to-sqlite.js
5. Paste into Console and press Enter
6. Wait for completion message
```

That's it! Your transactions and recurring payments will be migrated.

**Note:** Documents must be re-uploaded manually (see MIGRATION_GUIDE.md)

## What Was Changed

The following pages were updated to use the backend API instead of localStorage:
- `pages/Documents.tsx`
- `pages/Reports.tsx`
- `pages/RecurringPayments.tsx`

This caused data to appear "missing" because it was looking in SQLite (empty) instead of localStorage (where your data was).

## After Migration

✅ All your data will be in SQLite (`server/immopi.db`)  
✅ The app will use the backend consistently  
✅ Category management in Settings will work  
✅ Future changes will be persistent across browsers/devices  

---

**Created:** July 28, 2026
