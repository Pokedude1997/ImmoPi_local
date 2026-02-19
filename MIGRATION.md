# 🔄 Migration Guide: Backend-Driven Architecture

**Critical Change:** The app now uses a **backend-first architecture** where ALL data operations go through the Node.js API. The frontend is now a thin client with no localStorage persistence.

## ⚠️ Breaking Changes

### What Changed

**Before (Old Architecture):**
```typescript
// Frontend stored everything in localStorage
import { db } from './services/storage';
const properties = db.getProperties(); // localStorage
db.saveProperty(newProperty);         // localStorage
```

**After (New Architecture):**
```typescript
// Frontend calls backend API
import { api } from './services/api';
const properties = await api.getProperties(); // Backend SQLite
await api.createProperty(newProperty);         // Backend SQLite
```

### Files Removed

1. ❌ `services/geminiService.ts` - Duplicated backend AI functionality
2. ❌ `services/storage.ts` - LocalStorage replaced by API calls

### Files Added

1. ✅ `services/api.ts` - Single API client for all backend communication

## 📋 Migration Steps

### Step 1: Update All Pages

Every React page/component needs to be updated to use the new API client.

**Pattern to Replace:**

```typescript
// OLD - Don't use this anymore
import { db } from '../services/storage';

function MyComponent() {
  const [properties, setProperties] = useState(db.getProperties());
  
  const handleSave = (data) => {
    db.saveProperty(data);
    setProperties(db.getProperties());
  };
}
```

**NEW Pattern:**

```typescript
// NEW - Use this instead
import { api } from '../services/api';

function MyComponent() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadProperties();
  }, []);
  
  const loadProperties = async () => {
    try {
      setLoading(true);
      const data = await api.getProperties();
      setProperties(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async (data) => {
    try {
      await api.createProperty(data);
      await loadProperties(); // Reload from backend
    } catch (err) {
      setError(err.message);
    }
  };
}
```

### Step 2: Update Each Page File

You need to update these pages to use the API:

#### Properties.tsx
```typescript
import { api } from '../services/api';

// Replace all db.getProperties() with await api.getProperties()
// Replace db.saveProperty() with await api.createProperty() or await api.updateProperty()
// Replace db.deleteProperty() with await api.deleteProperty()
```

#### Transactions.tsx
```typescript
import { api } from '../services/api';

// Replace db.getTransactions() with await api.getTransactions()
// Replace db.saveTransaction() with await api.createTransaction()
// Replace db.deleteTransaction() with await api.deleteTransaction()
```

#### Documents.tsx
```typescript
import { api } from '../services/api';

// Replace document upload logic with:
const result = await api.uploadDocument(file, propertyId, notes);
// This handles AI analysis, Drive upload, and database save

// Replace db.getDocuments() with await api.getDocuments()
```

#### Tenants.tsx
```typescript
import { api } from '../services/api';

// Replace db.getTenants() with await api.getTenants()
// Replace db.saveTenant() with await api.createTenant()
// Replace db.deleteTenant() with await api.deleteTenant()
```

#### Dashboard.tsx
```typescript
import { api } from '../services/api';

// Replace all db.get*() calls with api.get*()
// Load all data with Promise.all for parallel requests:
const [properties, transactions, categories] = await Promise.all([
  api.getProperties(),
  api.getTransactions(),
  api.getCategories()
]);
```

#### Settings.tsx
```typescript
import { api } from '../services/api';

// Replace db.getSettings() with await api.getSettings()
// Replace db.saveSettings() with await api.updateSettings()
```

#### Reports.tsx
```typescript
import { api } from '../services/api';

// Load data from backend instead of localStorage
```

#### RecurringPayments.tsx
```typescript
import { api } from '../services/api';

// Replace db.getRecurringPayments() with await api.getRecurringPayments()
// Replace db.saveRecurringPayment() with await api.createRecurringPayment()
```

### Step 3: Remove Old Imports

Search your entire codebase for:
```typescript
import { db } from '../services/storage';
import { analyzeDocumentWithGemini } from '../services/geminiService';
```

Replace all with:
```typescript
import { api } from '../services/api';
```

### Step 4: Handle Async Operations

All data operations are now **async**. You must:

1. Add `async` to functions that use the API
2. Use `await` for all API calls
3. Handle loading states
4. Handle errors properly

**Example Error Handling:**

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const saveData = async (data) => {
  try {
    setLoading(true);
    setError(null);
    await api.createProperty(data);
    // Success - reload or update state
  } catch (err) {
    setError(err.message);
    // Show error to user
  } finally {
    setLoading(false);
  }
};
```

### Step 5: Update Document Upload

Document upload is now much simpler:

**OLD (Complex):**
```typescript
// Had to manually call AI, then save, then handle Drive
const aiResult = await analyzeDocumentWithGemini(file);
const doc = db.saveDocument({ ...aiResult });
```

**NEW (Simple):**
```typescript
// Backend handles everything
const result = await api.uploadDocument(file, propertyId, notes);
// Returns: { documentId, driveFileId, driveLink, aiData, validationErrors }
```

### Step 6: Data Migration

**IMPORTANT:** If you have existing data in localStorage, you need to migrate it to the backend!

**Migration Script (run once):**

```typescript
// Create a one-time migration component
import { api } from './services/api';

const STORAGE_KEYS = {
  PROPERTIES: 'immopi_properties',
  TRANSACTIONS: 'immopi_transactions',
  // ... etc
};

async function migrateLocalStorageToBackend() {
  try {
    // 1. Export from localStorage
    const properties = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROPERTIES) || '[]');
    const transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]');
    // ... load all other data

    // 2. Import to backend
    for (const property of properties) {
      await api.createProperty(property);
    }
    
    for (const transaction of transactions) {
      await api.createTransaction(transaction);
    }
    
    // 3. Clear localStorage after successful migration
    localStorage.clear();
    
    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run this once, then remove it
migrateLocalStorageToBackend();
```

## 🔍 Testing Checklist

After migration, test these workflows:

- [ ] Login works and redirects to dashboard
- [ ] Can create, edit, delete properties
- [ ] Can create, edit, delete transactions
- [ ] Can upload documents (AI + Drive storage)
- [ ] Can view document list with Drive links
- [ ] Can create/edit tenants
- [ ] Dashboard loads all data correctly
- [ ] Reports calculate correctly from backend data
- [ ] Settings save and persist
- [ ] Logout clears session
- [ ] Refresh page maintains authentication (if within 24h)

## 🐛 Common Issues

### Issue: "Cannot read property of undefined"

**Cause:** Accessing data before async load completes

**Fix:**
```typescript
// Add loading state
if (loading) return <div>Loading...</div>;
if (!properties) return null;

// Or use optional chaining
properties?.map(p => ...)
```

### Issue: "401 Unauthorized"

**Cause:** Not logged in or session expired

**Fix:** API client automatically redirects to login. Make sure authToken is stored after login:
```typescript
// In Login.tsx
const result = await fetch('/api/auth/login', ...);
const { token } = await result.json();
localStorage.setItem('authToken', token);
```

### Issue: "Data doesn't persist after page refresh"

**Cause:** Not reloading from backend on mount

**Fix:**
```typescript
useEffect(() => {
  loadData(); // Load from backend on mount
}, []);
```

### Issue: "CORS errors"

**Cause:** Frontend and backend on different origins

**Fix:** Update `server/.env`:
```env
CORS_ORIGIN=http://localhost:3000
```

## 📊 Architecture Comparison

### Before: Fragmented
```
Frontend (React)
  ├─ localStorage ──> All data here (fragile)
  ├─ Gemini API ──> Direct AI calls (insecure)
  └─ No backend connection

Backend (Node.js)
  ├─ SQLite DB (empty)
  ├─ Google Drive (unused)
  └─ Endpoints (unused)
```

### After: Unified
```
Frontend (React)
  └─ API Client ──> Single interface
          │
          ▼
     Backend (Node.js)
          ├─ SQLite DB ──> Single source of truth
          ├─ Google Drive ──> Document storage
          ├─ Gemini AI ──> Document analysis
          └─ Auth ──> Session management
```

## 🎯 Benefits

1. **Data Safety:** SQLite + automated backups vs. localStorage (lost on cache clear)
2. **Security:** Authentication protects all operations
3. **AI Safety:** API keys never exposed to frontend
4. **Cloud Storage:** Documents permanently stored in Drive
5. **Single Source of Truth:** Backend database is authoritative
6. **Better Architecture:** Proper separation of concerns
7. **Scalability:** Can add features without frontend changes

## 📝 Next Steps

1. Update all 9 page files to use new API
2. Test each page individually
3. Migrate existing localStorage data (if any)
4. Clear localStorage completely
5. Test full workflows end-to-end
6. Deploy to Raspberry Pi

## 🆘 Need Help?

If you encounter issues:

1. Check backend logs: `pm2 logs immopi-api`
2. Check browser console for frontend errors
3. Verify backend is running: `curl http://localhost:8000/api/auth/check`
4. Check authentication: Token stored in localStorage?
5. Review SETUP.md for configuration issues

---

**Last Updated:** February 19, 2026  
**Version:** 2.0 (Backend-Driven Architecture)
