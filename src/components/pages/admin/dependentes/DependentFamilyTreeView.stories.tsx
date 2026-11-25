import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DependentFamilyTreeView } from "./DependentFamilyTreeView";

const meta = {
    title: "Páginas/Admin/Dependentes/Árvore familiar",
    component: DependentFamilyTreeView,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {

                component: "Agrupa pais acima do titular, cônjuge e irmãos na mesma geração, e filhos abaixo. O cadastro não liga dependentes entre si nem diferencia pai de mãe.",

            },
        },
    },
} satisfies Meta<typeof DependentFamilyTreeView>;

export default meta;
type Story = StoryObj<typeof meta>;

const relatives: AdminDependentItem[] = [

    { id: 10, userId: 7, ownerName: "Caique Silva", name: "Helena Silva", cpf: "00000000000", birthDate: "1960-02-12", relationshipType: "PARENT", phoneNumber: null, status: "ACTIVE", createdAt: "2026-01-10T12:00:00Z", updatedAt: null },
    { id: 15, userId: 7, ownerName: "Caique Silva", name: "Roberto Silva", cpf: "00000000000", birthDate: "1958-07-20", relationshipType: "PARENT", phoneNumber: null, status: "ACTIVE", createdAt: "2026-01-10T12:00:00Z", updatedAt: null },
    { id: 11, userId: 7, ownerName: "Caique Silva", name: "Luana Silva", cpf: "00000000000", birthDate: "1990-04-12", relationshipType: "SPOUSE", phoneNumber: null, status: "ACTIVE", createdAt: "2026-01-10T12:00:00Z", updatedAt: null },
    { id: 12, userId: 7, ownerName: "Caique Silva", name: "Gabriel Silva", cpf: "00000000000", birthDate: "2010-08-02", relationshipType: "CHILD", phoneNumber: null, status: "ACTIVE", createdAt: "2026-01-10T12:00:00Z", updatedAt: null },
    { id: 13, userId: 7, ownerName: "Caique Silva", name: "Ana Silva", cpf: "00000000000", birthDate: "2013-05-19", relationshipType: "CHILD", phoneNumber: null, status: "ACTIVE", createdAt: "2026-01-10T12:00:00Z", updatedAt: null },
    { id: 14, userId: 7, ownerName: "Caique Silva", name: "Marcelo Silva", cpf: "00000000000", birthDate: "1986-09-16", relationshipType: "SIBLING", phoneNumber: null, status: "ACTIVE", createdAt: "2026-01-10T12:00:00Z", updatedAt: null },

];

export const FamiliaDoTitular = {
    args: {
        ownerName: "Caique Silva",
        ownerId: 7,
        relatives,
        selectedDependentId: 12,
        onOpenDependent: fn(),
    },
} satisfies Story;

export const FamiliaPequena = {
    args: {
        ownerName: "Caique Silva",
        ownerId: 7,

        relatives: [relatives[3]],

        selectedDependentId: 12,
        onOpenDependent: fn(),
    },
} satisfies Story;
