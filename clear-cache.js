// Force clear all cached data and reload
console.log('🔄 Clearing all cached data...');

// Clear localStorage
localStorage.clear();

// Clear sessionStorage
sessionStorage.clear();

// Clear IndexedDB (where Supabase stores auth data)
if (window.indexedDB) {
    indexedDB.databases().then(databases => {
        databases.forEach(db => {
            if (db.name) {
                indexedDB.deleteDatabase(db.name);
                console.log(`Deleted database: ${db.name}`);
            }
        });
    });
}

console.log('✅ Cache cleared! Reloading in 1 second...');
setTimeout(() => {
    window.location.reload(true);
}, 1000);
