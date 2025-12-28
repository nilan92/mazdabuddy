# CRITICAL: Force Profile Refresh Instructions

## The Problem

Your browser has cached old profile data showing:

- Wrong role (technician instead of admin)
- Wrong workshop name
- Missing navigation tabs

## The Database is Already Fixed ✅

The database now has the correct data:

- Name: Nilan
- Role: admin
- Workshop: Performance Auotomotive Engineering
- All your data has been migrated to a new proper tenant ID

## Solution: Force Clear Browser Cache

### STEP 1: Open Browser Console

1. Go to http://localhost:5173 in your browser
2. Press **F12** (or Cmd+Option+I on Mac) to open Developer Tools
3. Click on the **Console** tab

### STEP 2: Run Cache Clear Script

Copy and paste this entire script into the console and press Enter:

```javascript
// Force clear all cached data
console.log("🔄 Clearing all cached data...");

// Clear localStorage
localStorage.clear();

// Clear sessionStorage
sessionStorage.clear();

// Clear IndexedDB (where Supabase stores auth data)
if (window.indexedDB) {
  indexedDB.databases().then((databases) => {
    databases.forEach((db) => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
        console.log(`Deleted database: ${db.name}`);
      }
    });
  });
}

console.log("✅ Cache cleared! Reloading...");
setTimeout(() => {
  window.location.reload(true);
}, 1000);
```

### STEP 3: Verify After Reload

After the page reloads, check the console for this log message:

```
[Auth] Profile loaded: {
  name: "Nilan",
  role: "admin",
  tenant: "Performance Auotomotive Engineering",
  tenant_id: "1f19ca6a-ac2d-4013-a6a1-47c5074ff237"
}
```

### STEP 4: Verify UI

You should now see:
✅ Workshop name: "Performance Auotomotive Engineering"
✅ Your role: "ADMIN"
✅ All navigation tabs:

- Dashboard
- Smart Scan
- Jobs Board
- Customers
- Inventory
- Invoices
- Finances
- Settings

## Alternative: Sign Out Method

If the above doesn't work:

1. Click "Sign Out" in the sidebar
2. Close the browser tab completely
3. Open a new tab and go to http://localhost:5173
4. Log in again with your credentials

## What I Changed in the Code

1. Added debug logging to show what profile data is loaded
2. Added automatic profile refresh when you switch back to the tab
3. Fixed the database tenant ID issue
4. Removed insecure RLS policies

The code changes are already applied and running in your dev server.
