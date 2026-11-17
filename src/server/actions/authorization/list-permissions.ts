'use server';

import { permissionListResponseSchema } from "@/schemas/authorization/permission";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { HttpAPIRoutes } from "@/utils/http/api";
import { haveActionPermission } from "@/utils/permission/actionPermissions";
import { ActionError } from "@/utils/http/ActionError";

export async function listPermissionsAction(): Promise<PermissionResponse[]> {
    if (!await haveActionPermission('AUTHORIZATION', 'PERMISSION_READ')) throw new ActionError('Você não tem permissão para consultar o catálogo.', { status: 403 });
    const response = await actionFetchWrapper<PermissionResponse[]>({
        url: HttpAPIRoutes.PERMISSIONS,
        method: 'GET',
        schema: permissionListResponseSchema,
    });

    return response.data;
}
