import { z } from "zod";

export const MIN_VEHICLE_SEATS = 1;
export const MAX_VEHICLE_SEATS = 40;

const rangeMessage = `Informe um número inteiro de ${MIN_VEHICLE_SEATS} a ${MAX_VEHICLE_SEATS} assentos.`;

export const vehicleSeatingCapacitySchema = z.string().trim()
    .min(1, { message: "O número de assentos é obrigatório." })
    .regex(/^\d+$/, { message: rangeMessage })
    .transform(Number)
    .pipe(z.number().int().min(MIN_VEHICLE_SEATS, { message: rangeMessage }).max(MAX_VEHICLE_SEATS, { message: rangeMessage }));
