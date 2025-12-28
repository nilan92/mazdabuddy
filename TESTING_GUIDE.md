# 🧪 MazdaBuddy/AutoPulse OS - Testing Guide

**Version:** V7.0  
**Last Updated:** December 28, 2025  
**App URL:** http://localhost:5173 (or your dev server port)

---

## 📱 **Quick Start**

Your app is currently running with `npm run dev`. Open your browser and navigate to the local development URL to begin testing.

---

## 🎯 **Testing Checklist**

### **1. 🔐 Authentication & Security**

#### **Login Page** (`/#/login`)

- [ ] Page loads without errors
- [ ] AutoPulse branding displays correctly
- [ ] Email/password input fields work
- [ ] "Sign In" button functions
- [ ] Google Sign-In button appears (if configured)
- [ ] "Forgot Password?" link navigates correctly
- [ ] "Create Account" link navigates to registration
- [ ] Error messages display for invalid credentials
- [ ] Mobile responsive (test on 375px width)
- [ ] Dark mode theme consistent

#### **Registration** (`/#/register`)

- [ ] Registration form displays
- [ ] All required fields present (name, email, password, workshop)
- [ ] Form validation works
- [ ] Password strength indicator (if any)
- [ ] "Sign Up" button creates account
- [ ] Redirects to dashboard after successful registration
- [ ] "Already have an account?" link works

#### **Password Recovery**

- [ ] Forgot password page loads (`/#/forgot-password`)
- [ ] Email submission works
- [ ] Reset password page loads (`/#/reset-password`)
- [ ] Password reset functionality works

#### **Profile Sync**

- [ ] ✅ **CRITICAL**: No "infinite recursion detected in policy" error
- [ ] Profile loads successfully after login
- [ ] No "Identity Sync Failed" error screen
- [ ] User role (Admin/Technician) loads correctly

---

### **2. 🏠 Main Application**

#### **Dashboard** (`/#/`)

- [ ] Dashboard loads after login
- [ ] Welcome message shows user's name
- [ ] Stats cards display (Total Jobs, Active Jobs, etc.)
- [ ] Recent activity section shows data
- [ ] Navigation sidebar visible
- [ ] Mobile: Bottom navigation works
- [ ] No console errors

#### **Jobs** (`/#/jobs`)

- [ ] Job list loads
- [ ] "Create Job" button works
- [ ] Job cards display correctly
- [ ] Status badges show (Pending, In Progress, Completed)
- [ ] Click on job opens details modal
- [ ] Job details modal shows:
  - [ ] Vehicle information
  - [ ] Customer details
  - [ ] Parts list
  - [ ] Labor entries
  - [ ] Notes section
  - [ ] Status update dropdown
- [ ] Edit job functionality works
- [ ] Delete job (if available)
- [ ] Search/filter jobs
- [ ] Mobile: Cards stack properly
- [ ] **Performance**: No lag when loading jobs

#### **Inventory** (`/#/inventory`)

- [ ] Parts list displays
- [ ] "Add Part" button works
- [ ] Part cards show:
  - [ ] Part name
  - [ ] Part number
  - [ ] Stock quantity
  - [ ] Price (LKR)
- [ ] Edit part functionality
- [ ] Delete part functionality
- [ ] Search/filter parts
- [ ] Low stock indicators (if any)
- [ ] Mobile responsive

#### **Invoices** (`/#/invoices`)

- [ ] ✅ **CRITICAL**: No lag when loading invoices (previously fixed)
- [ ] Invoice list displays
- [ ] "Create Invoice" button works
- [ ] Invoice cards show:
  - [ ] Invoice number
  - [ ] Customer name
  - [ ] Total amount
  - [ ] Date
  - [ ] Status
- [ ] Click invoice to view details
- [ ] PDF export button works
- [ ] PDF downloads correctly
- [ ] Invoice calculation accurate (parts + labor)
- [ ] Mobile landscape: Proper padding (previously fixed)
- [ ] Search/filter invoices

#### **Customers** (`/#/customers`)

- [ ] Customer list loads
- [ ] "Add Customer" button works
- [ ] Customer cards display:
  - [ ] Name
  - [ ] Phone
  - [ ] Email
  - [ ] Vehicles count
- [ ] Click customer to view details
- [ ] Edit customer functionality
- [ ] Delete customer (with confirmation)
- [ ] Search customers
- [ ] Mobile responsive

#### **Smart Scan** (`/#/scan`)

- [ ] Page loads
- [ ] Camera permission request appears
- [ ] Camera feed displays
- [ ] VIN scanning works (if implemented)
- [ ] License plate scanning works (if implemented)
- [ ] Capture button functions
- [ ] Results display correctly
- [ ] Mobile: Camera orientation correct

#### **Finances** (`/#/finances`)

- [ ] Financial overview loads
- [ ] Revenue charts display
- [ ] Expense tracking works
- [ ] Date range filters work
- [ ] Export reports functionality
- [ ] Mobile responsive

#### **Settings** (`/#/settings`)

- [ ] Settings page loads
- [ ] User profile section:
  - [ ] Name editable
  - [ ] Email display
  - [ ] Role display
  - [ ] Avatar/photo upload (if any)
- [ ] Workshop settings:
  - [ ] Workshop name
  - [ ] Address
  - [ ] Contact info
- [ ] User management (Admin only):
  - [ ] User list displays
  - [ ] Add user functionality
  - [ ] Edit user roles
  - [ ] Delete users
- [ ] Save changes button works
- [ ] Mobile responsive

---

### **3. 🎨 UI/UX Quality**

#### **Design Consistency**

- [ ] AutoPulse branding consistent across all pages
- [ ] Color scheme: Slate-900/950 backgrounds, Cyan-400/500 accents
- [ ] Typography consistent (font sizes, weights)
- [ ] Button styles uniform
- [ ] Card designs consistent
- [ ] Icons from Lucide React display correctly

#### **Responsive Design**

- [ ] Desktop (1920px): Proper layout
- [ ] Tablet (768px): Adapts correctly
- [ ] Mobile (375px): Touch-friendly, no overflow
- [ ] Landscape mobile: Proper padding
- [ ] Bottom navigation on mobile
- [ ] Sidebar on desktop

#### **Animations & Interactions**

- [ ] Loading states show (spinners, skeletons)
- [ ] Hover effects on buttons
- [ ] Active states on navigation
- [ ] Modal animations smooth
- [ ] Transitions between pages
- [ ] No janky animations

#### **Accessibility**

- [ ] Buttons have proper labels
- [ ] Forms have labels
- [ ] Error messages readable
- [ ] Contrast ratios sufficient
- [ ] Touch targets ≥ 44px

---

### **4. 🐛 Known Issues Verification**

Based on previous conversations, verify these fixes:

#### **✅ Profile Sync Error (Fixed)**

- [ ] No "infinite recursion detected in policy for relation 'profiles'" error
- [ ] Login succeeds without sync failures
- [ ] Profile data loads correctly

#### **✅ PWA Home Screen Launch (Fixed)**

- [ ] Add to home screen works
- [ ] Launch from home screen opens app (no 404)
- [ ] Manifest.json paths are relative (`./`)
- [ ] Icons display correctly

#### **✅ Supabase Cleanup (Fixed)**

- [ ] No WebSocket connection limit errors
- [ ] App doesn't hang/spin indefinitely
- [ ] Subscriptions cleaned up properly
- [ ] No memory leaks

#### **✅ Invoice Performance (Fixed)**

- [ ] Invoices load quickly (no lag)
- [ ] Query limits implemented
- [ ] AbortController cancels requests
- [ ] Mobile landscape padding correct

---

### **5. 🔧 Technical Checks**

#### **Browser Console**

- [ ] Open DevTools (F12)
- [ ] Check Console tab for errors
- [ ] No red errors (except extension-related)
- [ ] No unhandled promise rejections
- [ ] No CORS errors

#### **Network Tab**

- [ ] API requests succeed (200 status)
- [ ] Supabase requests authenticated
- [ ] No failed requests (except expected 404s)
- [ ] Reasonable load times

#### **Application Tab**

- [ ] Service Worker registered (if PWA)
- [ ] LocalStorage has `app_version`
- [ ] Session tokens stored correctly
- [ ] Manifest.json loads

#### **Performance**

- [ ] Lighthouse score (run audit):
  - [ ] Performance > 70
  - [ ] Accessibility > 90
  - [ ] Best Practices > 80
  - [ ] SEO > 80
- [ ] Time to Interactive < 3s
- [ ] First Contentful Paint < 1.5s

---

### **6. 📱 PWA Testing**

#### **Installation**

- [ ] "Install App" prompt appears (or manual install)
- [ ] Install to home screen works
- [ ] App icon displays on home screen
- [ ] App name shows as "AutoPulse"

#### **Offline Functionality** (if implemented)

- [ ] App loads offline
- [ ] Cached data accessible
- [ ] Offline indicator shows
- [ ] Sync when back online

#### **Mobile Features**

- [ ] Standalone mode (no browser UI)
- [ ] Status bar color matches theme (#06b6d4)
- [ ] Splash screen shows (if configured)

---

### **7. 🔒 Security Testing**

#### **Authentication**

- [ ] Can't access protected routes without login
- [ ] Session expires appropriately
- [ ] Sign out works completely
- [ ] No sensitive data in localStorage (only tokens)

#### **Authorization**

- [ ] Admin features hidden from Technicians
- [ ] Role-based access control works
- [ ] Can't access other users' data

#### **Data Validation**

- [ ] SQL injection prevented (Supabase handles)
- [ ] XSS attacks prevented
- [ ] Input sanitization works

---

## 🚀 **Testing Workflow**

### **Step 1: Fresh Start**

1. Clear browser cache and cookies
2. Open DevTools Console
3. Navigate to app URL
4. Watch for errors during load

### **Step 2: Authentication Flow**

1. Test registration (create test account)
2. Sign out
3. Test login with created account
4. Test forgot password flow
5. Test Google Sign-In (if configured)

### **Step 3: Main Features**

1. Go through each section systematically
2. Test CRUD operations (Create, Read, Update, Delete)
3. Check mobile responsiveness for each page
4. Verify data persistence (refresh page)

### **Step 4: Edge Cases**

1. Test with no data (empty states)
2. Test with lots of data (performance)
3. Test network failures (disable network)
4. Test rapid clicking (race conditions)
5. Test invalid inputs (form validation)

### **Step 5: Cross-Browser**

1. Chrome/Edge (Chromium)
2. Firefox
3. Safari (if on Mac)
4. Mobile browsers (Chrome Mobile, Safari iOS)

---

## 📊 **Bug Report Template**

If you find issues, document them like this:

```markdown
### Bug: [Short Description]

**Severity:** Critical / High / Medium / Low
**Page:** [URL or route]
**Steps to Reproduce:**

1. Go to...
2. Click on...
3. See error...

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots:**
[Attach if relevant]

**Console Errors:**
[Copy any error messages]

**Environment:**

- Browser: Chrome 120
- OS: macOS Sonoma
- Screen: 1920x1080
```

---

## ✅ **Success Criteria**

Your app is ready for production when:

- [ ] All critical features work
- [ ] No console errors (except extension-related)
- [ ] Mobile responsive on all pages
- [ ] Authentication secure
- [ ] Performance acceptable (< 3s load)
- [ ] PWA installable
- [ ] No known security issues
- [ ] Data persists correctly
- [ ] All previous bugs fixed

---

## 🎉 **Next Steps After Testing**

1. **Fix any bugs found** during testing
2. **Run production build**: `npm run build`
3. **Test production build**: `npm run preview`
4. **Deploy to GitHub Pages**: `npm run deploy`
5. **Monitor production** for errors

---

**Happy Testing! 🚀**

_If you encounter any issues, check the console first, then review the relevant component code._
