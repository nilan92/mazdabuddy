import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startUsageTracking, stopUsageTracking, trackPageView } from '../lib/usage';

// Records screen opens for workshop staff. Super-admin sessions (including when
// viewing a workshop) are left out so the owner's own browsing doesn't skew the numbers.
export const UsageTracker = () => {
    const location = useLocation();
    const { profile, user, isSuperAdmin } = useAuth();
    const tenantId = profile?.tenant_id;
    const userId = user?.id ?? profile?.id;
    const enabled = Boolean(tenantId && userId && !isSuperAdmin);

    useEffect(() => {
        if (enabled) startUsageTracking(tenantId, userId);
        else stopUsageTracking();
    }, [enabled, tenantId, userId]);

    useEffect(() => () => stopUsageTracking(), []);

    useEffect(() => {
        if (enabled) trackPageView(location.pathname);
    }, [enabled, location.pathname]);

    return null;
};
