"use server";

import { z } from "zod";

import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { ActionError } from "@/utils/http/ActionError";
import { HttpAPIRoutes } from "@/utils/http/api";
import { getDownloadFilename } from "@/utils/http/contentDisposition";
import { haveActionPermission } from "@/utils/permission/actionPermissions";

const MAX_EXPORT_FILTER_IDS = 200;

const idListFilter = z
    .array(z.coerce.number().int().positive("Informe apenas IDs positivos válidos.").refine(Number.isSafeInteger, "O ID informado é muito grande."))
    .optional()
    .default([])
    .transform((ids) => [...new Set(ids)])
    .refine((ids) => ids.length <= MAX_EXPORT_FILTER_IDS, `Selecione no máximo ${MAX_EXPORT_FILTER_IDS} itens por filtro.`);

const vehicleExportFiltersSchema = z.object({
    vehicleIds: idListFilter,
    ownerIds: idListFilter,
    towing: z.enum(["ALL", "YES", "NO"]).optional().default("ALL"),
});

export type VehicleExportFiltersInput = z.input<typeof vehicleExportFiltersSchema>;

/** Exports active vehicles in CSV or PDF directly from the backend operational export endpoint. */
export async function exportAdminVehiclesAction(format: "CSV" | "PDF", input: VehicleExportFiltersInput = {}) {
    if (!(await haveActionPermission("VEHICLES", "VEHICLE_EXPORT"))) {
        throw new ActionError("Acesso não permitido para exportar veículos.");
    }

    z.enum(["CSV", "PDF"]).parse(format);
    const filters = vehicleExportFiltersSchema.parse(input);

    const params = new URLSearchParams({ format });
    for (const vehicleId of filters.vehicleIds) {
        params.append("vehicleIds", String(vehicleId));
    }
    for (const ownerId of filters.ownerIds) {
        params.append("ownerIds", String(ownerId));
    }
    if (filters.towing === "YES") {
        params.set("towing", "true");
    } else if (filters.towing === "NO") {
        params.set("towing", "false");
    }

    const contentType = format === "CSV" ? "text/csv" : "application/pdf";
    const response = await actionFetchWrapper({
        url: `${HttpAPIRoutes.VEHICLES_EXPORT_ADMIN}?${params.toString()}`,
        method: "GET",
        schema: z.instanceof(Blob),
        responseType: "blob",
        allowedContentTypes: [contentType],
        cache: "no-store",
    });

    const blob = response.data;
    return {
        base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
        contentType: blob.type || contentType,
        filename: getDownloadFilename(response.contentDisposition, `veiculos.${format.toLowerCase()}`),
    };
}
