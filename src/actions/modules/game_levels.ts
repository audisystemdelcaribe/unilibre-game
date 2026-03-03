// src/actions/modules/game_levels.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ensureAdmin } from '../utils';

export const gameLevelsActions = {
    saveLevel: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            name: z.string().min(1, "El nombre es obligatorio"),
            difficulty_order: z.string(),
            money_value: z.string(),
            points: z.string().default("100"),
            time_limit: z.string().default("30"),
            is_safe_level: z.string().optional(), // Viene "on" si está marcado
            description: z.string().optional(),
        }),
        handler: async (input, context) => {
            await ensureAdmin(context); // SEGURIDAD

            const { id, name, difficulty_order, money_value, points, time_limit, is_safe_level, description } = input;

            const data = {
                name,
                difficulty_order: parseInt(difficulty_order),
                money_value: parseFloat(money_value),
                points: parseInt(points),
                time_limit: parseInt(time_limit),
                is_safe_level: is_safe_level === 'on', // Convertir checkbox a boolean
                description
            };

            if (id && id.trim() !== "") {
                const { error } = await supabaseAdmin.from('game_levels').update(data).eq('id', parseInt(id));
                if (error) throw new Error(error.message);
                return { success: true, message: "Nivel actualizado correctamente" };
            } else {
                const { error } = await supabaseAdmin.from('game_levels').insert([data]);
                if (error) throw new Error(error.message);
                return { success: true, message: "Nuevo nivel creado exitosamente" };
            }
        }
    }),

    deleteLevel: defineAction({
        accept: 'form',
        input: z.object({ id: z.string() }),
        handler: async ({ id }, context) => {
            await ensureAdmin(context);
            const { error } = await supabaseAdmin.from('game_levels').delete().eq('id', parseInt(id));
            if (error) throw new Error(error.message);
            return { success: true, message: "Nivel eliminado" };
        }
    })
};