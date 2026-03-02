import { createClient } from '@supabase/supabase-js';

// Obtenemos las variables de entorno de Astro
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseSecretKey = import.meta.env.SUPABASE_SECRET_KEY;

if (!supabaseSecretKey) {
    throw new Error("Falta SUPABASE_SECRET_KEY en el archivo .env. Esta es la llave 'Secret' de la pestaña 1 en Supabase.");
}

// Creamos un cliente con privilegios de administrador
// Este cliente NUNCA debe usarse en archivos de frontend (islas de Svelte/React)
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});