/**
 * Rate limiter en memoria para login (solo cuenta intentos fallidos).
 * Nota: En Vercel serverless, el estado no persiste entre instancias.
 * Para producción a gran escala, considera Vercel KV o Redis.
 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function getClientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0].trim();
	return request.headers.get("x-real-ip") ?? "unknown";
}

export function checkLoginRateLimit(request: Request): { allowed: boolean; retryAfter?: number } {
	const ip = getClientIp(request);
	const now = Date.now();
	const entry = loginAttempts.get(ip);

	if (!entry) return { allowed: true };

	if (now > entry.resetAt) return { allowed: true };

	if (entry.count >= MAX_ATTEMPTS) {
		return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
	}
	return { allowed: true };
}

export function recordLoginFailure(request: Request): void {
	const ip = getClientIp(request);
	const now = Date.now();
	const entry = loginAttempts.get(ip);

	if (!entry) {
		loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return;
	}

	if (now > entry.resetAt) {
		loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return;
	}

	entry.count++;
}
