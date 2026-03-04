import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ensureAdmin } from '../utils';

export const lifelinesActions = {
    saveLifeline: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            name: z.string().min(2, "El nombre es obligatorio"),
            description: z.string().optional(),
        }),
        handler: async (input, context) => {
            await ensureAdmin(context);

            const { id, name, description } = input;
            const data = { name, description };

            if (id && id.trim() !== "") {
                const { error } = await supabaseAdmin.from('lifelines').update(data).eq('id', parseInt(id));
                if (error) throw new Error(error.message);
                return { success: true, message: "Comodín actualizado correctamente" };
            } else {
                const { error } = await supabaseAdmin.from('lifelines').insert([data]);
                if (error) throw new Error(error.message);
                return { success: true, message: "Nuevo comodín creado" };
            }
        }
    }),

    deleteLifeline: defineAction({
        accept: 'form',
        input: z.object({ id: z.string() }),
        handler: async ({ id }, context) => {
            await ensureAdmin(context);
            const { error } = await supabaseAdmin.from('lifelines').delete().eq('id', parseInt(id));
            if (error) throw new Error(error.message);
            return { success: true, message: "Comodín eliminado" };
        }
    })
};