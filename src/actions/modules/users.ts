import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const usersActions = {
    updateUserRole: defineAction({
        accept: 'form',
        input: z.object({
            player_id: z.string(),
            role: z.enum(['admin', 'docente', 'player']),
        }),
        handler: async ({ player_id, role }) => {
            const { error } = await supabaseAdmin
                .from('players')
                .update({ role })
                .eq('id', parseInt(player_id));

            if (error) throw new Error(error.message);
            return { success: true };
        }
    })
};