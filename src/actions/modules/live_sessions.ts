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
        input: z.object({ pin: z.string() }),
        handler: async ({ pin }, context) => {
            const user = await context.locals.getUser();

            // 1. Buscar la ronda por PIN
            const { data: round } = await supabaseAdmin.from('event_rounds').select('*').eq('session_pin', pin).single();

            // 2. Buscar ID del jugador
            const { data: player } = await supabaseAdmin.from('players').select('id').eq('auth_user_id', user!.id).single();

            // 3. CREAR O BUSCAR SESIÓN (Para evitar duplicados)
            const { data: session, error: sErr } = await supabaseAdmin
                .from('game_sessions')
                .upsert({
                    player_id: player!.id,
                    event_id: round.event_id,
                    round_id: round.id,
                    session_type: 'classroom',
                    finished: false
                }, { onConflict: 'player_id, event_id, finished' }) // Necesitas un índice único para esto
                .select()
                .single();

            if (sErr) console.error("Error sesión:", sErr);

            return { success: true, round_id: round.id };
        }
    }),
    nextQuestion: defineAction({
        accept: 'form',
        input: z.object({
            round_id: z.string(),
            question_id: z.string()
        }),
        handler: async ({ round_id, question_id }, context) => {
            await ensureStaff(context);
            const { error } = await supabaseAdmin
                .from('event_rounds')
                .update({
                    current_question_id: parseInt(question_id),
                    question_started_at: new Date().toISOString(),
                    status: 'active'
                })
                .eq('id', parseInt(round_id));

            if (error) throw new Error(error.message);
            return { success: true, message: "¡Pregunta lanzada a los estudiantes!" };
        }
    }),
    // src/actions/modules/live_sessions.ts

    submitAnswer: defineAction({
        accept: 'form',
        input: z.object({
            round_id: z.string(),
            question_id: z.string(),
            answer_id: z.string(),
            session_id: z.string(),
        }),
        handler: async (input, context) => {
            const user = await context.locals.getUser();
            if (!user) throw new Error("Sesión expirada");

            const now = new Date().getTime();
            const { round_id, question_id, answer_id, session_id } = input;

            try {
                // 1. Obtener datos necesarios
                const [roundRes, questionRes, answerRes, playerRes] = await Promise.all([
                    supabaseAdmin.from('event_rounds').select('*').eq('id', parseInt(round_id)).single(),
                    supabaseAdmin.from('questions').select('*, game_levels(points, time_limit)').eq('id', parseInt(question_id)).single(),
                    supabaseAdmin.from('answers').select('is_correct').eq('id', parseInt(answer_id)).single(),
                    supabaseAdmin.from('players').select('id').eq('auth_user_id', user.id).single()
                ]);

                // Verificación de integridad de datos
                if (!roundRes.data || !questionRes.data || !answerRes.data || !playerRes.data) {
                    throw new Error("No se pudo recuperar la información del juego. Verifica que las IDs existen.");
                }

                const round = roundRes.data;
                const question = questionRes.data;
                const answer = answerRes.data;
                const player = playerRes.data;

                if (!round.question_started_at) {
                    throw new Error("El cronómetro de la pregunta no ha iniciado.");
                }

                // 2. Cálculo de Tiempo y Puntos
                const startTime = new Date(round.question_started_at).getTime();
                const responseMs = now - startTime;
                // Usamos el tiempo límite de la pregunta o 30s por defecto
                const limitSeconds = (question.game_levels as any)?.time_limit || round.duration_seconds || 30;
                const durationMs = limitSeconds * 1000;

                let earnedPoints = 0;
                if (answer.is_correct) {
                    const basePoints = (question.game_levels as any)?.points || 1000;
                    // Multiplicador basado en tiempo (Ratio de 1.0 a 0.1)
                    const ratio = Math.max(0, (durationMs - responseMs) / durationMs);
                    earnedPoints = Math.round(basePoints * (0.1 + (ratio * 0.9)));
                }

                // 3. Guardar en historial (game_answers)
                const { error: insError } = await supabaseAdmin.from('game_answers').insert([{
                    game_session_id: parseInt(session_id),
                    event_id: round.event_id,
                    player_id: player.id,
                    question_id: parseInt(question_id),
                    answer_id: parseInt(answer_id),
                    is_correct: answer.is_correct,
                    response_time_ms: responseMs,
                    money_at_question: earnedPoints
                }]);

                if (insError) throw new Error("Error DB Answers: " + insError.message);

                // 4. Actualizar puntajes
                if (earnedPoints > 0) {
                    // Actualizar sesión
                    await supabaseAdmin.rpc('increment_session_score', {
                        s_id: parseInt(session_id),
                        puntos: earnedPoints
                    });

                    // Actualizar ranking del evento (Suma directa)
                    const { data: currentP } = await supabaseAdmin
                        .from('event_players')
                        .select('score')
                        .eq('event_id', round.event_id)
                        .eq('player_id', player.id)
                        .single();

                    await supabaseAdmin
                        .from('event_players')
                        .update({ score: (currentP?.score || 0) + earnedPoints })
                        .eq('event_id', round.event_id)
                        .eq('player_id', player.id);
                }

                return {
                    success: true,
                    correct: answer.is_correct,
                    points: earnedPoints,
                    time: (responseMs / 1000).toFixed(2)
                };

            } catch (err: any) {
                console.error("❌ ERROR CRÍTICO EN SUBMIT_ANSWER:", err.message);
                throw new Error(err.message);
            }
        }
    })
};