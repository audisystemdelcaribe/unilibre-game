// src/actions/index.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../lib/supabaseAdmin';

export const server = {
    // Acción para Guardar (Crear o Editar)
    saveFaculty: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            name: z.string().min(3, "El nombre es muy corto"),
            description: z.string().optional(),
        }),
        handler: async (input) => {
            const { id, name, description } = input;

            if (id) {
                // Actualizar
                const { error } = await supabaseAdmin
                    .from('faculties')
                    .update({ name, description })
                    .eq('id', id);
                if (error) throw new Error(error.message);
            } else {
                // Crear
                const { error } = await supabaseAdmin
                    .from('faculties')
                    .insert([{ name, description }]);
                if (error) throw new Error(error.message);
            }
            return { success: true };
        }
    }),

    // Acción para Eliminar
    deleteFaculty: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string(),
        }),
        handler: async ({ id }) => {
            const { error } = await supabaseAdmin
                .from('faculties')
                .delete()
                .eq('id', id);
            if (error) throw new Error(error.message);
            return { success: true };
        }
    })
};