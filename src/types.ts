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
 * Represents a single annotation for a word or phrase
 */
export interface AbyatAnnotation {
	/** The annotated text (word or phrase) */
	text: string;

	/** The annotation/explanation */
	annotation: string;

	/** Verse index where this annotation appears */
	verseIndex: number;

	/** Part of verse: 'sadr' or 'ajaz' */
	part: "sadr" | "ajaz";

	/** Starting position in the text */
	startPos: number;

	/** Ending position in the text */
	endPos: number;

	/** Unique identifier for the annotation */
	id: string;
}

/**
 * Represents a complete Arabic poem (قصيدة) with all its metadata
 */
export interface AbyatPoem {
	/** عنوان القصيدة - Optional poem title */
	title?: string;

	/** اسم الشاعر - Optional poet name */
	poet?: string;

	/** علامات التصنيف - Optional tags for categorizing poems */
	tags?: string[];

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
	 * Array of annotations for words and phrases
	 * New structure to support phrase annotations
	 */
	annotations?: AbyatAnnotation[];
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

	/** Default tags for new poems */
	defaultTags: string[];

	/** Optional custom font family for Arabic text */
	fontFamily?: string;
}
