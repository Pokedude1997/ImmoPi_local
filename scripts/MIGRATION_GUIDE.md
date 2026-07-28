# ImmoPi Data Migration Guide

## Problem

Your ImmoPi application is transitioning from **frontend-only localStorage storage** to a **backend-driven SQLite database architecture**. After recent changes to use the backend API consistently, data that was previously stored in your browser's localStorage (transactions, recurring payments, documents) appears to have "disappeared" because the application is now looking for this data in the SQLite database instead.

**Good news:** Your data is still safe in your browser's localStorage! It just needs to be migrated to the SQLite database.

---

## Solution: Run the Migration Script

### Step 1: Start Your Backend Server

Make sure your ImmoPi backend is running:

```bash
cd ~/ImmoPi_local/server
node server.js
```

You should see:
```
✅ Connected to SQLite database.
🚀 ImmoPi Server running on http://localhost:8000
⚡ Ready to accept requests
```

### Step 2: Start Your Frontend

In another terminal:

```bash
cd ~/ImmoPi_local
npm run dev  # or serve the built files
```

Access your app at `http://YOUR_PI_IP:3000` (or `http://localhost:3000`)

### Step 3: Log In

Log in to your ImmoPi application normally. Make sure you're authenticated.

### Step 4: Open Browser Developer Tools

1. Open your browser (Chrome, Firefox, Edge, etc.)
2. Navigate to your ImmoPi app
3. Press **F12** (or **Ctrl+Shift+I** / **Cmd+Opt+I** on Mac)
4. Go to the **Console** tab

### Step 5: Copy and Run the Migration Script

1. Open the file: `scripts/migrate-localstorage-to-sqlite.js`
2. Copy **ALL** of its contents (Ctrl+A, Ctrl+C)
3. Paste it into your browser's Console tab (Ctrl+V)
4. Press **Enter** to run it

### Step 6: Wait for Completion

The script will:
1. Check for data in localStorage
2. Show you what it found
3. Migrate each entity type to the backend
4. Display a progress report

You should see output like:
```
🔄 Starting data migration from localStorage to SQLite...

📊 Found data to migrate:
   Properties: 2
   Tenants: 3
   Transactions: 15
   Recurring Payments: 5
   Documents: 8

🔍 Checking backend for existing data...
   Backend has: 2 properties, 3 tenants, 0 transactions, 0 recurring payments, 0 documents

💰 Migrating Transactions...
   ✅ Transaction "Rent Payment - January" migrated (ID: 1)
   ✅ Transaction "Maintenance Fee" migrated (ID: 2)
   ...

🔄 Migrating Recurring Payments...
   ✅ Recurring "Monthly Rent" migrated (ID: 1)
   ...

📄 Documents: Skipping migration
   ⚠️  8 documents found in localStorage but cannot be auto-migrated.
   ℹ️  Reason: Backend requires file upload via /api/documents/analyze
   💡  To migrate: Re-upload your document files through the Documents page

============================================================
📋 MIGRATION REPORT
============================================================
✅ Total Succeeded: 20
❌ Total Failed: 0

🎉 Migration completed successfully!
✨ Your data is now in the SQLite database.
💡 You can now safely use the updated application.
```

---

## What Gets Migrated

| Entity | Status | Notes |
|--------|--------|-------|
| **Properties** | ✅ Automatic | Fully migrated |
| **Tenants** | ✅ Automatic | Fully migrated |
| **Transactions** | ✅ Automatic | Fully migrated |
| **Recurring Payments** | ✅ Automatic | Fully migrated |
| **Categories** | ⚠️ Already migrated | Were pre-seeded in SQLite |
| **Documents** | ❌ Manual required | Must re-upload files |
| **Settings** | ⚠️ Not in localStorage | Uses backend settings |

---

## After Migration

### ✅ What Works Now
- All your transactions will appear in the Transactions page
- All your recurring payments will appear in the Recurring Payments page
- All your properties and tenants will work as before
- Category management in Settings will work with your existing data

### ⚠️ What Needs Manual Attention

**Documents:** Since documents require actual file uploads to Google Drive, they cannot be automatically migrated. You need to:

1. Go to the **Documents** page
2. Re-upload each document file that you had previously saved
3. The AI will re-analyze them and they'll be saved to both SQLite and Google Drive

**Note:** This is a one-time process. After re-uploading, all future document operations will use the backend.

---

## Verification

After running the migration, verify your data is back:

1. **Transactions page** - Should show all your transactions
2. **Recurring Payments page** - Should show all your recurring payments
3. **Reports page** - Should include your transactions in reports
4. **Settings > Categories** - Should show the category management UI with your existing categories

---

## If You Have Issues

### "Not authenticated" error
Make sure you're logged in before running the script. The script uses your existing session token.

### Data appears duplicated
The script checks for existing data before migrating. If you run it twice, it should skip existing items.

### Some migrations failed
Check the error messages in the console. Common issues:
- Missing required fields in old data
- Foreign key constraints (e.g., transaction references a category that doesn't exist)

---

## Technical Details

### Before the Changes
```
Frontend (React) ←localStorage→ Browser Storage
     ↓
  User adds transactions
     ↓
  Saved to localStorage via db.saveTransaction()
```

### After the Changes
```
Frontend (React) ←HTTP/JSON→ Backend (Node.js) ←SQLite→ immopi.db
     ↓
  User adds transactions
     ↓
  Saved to SQLite via api.createTransaction()
```

The migration script bridges the gap between these two architectures.

---

## Need Help?

If the migration doesn't work or you have questions:

1. Check the browser console for error messages (red text)
2. Take a screenshot of any errors
3. Note which entities failed to migrate
4. Contact with the error details

---

## Final Step: Prevent This in the Future

Once migration is complete, you should clean up the old localStorage-based code:

```bash
# Remove or archive the old storage service
mv services/storage.ts services/storage.ts.legacy
```

And ensure all pages use the `api` service instead of `db` from storage.ts.

---

**Last Updated:** July 28, 2026  
**Version:** 1.0
