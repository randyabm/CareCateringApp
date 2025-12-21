import type { Database } from '@/types/database.types';

type UserRole = Database['public']['Tables']['profiles']['Row']['role'];
type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Mock authentication helper for testing
 * Returns mock user and profile data when TEST_MODE is enabled
 */
export function getMockUser() {
    const testMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';
    
    if (!testMode) {
        return null;
    }

    // Check localStorage for role override (for in-app role switching)
    let role: UserRole;
    if (typeof window !== 'undefined') {
        const storedRole = localStorage.getItem('test_mode_role');
        role = (storedRole || process.env.NEXT_PUBLIC_TEST_USER_ROLE || 'nurse') as UserRole;
    } else {
        role = (process.env.NEXT_PUBLIC_TEST_USER_ROLE || 'nurse') as UserRole;
    }

    const locationId = process.env.NEXT_PUBLIC_TEST_USER_LOCATION_ID 
        ? parseInt(process.env.NEXT_PUBLIC_TEST_USER_LOCATION_ID, 10) 
        : null;
    const userId = process.env.NEXT_PUBLIC_TEST_USER_ID || '00000000-0000-0000-0000-000000000001';
    const userName = process.env.NEXT_PUBLIC_TEST_USER_NAME || 'Test User';

    return {
        user: {
            id: userId,
            email: `test-${role}@example.com`,
            user_metadata: {
                role,
                name: userName,
            },
        },
        profile: {
            id: userId,
            full_name: userName,
            role,
            assigned_location_id: locationId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } as Profile,
    };
}

/**
 * Check if test mode is enabled
 */
export function isTestMode(): boolean {
    return process.env.NEXT_PUBLIC_TEST_MODE === 'true';
}

/**
 * Get test mode configuration for display
 */
export function getTestModeInfo() {
    if (!isTestMode()) {
        return null;
    }

    // Check localStorage for role override
    let role: string;
    if (typeof window !== 'undefined') {
        const storedRole = localStorage.getItem('test_mode_role');
        role = storedRole || process.env.NEXT_PUBLIC_TEST_USER_ROLE || 'nurse';
    } else {
        role = process.env.NEXT_PUBLIC_TEST_USER_ROLE || 'nurse';
    }

    return {
        enabled: true,
        role,
        locationId: process.env.NEXT_PUBLIC_TEST_USER_LOCATION_ID || 'not set',
        userName: process.env.NEXT_PUBLIC_TEST_USER_NAME || 'Test User',
    };
}

/**
 * Set test mode role (for in-app role switching)
 */
export function setTestModeRole(role: UserRole) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('test_mode_role', role);
    }
}

/**
 * Get available roles for test mode
 */
export function getAvailableRoles(): UserRole[] {
    return ['nurse', 'kitchen_staff', 'store_man', 'kitchen_runner', 'admin'];
}

