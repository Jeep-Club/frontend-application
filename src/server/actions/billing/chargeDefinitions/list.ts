'use server';

import { z } from "zod";
import { chargeDefinitionStatusSchema, chargeDefinitionSummaryResponseSchema } from "@/schemas/billing/chargeDefinition";
import { pageResponseSchema } from "@/schemas/page";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { HttpAPIRoutes } from "@/utils/http/api";

async function fetchChargeDefinitionsPage(searchParams: Omit<ChargeDefinitionSearchParams, "status">) {
    const query = new URLSearchParams(
        Object.entries(searchParams).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
    );

    const response = await actionFetchWrapper({
        url: `${HttpAPIRoutes.BILLING_CHARGE_DEFINITIONS}?${query.toString()}`,
        method: "GET",
        schema: pageResponseSchema(chargeDefinitionSummaryResponseSchema),
    });

    return response.data;
}

export async function listChargeDefinitionsAction({ status, ...searchParams }: ChargeDefinitionSearchParams): Promise<PageResponse<ChargeDefinitionSummary>> {
    if (status === undefined) return fetchChargeDefinitionsPage(searchParams);

    const selectedStatus = chargeDefinitionStatusSchema.parse(status);
    const number = z.coerce.number().int().nonnegative().parse(searchParams.page ?? "0");
    const size = z.coerce.number().int().min(1).max(50).parse(searchParams.size ?? "20");
    // The backend only accepts Pageable. Filter all results before slicing the requested page.
    const filters = { ...searchParams, size: "50" };
    const firstPage = await fetchChargeDefinitionsPage({ ...filters, page: "0" });
    const matches = firstPage.content.filter(definition => definition.status === selectedStatus);
    for (let page = 1; page < firstPage.totalPages; page++) {
        const result = await fetchChargeDefinitionsPage({ ...filters, page: String(page) });
        matches.push(...result.content.filter(definition => definition.status === selectedStatus));
    }
    const content = matches.slice(number * size, (number + 1) * size);
    const totalPages = Math.ceil(matches.length / size);
    return { content, number, size, totalPages, totalElements: matches.length, numberOfElements: content.length, first: number === 0, last: number + 1 >= totalPages, empty: content.length === 0 };
}
