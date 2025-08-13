/**
 * Type definitions for the Abyat (Arabic Poetry) plugin
 *
 * Arabic Poetry Terminology:
 * - بيت (Bayt): A single verse of poetry
 * - صدر (Sadr): The first half of a verse (literally "chest")
 * - عجز (Ajaz): The second half of a verse (literally "rear")
 * - قصيدة (Qasida): A poem composed of multiple verses
 * - شاعر (Sha'ir): Poet
 * - أبيات (Abyat): Plural of "bayt", meaning verses
 */

/**
 * Represents a single verse (بيت) of Arabic poetry
 * Each verse consists of two parts: sadr and ajaz
 */
export interface AbyatVerse {
	/** صدر البيت - First half of the verse */
	sadr: string;

	/** عجز البيت - Second half of the verse */
	ajaz: string;
}

/**
 * Represents a complete Arabic poem (قصيدة) with all its metadata
 */
export interface AbyatPoem {
	/** عنوان القصيدة - Optional poem title */
	title?: string;

	/** اسم الشاعر - Optional poet name */
	poet?: string;

	/** Array of verses that make up the poem */
	verses: AbyatVerse[];

	/**
	 * Layout style for displaying verses:
	 * - "side-by-side": sadr and ajaz displayed horizontally
	 * - "stacked": sadr and ajaz displayed vertically with indentation
	 */
	layout: "side-by-side" | "stacked";

	/**
	 * Display size of the poem:
	 * - "small": Compact size, good for inline display
	 * - "medium": Standard size
	 * - "large": Expanded size for emphasis
	 */
	size: "small" | "medium" | "large";

	/** Whether to show verse numbers */
	numbered: boolean;

	/**
	 * Word annotations mapping
	 * Key: Arabic word, Value: Explanation/translation
	 * Used to provide tooltips for difficult or archaic words
	 */
	annotations?: Record<string, string>;
}

/**
 * Plugin settings for default behavior
 * These can be extended later for user customization
 */
export interface AbyatSettings {
	/** Default layout style for new poems */
	defaultLayout: "side-by-side" | "stacked";

	/** Default size for new poems */
	defaultSize: "small" | "medium" | "large";

	/** Default numbering preference */
	defaultNumbered: boolean;

	/** Optional custom font family for Arabic text */
	fontFamily?: string;
}
