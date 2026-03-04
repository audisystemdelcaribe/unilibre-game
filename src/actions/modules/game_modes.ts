import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ensureAdmin } from '../utils';

export const gameModesActions = {
    saveGameMode: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            name: z.string().min(2, "El nombre es obligatorio"),
            description: z.string().optional(),
        }),
        handler: async (input, context) => {
            await ensureAdmin(context); // SEGURIDAD

            const { id, name, description } = input;
            const data = { name, description };

            if (id && id.trim() !== "") {
                const { error } = await supabaseAdmin
                    .from('game_modes')
                    .update(data)
                    .eq('id', parseInt(id));
                if (error) throw new Error(error.message);
                return { success: true, message: "Modo de juego actualizado" };
            } else {
                const { error } = await supabaseAdmin
                    .from('game_modes')
                    .insert([data]);
                if (error) throw new Error(error.message);
                return { success: true, message: "Nuevo modo de juego creado" };
            }
        }
    }),

    deleteGameMode: defineAction({
        accept: 'form',
        input: z.object({ id: z.string() }),
        handler: async ({ id }, context) => {
            await ensureAdmin(context);
            const { error } = await supabaseAdmin
                .from('game_modes')
                .delete()
                .eq('id', parseInt(id));
            if (error) throw new Error(error.message);
            return { success: true, message: "Modo de juego eliminado" };
        }
    })
};