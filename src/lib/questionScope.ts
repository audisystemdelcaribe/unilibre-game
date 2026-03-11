import type { PostgrestFilterBuilder } from '@supabase/supabase-js';

export type EventScope = { scope?: string; program_id?: number | null; faculty_id?: number | null };

/**
 * Aplica filtro de programa/facultad/global a la consulta de preguntas.
 * Siempre incluye preguntas con scope='global'.
 */
export function applyScopeFilter<T>(
    query: PostgrestFilterBuilder<T>,
    evt: EventScope | null | undefined
): PostgrestFilterBuilder<T> {
    const ev = Array.isArray(evt) ? evt[0] : evt;
    if (!ev) return query.eq('scope', 'global');
    const scope = ev.scope || 'global';
    // Estricto: (scope=program AND program_id=X) OR scope=global — evita preguntas de otros programas
    if (scope === 'program' && ev.program_id != null) {
        return query.or(`and(scope.eq.program,program_id.eq.${ev.program_id}),scope.eq.global`);
    }
    // (scope=faculty AND faculty_id=Y) OR scope=global
    if (scope === 'faculty' && ev.faculty_id != null) {
        return query.or(`and(scope.eq.faculty,faculty_id.eq.${ev.faculty_id}),scope.eq.global`);
    }
    return query.eq('scope', 'global');
}
