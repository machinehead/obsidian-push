/**
 * Generated by orval v7.8.0 🍺
 * Do not edit manually.
 * FastAPI
 * OpenAPI spec version: 0.1.0
 */
import type {
	HTTPValidationError,
	ObsidianUpdates,
	WebhookObsidian200,
} from "./api.schemas";

import { customFetch } from "../custom-fetch";

/**
 * @summary Webhook Obsidian
 */
export type webhookObsidianResponse200 = {
	data: WebhookObsidian200;
	status: 200;
};

export type webhookObsidianResponse422 = {
	data: HTTPValidationError;
	status: 422;
};

export type webhookObsidianResponseComposite =
	| webhookObsidianResponse200
	| webhookObsidianResponse422;

export type webhookObsidianResponse = webhookObsidianResponseComposite & {
	headers: Headers;
};

export const getWebhookObsidianUrl = () => {
	return `https://api2.lifedash.link/webhook/obsidian`;
};

export const webhookObsidian = async (
	obsidianUpdates: ObsidianUpdates,
	options?: RequestInit,
): Promise<webhookObsidianResponse> => {
	return customFetch<webhookObsidianResponse>(getWebhookObsidianUrl(), {
		...options,
		method: "POST",
		headers: { "Content-Type": "application/json", ...options?.headers },
		body: JSON.stringify(obsidianUpdates),
	});
};
