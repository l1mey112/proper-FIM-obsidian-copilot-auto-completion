import {z} from "zod";

export const MIN_DELAY = 0;
export const MAX_DELAY = 2000;
export const MIN_MAX_CHAR_LIMIT = 100;
export const MAX_MAX_CHAR_LIMIT = 10000;
export const MIN_MAX_TOKENS = 128;
export const MAX_MAX_TOKENS = 8192;
export const MIN_TEMPERATURE = 0;
export const MAX_TEMPERATURE = 1;
export const MIN_TOP_P = 0;
export const MAX_TOP_P = 1;
export const MIN_FREQUENCY_PENALTY = 0;
export const MAX_FREQUENCY_PENALTY = 2;
export const MIN_PRESENCE_PENALTY = 0;
export const MAX_PRESENCE_PENALTY = 2;
export const MIN_NUM_CTX = 128;

export const ollamaApiSettingsSchema = z.object({
    host: z.string(),
    model: z.string(),
}).strict();

export const modelOptionsSchema = z.object({
    temperature: z.number()
        .min(0, {message: `Temperature must be at least ${MIN_TEMPERATURE}`})
        .max(1, {message: `Temperature must be at most ${MAX_TEMPERATURE}`}),
    top_p: z.number()
        .min(0, {message: `top_p must be greater than ${MIN_TOP_P}`})
        .max(1, {message: `top_p must be at most ${MAX_TOP_P}`}),
    frequency_penalty: z.number()
        .min(0, {message: `Frequency penalty must be at least ${MIN_FREQUENCY_PENALTY}`})
        .max(2, {message: `Frequency penalty must be at most ${MAX_FREQUENCY_PENALTY}`}),
    presence_penalty: z.number().min(MIN_PRESENCE_PENALTY, {message: `Presence penalty must be at least ${MIN_PRESENCE_PENALTY}`}).max(MAX_PRESENCE_PENALTY, {message: `Presence penalty must be at most ${MAX_PRESENCE_PENALTY}`}),
    max_tokens: z.number().int()
        .min(MIN_MAX_TOKENS, {message: `max_tokens must be at least than ${MIN_MAX_TOKENS}`}).max(MAX_MAX_TOKENS, {message: `max_tokens must be at most ${MAX_MAX_TOKENS}`}),
    num_ctx: z.number().int()
        .min(128),
}).strict();
