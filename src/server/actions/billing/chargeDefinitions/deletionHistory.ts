"use server";

import { z } from "zod";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { HttpAPIRoutes } from "@/utils/http/api";

const historySchema = z.object({
    originalId: z.number(),
    name: z.string(),
    description: z.string().nullish(),
    defaultAmount: z.number(),
    recurrenceType: z.string(),
    required: z.boolean(),
    paymentAcceptancePolicy: z.string(),
    latePaymentGraceDays: z.number().nullish(),
    previousStatus: z.string(),
    createdAt: z.string(),
    updatedAt: z.string().nullish(),
    archivedAt: z.string().nullish(),
    deletedByUserId: z.number(),
    deletedByUserName: z.string().nullish(),
    deletedAt: z.string(),
    reason: z.string(),
    schemaVersion: z.number(),
});

export async function getChargeDefinitionDeletionHistoryAction(id: number) {
    const originalId = z.number().int().positive().parse(id);
    const response = await actionFetchWrapper({
        url: `${HttpAPIRoutes.BILLING_CHARGE_DEFINITIONS}/${originalId}/deletion-history`,
        method: "GET",
        cache: "no-store",
        schema: historySchema,
    });
    return response.data;
}
