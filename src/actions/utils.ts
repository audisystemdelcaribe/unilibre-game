/**
 * GUARDÍAN 1: Solo permite el paso a Administradores.
 * Úsalo para: Borrar facultades, cambiar niveles de dinero, etc.
 */
export async function ensureAdmin(context: any) {
    const user = await context.locals.getUser();
    if (!user) throw new Error("Debes iniciar sesión");

    const { data: profile } = await context.locals.supabase
        .from('players')
        .select('role')
        .eq('auth_user_id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        throw new Error("Acceso denegado: Se requieren permisos de Administrador");
    }
    return user;
}

/**
 * GUARDÍAN 2: Permite el paso a Administradores Y Docentes.
 * Úsalo para: Crear eventos de salón, gestionar preguntas, etc.
 */
export async function ensureStaff(context: any) {
    const user = await context.locals.getUser();
    if (!user) throw new Error("Debes iniciar sesión");

    const { data: profile } = await context.locals.supabase
        .from('players')
        .select('role')
        .eq('auth_user_id', user.id)
        .single();

    // Aquí permitimos admin, docente y preseleccion
    if (profile?.role !== 'admin' && profile?.role !== 'docente' && profile?.role !== 'preseleccion') {
        throw new Error("Acceso denegado: Solo personal docente o administrativo");
    }

    return user;
}

/**
 * Devuelve true si el rol solo tiene acceso a Preselección (no Mente más Rápida ni Clásico).
 */
export function isPreseleccionOnly(role: string | undefined): boolean {
    return role === 'preseleccion';
}

/**
 * GUARDÍAN 3: Solo admin y docente (NO preseleccion). Para Mente más Rápida, Clásico, etc.
 */
export async function ensureStaffFull(context: any) {
    const user = await context.locals.getUser();
    if (!user) throw new Error("Debes iniciar sesión");

    const { data: profile } = await context.locals.supabase
        .from('players')
        .select('role')
        .eq('auth_user_id', user.id)
        .single();

    if (profile?.role !== 'admin' && profile?.role !== 'docente') {
        throw new Error("Acceso denegado: Esta acción requiere rol docente o administrador completo");
    }

    return user;
}