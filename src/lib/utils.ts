import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Shuffle determinístico por semilla: mismo seed → mismo orden (participante y público ven igual) */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
	const a = [...arr];
	let s = seed;
	for (let i = a.length - 1; i > 0; i--) {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		const j = s % (i + 1);
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/** Clase badge DaisyUI según modo de juego (1=Preselección, 2=Clásico, 3=Mente más Rápida) */
export function getGameModeBadgeClass(modeId: number | null | undefined): string {
	const base = "badge badge-sm font-bold text-[9px] uppercase";
	const variant = {
		1: "badge-primary",
		2: "badge-secondary",
		3: "badge-success",
	}[modeId ?? 0] ?? "badge-accent";
	return `${base} ${variant}`;
}

/** Clases para icono/fondo según modo de juego */
export function getGameModeColorClass(modeId: number | null | undefined): string {
	const map: Record<number, string> = {
		1: "bg-primary/10 text-primary",
		2: "bg-secondary/10 text-secondary",
		3: "bg-success/10 text-success",
	};
	return map[modeId ?? 0] ?? "bg-accent/10 text-accent";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
