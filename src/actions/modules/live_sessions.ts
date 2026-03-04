// src/actions/modules/live_sessions.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ensureStaff } from '../utils';

export const liveSessionsActions = {
    openClassroomSession: defineAction({
        accept: 'form',
        input: z.object({
            event_id: z.string(),
            classroom_group_id: z.string().min(2, "El nombre del grupo es obligatorio"),
        }),
        handler: async (input, context) => {
            await ensureStaff(context);

            const { event_id, classroom_group_id } = input;

            // 1. Generar un PIN aleatorio de 4 o 6 números
            // Verificamos que no exista uno igual activo (opcional pero recomendado)
            const session_pin = Math.floor(1000 + Math.random() * 9000).toString();

            // 2. Crear la fila en event_rounds que actuará como "Sala de espera"
            const { data: round, error } = await supabaseAdmin
                .from('event_rounds')
                .insert([{
                    event_id: parseInt(event_id),
                    round_number: 0, // Ronda 0 significa "Lobby / Sala de espera"
                    type: 'classroom_quiz',
                    status: 'waiting',
                    classroom_group_id: classroom_group_id,
                    session_pin: session_pin
                }])
                .select()
                .single();

            if (error) throw new Error(error.message);

            return {
                success: true,
                message: "¡Salón abierto con éxito!",
                pin: session_pin,
                round_id: round.id
            };
        }
    })
};