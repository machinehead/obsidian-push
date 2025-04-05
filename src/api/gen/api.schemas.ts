/**
 * Generated by orval v7.8.0 🍺
 * Do not edit manually.
 * FastAPI
 * OpenAPI spec version: 0.1.0
 */
export interface HTTPValidationError {
	detail?: ValidationError[];
}

export interface ObsCreate {
	event?: "create";
	doc: ObsidianDocumentCreate;
}

export interface ObsidianDocumentCreate {
	path: string;
	vault: string;
	content: string;
	created_at?: string;
	updated_at?: string;
}

export interface ObsidianUpdates {
	token: string;
	events: ObsCreate[];
}

export type ValidationErrorLocItem = string | number;

export interface ValidationError {
	loc: ValidationErrorLocItem[];
	msg: string;
	type: string;
}

export type WebhookObsidian200 = { [key: string]: string };
