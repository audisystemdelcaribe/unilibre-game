// src/actions/modules/auth.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';

export const authActions = {
    registerPlayer: defineAction({
        accept: 'form',
        input: z.object({
            email: z.string().email().refine(e => e.endsWith('@unilibre.edu.co'), {
                message: "Debe ser un correo institucional (@unilibre.edu.co)"
            }),
            password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
            full_name: z.string().min(3, "Nombre muy corto").max(200, "Nombre muy largo"),
            program_id: z.string().min(1, "Selecciona un programa"),
            semester: z.string().refine(s => {
                const n = parseInt(s, 10);
                return !isNaN(n) && n >= 1 && n <= 12;
            }, { message: "El semestre debe estar entre 1 y 12" }),
        }),
        handler: async (input, context) => {
            const { email, password, full_name, program_id, semester } = input;

            const progId = parseInt(program_id, 10);
            const sem = parseInt(semester, 10);
            if (isNaN(progId) || isNaN(sem)) {
                throw new Error("Datos de programa o semestre inválidos");
            }

            const { data: programExists } = await context.locals.supabase
                .from("programs")
                .select("id")
                .eq("id", progId)
                .single();
            if (!programExists) {
                throw new Error("El programa seleccionado no existe");
            }

            // Intentar registro en Supabase Auth
            const { data, error } = await context.locals.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: full_name,
                        program_id: progId,
                        semester: sem,
                        role: 'player' // Por defecto son estudiantes
                    }
                }
            });

            if (error) throw new Error(error.message);

            return {
                success: true,
                message: "¡Registro exitoso! Ya puedes iniciar sesión."
            };
        }
    })
};