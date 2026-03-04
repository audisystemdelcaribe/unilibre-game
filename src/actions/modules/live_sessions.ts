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
    }),
    startGame: defineAction({
        accept: 'form',
        input: z.object({ round_id: z.string() }),
        handler: async ({ round_id }, context) => {
            await ensureStaff(context);

            // 1. Cambiamos el estado a 'active'
            // 2. Opcional: Aquí podrías elegir la primera pregunta aleatoria
            const { error } = await supabaseAdmin
                .from('event_rounds')
                .update({ status: 'active', round_number: 1 })
                .eq('id', parseInt(round_id));

            if (error) throw new Error(error.message);
            return { success: true };
        }
    }),
    joinRoom: defineAction({
        accept: 'form',
        input: z.object({
            pin: z.string().min(4).max(6),
        }),
        handler: async ({ pin }, context) => {
            // 1. Obtener usuario de la sesión del servidor (Cookies)
            const user = await context.locals.getUser();
            if (!user) throw new Error("Debes iniciar sesión");

            // 2. Buscar el salón activo por PIN
            const { data: round, error: rError } = await supabaseAdmin
                .from('event_rounds')
                .select('*')
                .eq('session_pin', pin)
                .in('status', ['waiting', 'active'])
                .maybeSingle();

            if (rError || !round) throw new Error("PIN incorrecto o salón cerrado");

            // 3. Obtener el ID del jugador
            const { data: player } = await supabaseAdmin
                .from('players')
                .select('id')
                .eq('auth_user_id', user.id)
                .single();

            if (!player) throw new Error("No se encontró perfil de jugador");

            // 4. Registrar al estudiante (Upsert)
            const { error: joinError } = await supabaseAdmin
                .from('event_players')
                .upsert({
                    event_id: round.event_id,
                    player_id: player.id,
                    classroom_group_id: round.classroom_group_id,
                    stage: 'lobby'
                }, { onConflict: 'event_id, player_id' });

            if (joinError) throw new Error("Error al registrarse en el salón");

            // Devolvemos el ID de la ronda para que el cliente redirija
            return { success: true, round_id: round.id };
        }
    })
};