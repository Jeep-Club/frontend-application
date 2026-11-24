'use server';

import { listToolsResponseSchema, toolStatusSchema } from "@/schemas/tools/list";
import { getToolDetailAction } from '@/server/actions/tools/detail';
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { HttpAPIRoutes } from "@/utils/http/api";

interface Props {
    page?: number;
    size?: number;
    status?: ToolStatus;
}

async function fetchToolsPage(page: number, size: number) {
    return (await actionFetchWrapper<ListToolsResponse>({
        url: `${HttpAPIRoutes.TOOLS}?page=${page}&size=${size}`,
        method: 'GET',
        schema: listToolsResponseSchema,
    })).data;
}

export async function listToolsAction({ page = 0, size = 10, status }: Props = {}) {
    size = Math.min(Math.max(size, 1), 50);
    let data: ListToolsResponse;
    if (status === undefined) {
        data = await fetchToolsPage(page, size);
    } else {
        const selectedStatus = toolStatusSchema.parse(status);
        // The member endpoint has no status parameter. Filter across its pages before slicing the result.
        const firstPage = await fetchToolsPage(0, 50);
        const matches = firstPage.content.filter(tool => tool.status === selectedStatus);
        for (let index = 1; index < firstPage.totalPages; index++) {
            const nextPage = await fetchToolsPage(index, 50);
            matches.push(...nextPage.content.filter(tool => tool.status === selectedStatus));
        }
        const content = matches.slice(page * size, (page + 1) * size);
        const totalPages = Math.ceil(matches.length / size);
        data = { content, totalElements: matches.length, totalPages, number: page, size, first: page === 0, last: page >= totalPages - 1, numberOfElements: content.length, empty: content.length === 0 };
    }
    // Older deployments omit photoStorageKey in summaries even though
    // tool details already expose it. Limit concurrent compatibility reads.
    const content = [...data.content];
    const missing = content.map((tool, index) => ({ tool, index }))
        .filter(({ tool }) => tool.photoStorageKey === undefined);
    for (let start = 0;start < missing.length;start += 5) {
        const batch = missing.slice(start, start + 5);
        const details = await Promise.allSettled(batch.map(({ tool }) => getToolDetailAction(tool.id)));
        details.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const target = batch[index];
                content[target.index] = { ...target.tool, photoStorageKey: result.value.photoStorageKey ?? null };
            }
        });
    }
    return { ...data, content };
}
