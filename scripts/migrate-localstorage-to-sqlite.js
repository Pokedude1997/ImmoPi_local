/**
 * Migration Script: localStorage → SQLite Database
 * 
 * This script migrates data from the browser's localStorage (legacy frontend storage)
 * to the SQLite database on the backend (new architecture).
 * 
 * HOW TO USE:
 * 1. Make sure your backend server is running: node server/server.js
 * 2. Open your ImmoPi app in a browser (http://YOUR_PI_IP:3000)
 * 3. Open the browser's Developer Tools (F12 or Ctrl+Shift+I)
 * 4. Go to the Console tab
 * 5. Copy and paste the entire content of this script into the console
 * 6. Press Enter to run it
 * 7. Wait for the migration to complete and check for success messages
 * 
 * The script will:
 * - Read all data from localStorage
 * - POST each entity to the backend API
 * - Report progress and any errors
 */

// ============================================================================
// Configuration - Update these if your API is at a different URL
// ============================================================================
const API_BASE = 'http://192.168.1.18:8000/api';
const AUTH_TOKEN = localStorage.getItem('authToken'); // Get existing session token

// ============================================================================
// Helper: Make authenticated API request
// ============================================================================
async function apiRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  };

  const options = {
    method,
    headers,
    credentials: 'include'
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (response.status === 401) {
    console.warn('Authentication required. Please log in first.');
    throw new Error('Not authenticated');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Main Migration Function
// ============================================================================
async function migrateAllData() {
  console.log('🔄 Starting data migration from localStorage to SQLite...\n');

  // Check if we have localStorage data
  const storageKey = 'immopi_data_v1';
  const rawData = localStorage.getItem(storageKey);
  
  if (!rawData) {
    console.log('❌ No localStorage data found. Migration not needed.');
    return;
  }

  const data = JSON.parse(rawData);
  
  console.log('📊 Found data to migrate:');
  console.log(`   Properties: ${data.properties?.length || 0}`);
  console.log(`   Tenants: ${data.tenants?.length || 0}`);
  console.log(`   Transactions: ${data.transactions?.length || 0}`);
  console.log(`   Recurring Payments: ${data.recurringPayments?.length || 0}`);
  console.log(`   Documents: ${data.documents?.length || 0}`);
  console.log('');

  const results = {
    properties: { success: 0, failed: 0, errors: [] },
    tenants: { success: 0, failed: 0, errors: [] },
    transactions: { success: 0, failed: 0, errors: [] },
    recurringPayments: { success: 0, failed: 0, errors: [] },
    documents: { success: 0, failed: 0, errors: [] }
  };

  // ==========================================================================
  // Step 1: Check if data already exists in backend (avoid duplicates)
  // ==========================================================================
  console.log('🔍 Checking backend for existing data...');
  
  const [existingProps, existingTenants, existingTx, existingRecurring, existingDocs] = await Promise.all([
    apiRequest('/properties').catch(() => []),
    apiRequest('/tenants').catch(() => []),
    apiRequest('/transactions').catch(() => []),
    apiRequest('/recurring-payments').catch(() => []),
    apiRequest('/documents').catch(() => [])
  ]);

  console.log(`   Backend has: ${existingProps.length} properties, ${existingTenants.length} tenants, ${existingTx.length} transactions, ${existingRecurring.length} recurring payments, ${existingDocs.length} documents`);
  console.log('');

  // ==========================================================================
  // Step 2: Migrate each entity type
  // ==========================================================================

  // Helper to check if entity exists by name/description
  const entityExists = (newEntity, existingEntities, idField = 'id') => {
    if (!existingEntities || existingEntities.length === 0) return false;
    return existingEntities.some(e => e[idField] === newEntity[idField]);
  };

  // Migrate Properties
  if (data.properties && data.properties.length > 0) {
    console.log('🏢 Migrating Properties...');
    for (const prop of data.properties) {
      try {
        const exists = entityExists(prop, existingProps);
        if (exists) {
          console.log(`   ✅ Property "${prop.name}" already exists, skipping`);
          results.properties.success++;
          continue;
        }
        const created = await apiRequest('/properties', 'POST', prop);
        console.log(`   ✅ Property "${prop.name}" migrated (ID: ${created.id || created.insertId})`);
        results.properties.success++;
      } catch (error) {
        console.log(`   ❌ Property "${prop.name}" failed: ${error.message}`);
        results.properties.failed++;
        results.properties.errors.push({ entity: prop.name, error: error.message });
      }
    }
    console.log(`   Properties: ${results.properties.success} succeeded, ${results.properties.failed} failed\n`);
  }

  // Migrate Tenants
  if (data.tenants && data.tenants.length > 0) {
    console.log('👥 Migrating Tenants...');
    for (const tenant of data.tenants) {
      try {
        const exists = entityExists(tenant, existingTenants);
        if (exists) {
          console.log(`   ✅ Tenant "${tenant.name}" already exists, skipping`);
          results.tenants.success++;
          continue;
        }
        // Map frontend tenant format to backend format
        const backendTenant = {
          firstName: tenant.name.split(' ')[0] || tenant.name,
          lastName: tenant.name.split(' ').slice(1).join(' ') || '',
          email: tenant.email || '',
          phone: tenant.phone || '',
          property_id: tenant.propertyId || null,
          leaseStart: tenant.startDate || '',
          leaseEnd: tenant.endDate || '',
          rentAmount: tenant.rentAmount || 0,
          deposit: tenant.deposit || 0,
          notes: tenant.notes || ''
        };
        const created = await apiRequest('/tenants', 'POST', backendTenant);
        console.log(`   ✅ Tenant "${tenant.name}" migrated (ID: ${created.id})`);
        results.tenants.success++;
      } catch (error) {
        console.log(`   ❌ Tenant "${tenant.name}" failed: ${error.message}`);
        results.tenants.failed++;
        results.tenants.errors.push({ entity: tenant.name, error: error.message });
      }
    }
    console.log(`   Tenants: ${results.tenants.success} succeeded, ${results.tenants.failed} failed\n`);
  }

  // Migrate Transactions
  if (data.transactions && data.transactions.length > 0) {
    console.log('💰 Migrating Transactions...');
    for (const tx of data.transactions) {
      try {
        const exists = entityExists(tx, existingTx);
        if (exists) {
          console.log(`   ✅ Transaction "${tx.description}" already exists, skipping`);
          results.transactions.success++;
          continue;
        }
        // Map frontend format to backend format
        const backendTx = {
          date: tx.date,
          amount: tx.amount,
          currency: tx.currency || 'EUR',
          description: tx.description,
          type: tx.type,
          property_id: tx.propertyId || null,
          category_id: tx.categoryId || null,
          counterparty_id: tx.counterpartyId || null,
          document_id: tx.documentId || null,
          isAutoGenerated: tx.isAutoGenerated ? 1 : 0
        };
        const created = await apiRequest('/transactions', 'POST', backendTx);
        console.log(`   ✅ Transaction "${tx.description}" migrated (ID: ${created.id})`);
        results.transactions.success++;
      } catch (error) {
        console.log(`   ❌ Transaction "${tx.description}" failed: ${error.message}`);
        results.transactions.failed++;
        results.transactions.errors.push({ entity: tx.description, error: error.message });
      }
    }
    console.log(`   Transactions: ${results.transactions.success} succeeded, ${results.transactions.failed} failed\n`);
  }

  // Migrate Recurring Payments
  if (data.recurringPayments && data.recurringPayments.length > 0) {
    console.log('🔄 Migrating Recurring Payments...');
    for (const rp of data.recurringPayments) {
      try {
        const exists = entityExists(rp, existingRecurring);
        if (exists) {
          console.log(`   ✅ Recurring "${rp.name}" already exists, skipping`);
          results.recurringPayments.success++;
          continue;
        }
        // Map frontend format to backend format
        const backendRp = {
          name: rp.name,
          amount: rp.amount,
          currency: rp.currency || 'EUR',
          frequency: rp.frequency,
          startDate: rp.startDate,
          endDate: rp.endDate || null,
          category_id: rp.categoryId || null,
          property_id: rp.propertyId || null,
          counterparty_id: rp.counterpartyId || null,
          isActive: rp.active ? 1 : 0
        };
        const created = await apiRequest('/recurring-payments', 'POST', backendRp);
        console.log(`   ✅ Recurring "${rp.name}" migrated (ID: ${created.id})`);
        results.recurringPayments.success++;
      } catch (error) {
        console.log(`   ❌ Recurring "${rp.name}" failed: ${error.message}`);
        results.recurringPayments.failed++;
        results.recurringPayments.errors.push({ entity: rp.name, error: error.message });
      }
    }
    console.log(`   Recurring Payments: ${results.recurringPayments.success} succeeded, ${results.recurringPayments.failed} failed\n`);
  }

  // Migrate Documents
  // NOTE: Documents cannot be automatically migrated because the backend only accepts
  // document creation via /api/documents/analyze which requires an actual file upload.
  // Documents stored in localStorage were saved without file uploads to Google Drive.
  // You will need to re-upload your document files to migrate them.
  if (data.documents && data.documents.length > 0) {
    console.log('📄 Documents: Skipping migration');
    console.log(`   ⚠️  ${data.documents.length} documents found in localStorage but cannot be auto-migrated.`);
    console.log('   ℹ️  Reason: Backend requires file upload via /api/documents/analyze');
    console.log('   💡  To migrate: Re-upload your document files through the Documents page');
    console.log('');
    results.documents.success = 0;
    results.documents.failed = data.documents.length;
    results.documents.errors.push({
      entity: 'All documents',
      error: 'Requires file re-upload. No direct API endpoint for document metadata without file.'
    });
  }

  // ==========================================================================
  // Step 3: Final Report
  // ==========================================================================
  console.log('='.repeat(60));
  console.log('📋 MIGRATION REPORT');
  console.log('='.repeat(60));
  
  const totalSuccess = Object.values(results).reduce((sum, r) => sum + r.success, 0);
  const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
  
  console.log(`✅ Total Succeeded: ${totalSuccess}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log('');
  
  for (const [entityType, result] of Object.entries(results)) {
    if (result.failed > 0) {
      console.log(`⚠️  ${entityType} Errors:`);
      result.errors.forEach(e => {
        console.log(`   - ${e.entity}: ${e.error}`);
      });
    }
  }

  if (totalFailed === 0 && totalSuccess > 0) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('✨ Your data is now in the SQLite database.');
    console.log('💡 You can now safely use the updated application.');
  } else if (totalSuccess === 0) {
    console.log('\n⚠️  No data was migrated. Check if you already have data in SQLite.');
  }

  return results;
}

// ============================================================================
// Run the migration
// ============================================================================
console.log('%c🚀 ImmoPi Data Migration Script', 'color: #3b82f6; font-size: 18px; font-weight: bold;');
console.log('%cThis script migrates your data from browser localStorage to the SQLite database.', 'color: #64748b;');
console.log('%cRun this in your browser console while logged into ImmoPi.', 'color: #64748b;');
console.log('');

// Run migration and handle any top-level errors
migrateAllData().then(results => {
  // Migration complete
}).catch(error => {
  console.error('❌ Migration failed:', error.message);
  console.error('Stack:', error.stack);
});
