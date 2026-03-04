// src/actions/modules/fastest_finger.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ensureAdmin } from '../utils';

export const fastestFingerActions = {
    saveSequence: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            title: z.string().min(5, "Título muy corto"),
            // Recibimos la lista de ítems como un string JSON
            items_json: z.string().min(2, "Debes agregar al menos dos elementos"),
        }),
        handler: async (input, context) => {
            await ensureAdmin(context);

            const { id, title, items_json } = input;
            const itemsRaw = JSON.parse(items_json); // Formato esperado: string[]

            let seqId: number;

            // 1. Guardar/Actualizar Cabecera
            if (id && id.trim() !== "") {
                seqId = parseInt(id);
                await supabaseAdmin.from('fastest_finger_sequences').update({ title }).eq('id', seqId);
            } else {
                const { data, error } = await supabaseAdmin.from('fastest_finger_sequences').insert([{ title }]).select().single();
                if (error) throw new Error(error.message);
                seqId = data.id;
            }

            // 2. Guardar Items (Limpiar y Re-insertar)
            await supabaseAdmin.from('fastest_finger_items').delete().eq('sequence_id', seqId);

            const itemsToInsert = itemsRaw.map((text: string, index: number) => ({
                sequence_id: seqId,
                text: text,
                correct_position: index + 1 // La posición es el orden en el array
            }));

            const { error: itemsError } = await supabaseAdmin.from('fastest_finger_items').insert(itemsToInsert);
            if (itemsError) throw new Error(itemsError.message);

            return { success: true, message: "Secuencia dinámica guardada" };
        }
    }),
    deleteSequence: defineAction({
        accept: 'form',
        input: z.object({ id: z.string() }),
        handler: async ({ id }, context) => {
            await ensureAdmin(context);
            const { error } = await supabaseAdmin.from('fastest_finger_sequences').delete().eq('id', parseInt(id));
            if (error) throw new Error(error.message);
            return { success: true, message: "Secuencia eliminada" };
        }
    })
};