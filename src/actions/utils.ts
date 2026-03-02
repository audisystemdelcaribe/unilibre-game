// src/actions/utils.ts
export async function ensureAdmin(context: any) {

    const user = await context.locals.getUser();
    if (!user) throw new Error("Debes iniciar sesión");

    const { data: profile } = await context.locals.supabase
        .from('players')
        .select('role')
        .eq('auth_user_id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        throw new Error("No tienes permisos de administrador para esta acción");
    }
}