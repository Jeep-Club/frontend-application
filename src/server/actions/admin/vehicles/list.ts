'use server';

import { listVehicleMemberResponseSchema } from "@/schemas/vehicles/list";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { HttpAPIRoutes } from "@/utils/http/api";

interface Props {
    page?: number;
    size?: number;
    q?: string;
}

export async function listVehiclesAdminAction({ page = 0, size = 10, q }: Props = {}) {
    size = Math.min(Math.max(size, 1), 50);
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    const search = q?.trim().slice(0, 150);
    if (search) params.set("q", search);

    const response = await actionFetchWrapper<ListVehicleMemberResponse>({
        url: `${HttpAPIRoutes.VEHICLES_LIST_ADMIN}?${params}`,
        method: 'GET',
        schema: listVehicleMemberResponseSchema,
    });
    return response.data;
}
