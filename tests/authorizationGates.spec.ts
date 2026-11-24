import { getAvailableAdminModules } from '@/config/adminModules';
import { medicalPermissions, emergencyMedicalPermissions } from '@/config/medicalPermissions';
import { hasPermission } from '@/utils/permission/hasPermission';
import { mapPermissionToModule, mapMePermissionToModule } from '@/utils/permission/userPermission';
import { haveRoutePermissions } from '@/utils/permission/routePermissions';
import { verifyPermissions } from '@/services/token/permissions';

jest.mock('@/services/token/permissions', () => ({ verifyPermissions: jest.fn() }));

it('maps authorities from Authorization without requiring a role or inferring exports from read', () => {
    const permissions = mapMePermissionToModule(['PUBLICATIONS_EXPORT', 'MEMBERSHIP_BILLING_CONFIGURATION_READ', 'HEALTH_MEDICAL_PROFILE_READ']);
    expect(hasPermission(permissions, 'PUBLICATIONS', 'EXPORT')).toBe(true);
    expect(hasPermission(permissions, 'HEALTH', medicalPermissions.export)).toBe(false);
    expect(getAvailableAdminModules(permissions).map(module => module.key)).toContain('publication-management');
});

it('does not turn a mismatched catalog module into an unrelated grant', () => {
    expect(mapPermissionToModule([{ id: 1, code: 'PUBLICATIONS_EXPORT', module: 'HEALTH', description: 'Export' }])).toEqual([]);
});

it('keeps emergency consultation separate from general medical export and read', () => {
    const permissions = mapMePermissionToModule(['PUBLICATIONS_EVENT_HEALTH_EMERGENCY_READ']);
    expect(hasPermission(permissions, emergencyMedicalPermissions.module, emergencyMedicalPermissions.read)).toBe(true);
    expect(hasPermission(permissions, medicalPermissions.module, medicalPermissions.export)).toBe(false);
    expect(hasPermission(permissions, medicalPermissions.module, medicalPermissions.read)).toBe(false);
});

it('allows HEALTH export-only routes and links without authorizing clinical reads', async () => {
    const permissions = mapMePermissionToModule(['HEALTH_MEDICAL_PROFILE_EXPORT']);
    jest.mocked(verifyPermissions).mockResolvedValue(permissions);
    expect(getAvailableAdminModules(permissions).map(module => module.key)).toContain('medical-profiles');
    expect(await haveRoutePermissions({ pathname: '/admin/dados-medicos', permissionsToken: 'synthetic', onCatch: jest.fn() })).toBe(true);
    expect(hasPermission(permissions, 'HEALTH', 'MEDICAL_PROFILE_READ')).toBe(false);
});

it('denies routes and links to a session without the required authorities', async () => {
    jest.mocked(verifyPermissions).mockResolvedValue([]);
    expect(getAvailableAdminModules([])).toEqual([]);
    expect(await haveRoutePermissions({ pathname: '/admin/dados-medicos', permissionsToken: 'synthetic', onCatch: jest.fn() })).toBe(false);
});
