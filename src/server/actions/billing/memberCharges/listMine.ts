"use server";

import { memberChargeSummaryResponseSchema } from "@/schemas/billing/memberCharge";
import { pageResponseSchema } from "@/schemas/page";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { HttpAPIRoutes } from "@/utils/http/api";

export async function listMyMemberChargesAction(
    searchParams: MemberChargeSearchParams = {},
): Promise<PageResponse<MemberChargeSummary>> {
    const query = new URLSearchParams(
        Object.entries(searchParams).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
    );

    const response = await actionFetchWrapper({
        url: `${HttpAPIRoutes.BILLING_MY_MEMBER_CHARGES}?${query.toString()}`,
        method: "GET",
        schema: pageResponseSchema(memberChargeSummaryResponseSchema),
    });

    return response.data;
}

export async function countMyOpenMemberChargesAction(): Promise<number> {
    // The API filters by persisted status, which also includes expired charges.
    const filters = { status: "PENDING", size: "50" } as const;
    let count = 0;
    let totalPages = 1;
    for (let page = 0; page < totalPages; page++) {
        const result = await listMyMemberChargesAction({ ...filters, page: String(page) });
        if (page === 0) totalPages = result.totalPages;
        count += result.content.filter(charge => charge.effectiveStatus === "PENDING" || charge.effectiveStatus === "OVERDUE").length;
    }
    return count;
}
