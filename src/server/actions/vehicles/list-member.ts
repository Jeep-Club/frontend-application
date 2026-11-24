'use server';

import { listVehicleMemberResponseSchema } from "@/schemas/vehicles/list";
import { vehicleStatusSchema } from "@/schemas/vehicles/include";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { HttpAPIRoutes } from "@/utils/http/api";

interface Props {
    page?: number;
    size?: number;
    status?: VehicleStatus;
}

export async function listVehiclesMemberAction({ page = 0, size = 10, status }: Props = {}) {
    size = Math.min(Math.max(size, 1), 50);
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status !== undefined) params.set("status", vehicleStatusSchema.parse(status));
    const response = await actionFetchWrapper<ListVehicleMemberResponse>({
        url: `${HttpAPIRoutes.VEHICLES_LIST_MEMBER}?${params}`,
        method: 'GET',
        schema: listVehicleMemberResponseSchema,
    });
    return response.data;
}
