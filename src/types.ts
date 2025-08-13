export interface AbyatVerse {
	sadr: string; // صدر البيت
	ajaz: string; // عجز البيت
}

export interface AbyatPoem {
	title?: string;
	poet?: string;
	verses: AbyatVerse[];
	layout: "side-by-side" | "stacked";
	size: "small" | "medium" | "large";
	numbered: boolean;
	annotations?: Record<string, string>; // word -> annotation mapping
}

export interface AbyatSettings {
	defaultLayout: "side-by-side" | "stacked";
	defaultSize: "small" | "medium" | "large";
	defaultNumbered: boolean;
	fontFamily?: string;
}
