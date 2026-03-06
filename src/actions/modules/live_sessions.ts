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
            const { data: round } = await supabaseAdmin
                .from('event_rounds')
                .select('*')
                .eq('session_pin', pin)
                .single();

            if (!round) throw new Error("PIN no válido");

            // 2. Buscar ID del jugador
            const { data: player } = await supabaseAdmin
                .from('players')
                .select('id')
                .eq('auth_user_id', user!.id)
                .single();

            // 3. UPSERT DE SESIÓN (Ahora funcionará gracias al SQL de arriba)
            const { data: session, error: sErr } = await supabaseAdmin
                .from('game_sessions')
                .upsert({
                    player_id: player!.id,
                    event_id: round.event_id,
                    round_id: round.id,
                    session_type: 'classroom',
                    finished: false // Vital para que coincida con el constraint
                }, { onConflict: 'player_id, event_id, finished' })
                .select()
                .single();

            if (sErr) throw new Error("Error al crear sesión: " + sErr.message);

            // 4. REGISTRAR EN EL EVENTO (Asegurando el grupo)
            await supabaseAdmin
                .from('event_players')
                .upsert({
                    event_id: round.event_id,
                    player_id: player!.id,
                    classroom_group_id: round.classroom_group_id,
                    stage: 'lobby'
                }, { onConflict: 'event_id, player_id' });

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
            if (!user) throw new Error("No user");
            const now = new Date().getTime();
            const { round_id, question_id, answer_id, session_id } = input;

            console.log("--- PROCESANDO RESPUESTA ---");
            console.log("Input recibido:", input);

            try {
                // 1. Obtener datos
                const [roundRes, questionRes, answerRes, playerRes] = await Promise.all([
                    supabaseAdmin.from('event_rounds').select('*').eq('id', parseInt(round_id)).single(),
                    supabaseAdmin.from('questions').select('*, game_levels(points, time_limit)').eq('id', parseInt(question_id)).single(),
                    supabaseAdmin.from('answers').select('is_correct').eq('id', parseInt(answer_id)).single(),
                    supabaseAdmin.from('players').select('id').eq('auth_user_id', user.id).single()
                ]);

                if (!roundRes.data?.question_started_at) throw new Error("Pregunta no iniciada");

                // 2. Tiempos y Puntos
                const startTime = new Date(roundRes.data.question_started_at).getTime();
                const responseMs = now - startTime;
                const isCorrect = answerRes.data?.is_correct || false;
                const basePoints = (questionRes.data?.game_levels as any)?.points || 1000;
                const durationMs = ((questionRes.data?.game_levels as any)?.time_limit || 30) * 1000;

                let earnedPoints = 0;
                if (isCorrect) {
                    const ratio = Math.max(0, (durationMs - responseMs) / durationMs);
                    earnedPoints = Math.round(basePoints * (0.1 + (ratio * 0.9)));
                }

                console.log(`Es correcto: ${isCorrect} | Puntos: ${earnedPoints} | Tiempo: ${responseMs}ms`);

                // 3. Insertar en game_answers
                const { error: insErr } = await supabaseAdmin.from('game_answers').insert([{
                    game_session_id: parseInt(session_id),
                    round_id: parseInt(round_id),
                    event_id: roundRes.data.event_id,
                    player_id: playerRes.data!.id,
                    classroom_group_id: roundRes.data.classroom_group_id,
                    question_id: parseInt(question_id),
                    answer_id: parseInt(answer_id),
                    level_id: questionRes.data!.level_id,
                    is_correct: isCorrect,
                    response_time_ms: responseMs,
                    money_at_question: earnedPoints
                }]);

                if (insErr) {
                    console.error("Error al insertar en DB:", insErr);
                    throw new Error(insErr.message);
                }

                // 4. Sumar puntos
                if (earnedPoints > 0) {
                    await supabaseAdmin.rpc('increment_session_score', { s_id: parseInt(session_id), puntos: earnedPoints });

                    // Actualizar event_players
                    const { data: currentEP } = await supabaseAdmin.from('event_players')
                        .select('score').eq('event_id', roundRes.data.event_id).eq('player_id', playerRes.data!.id).single();

                    await supabaseAdmin.from('event_players').update({ score: (currentEP?.score || 0) + earnedPoints })
                        .eq('event_id', roundRes.data.event_id).eq('player_id', playerRes.data!.id);
                }

                console.log("✅ TODO OK: Respuesta guardada");
                return { success: true, correct: isCorrect, points: earnedPoints, time: (responseMs / 1000).toFixed(2) };

            } catch (e: any) {
                console.error("❌ ERROR EN ACCION:", e.message);
                throw new Error(e.message);
            }
        }
    }),
    launchRandomQuestion: defineAction({
        accept: 'form',
        input: z.object({ round_id: z.string() }),
        handler: async ({ round_id }, context) => {
            await ensureStaff(context);

            // 1. Obtener datos de la ronda y del evento
            const { data: round } = await supabaseAdmin
                .from('event_rounds')
                .select('*, events(program_id)')
                .eq('id', parseInt(round_id))
                .single();

            const programId = round.events?.program_id;
            console.log("DEBUG: Buscando preguntas para Programa ID:", programId);

            // 2. Obtener preguntas ya usadas en ESTA RONDA
            const { data: used } = await supabaseAdmin
                .from('game_answers')
                .select('question_id')
                .eq('round_id', round.id);

            const usedIds = used?.map(a => a.question_id) || [];
            console.log("DEBUG: Preguntas usadas en esta ronda:", usedIds);

            // 3. Buscar preguntas disponibles: Nivel 1 + (Mismo Programa O Global)
            let query = supabaseAdmin
                .from('questions')
                .select('id')
                .eq('level_id', 1)
                .eq('active', true);

            // Filtro inteligente: que sean del programa DEL EVENTO o de cultura general (global)
            if (programId) {
                query = query.or(`program_id.eq.${programId},scope.eq.global`);
            } else {
                query = query.eq('scope', 'global');
            }

            // Excluir las que ya se respondieron en esta ronda
            if (usedIds.length > 0) {
                query = query.not('id', 'in', `(${usedIds.join(',')})`);
            }

            const { data: available } = await query;
            console.log("DEBUG: Preguntas encontradas que cumplen requisitos:", available?.length);

            if (!available || available.length === 0) {
                throw new Error(`No hay preguntas de Nivel 1 disponibles para este programa.`);
            }

            // 4. Elegir una al azar
            const randomQ = available[Math.floor(Math.random() * available.length)];

            await supabaseAdmin.from('event_rounds').update({
                current_question_id: randomQ.id,
                question_started_at: new Date().toISOString(),
                status: 'active'
            }).eq('id', round.id);

            return { success: true };
        }
    }),
    finishRound: defineAction({
        accept: 'form',
        input: z.object({ round_id: z.string() }),
        handler: async ({ round_id }, context) => {
            await ensureStaff(context);

            const { error } = await supabaseAdmin
                .from('event_rounds')
                .update({ status: 'finished' })
                .eq('id', parseInt(round_id));

            if (error) throw new Error(error.message);
            return { success: true, message: "Juego finalizado" };
        }
    })
};