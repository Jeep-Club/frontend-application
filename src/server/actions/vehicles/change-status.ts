"use server";

import { z } from "zod";
import { vehicleDetailResponseSchema } from "@/schemas/vehicles/detail";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { ActionError } from "@/utils/http/ActionError";
import { haveActionPermission } from "@/utils/permission/actionPermissions";

export async function changeVehicleStatusAction(id: number, operation: "activate" | "deactivate", scope: "member" | "admin") {
    z.number().int().positive().parse(id);
    z.enum(["activate", "deactivate"]).parse(operation);
    z.enum(["member", "admin"]).parse(scope);
    if (scope === "admin" && !await haveActionPermission("VEHICLES", operation === "activate" ? "VEHICLE_ACTIVATE" : "VEHICLE_DEACTIVATE")) {
        throw new ActionError("Acesso não permitido para alterar a situação do veículo.");
    }
    return (await actionFetchWrapper({
        url: `vehicles/${operation}/${scope}/${id}`,
        method: "PATCH",
        schema: vehicleDetailResponseSchema,
    })).data;
}
