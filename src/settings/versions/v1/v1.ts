import {
    MAX_DELAY,
    MAX_MAX_CHAR_LIMIT,
    MIN_DELAY,
    MIN_MAX_CHAR_LIMIT,
    ollamaApiSettingsSchema,
} from "../shared";
import {z} from "zod";
import {modelOptionsSchema} from "../shared";
import {isRegexValid, isValidIgnorePattern} from "../../utils";

export const triggerSchema = z.object({
    type: z.enum(['string', 'regex']),
    value: z.string().min(1, {message: "Trigger value must be at least 1 character long"})
}).strict().superRefine((trigger, ctx) => {
    if (trigger.type === "regex") {
        if (!trigger.value.endsWith("$")) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Regex triggers must end with a $.",
                path: ["value"],
            });
        }
        if (!isRegexValid(trigger.value)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Invalid regex: "${trigger.value}"`,
                path: ["value"],
            });
        }
    }
});


export const settingsSchema = z.object({
    version: z.literal("1"),
    enabled: z.boolean(),
    advancedMode: z.boolean(),
    apiProvider: z.enum(['ollama']),
    ollamaApiSettings: ollamaApiSettingsSchema,
    triggers: z.array(triggerSchema),
    delay: z.number().int().min(MIN_DELAY, {message: "Delay must be between 0ms and 2000ms"}).max(MAX_DELAY, {message: "Delay must be between 0ms and 2000ms"}),
    modelOptions: modelOptionsSchema,
    systemMessage: z.string().min(3, {message: "System message must be at least 3 characters long"}),
    dontIncludeDataviews: z.boolean(),
    maxPrefixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, {message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}`}).max(MAX_MAX_CHAR_LIMIT, {message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}`}),
    maxSuffixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, {message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}`}).max(MAX_MAX_CHAR_LIMIT, {message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}`}),
    removeDuplicateMathBlockIndicator: z.boolean(),
    removeDuplicateCodeBlockIndicator: z.boolean(),
    ignoredFilePatterns: z.string().refine((value) => value
        .split("\n")
        .filter(s => s.trim().length > 0)
        .filter(s => !isValidIgnorePattern(s)).length === 0,
        {message: "Invalid ignore pattern"}
    ),
    ignoredTags: z.string().refine((value) => value
        .split("\n")
        .filter(s => s.includes(" ")).length === 0, {message: "Tags cannot contain spaces"}
    ).refine((value) => value
        .split("\n")
        .filter(s => s.includes("#")).length === 0, {message: "Enter tags without the # symbol"}
    ).refine((value) => value
        .split("\n")
        .filter(s => s.includes(",")).length === 0, {message: "Enter each tag on a new line without commas"}
    ),
    cacheSuggestions: z.boolean(),
    debugMode: z.boolean(),
}).strict();

export const pluginDataSchema = z.object({
    settings: settingsSchema,
}).strict();


export const DEFAULT_SETTINGS: Settings = {
    version: "1",

    // General settings
    enabled: true,
    advancedMode: false,
    apiProvider: "ollama",

    ollamaApiSettings: {
        host: "localhost:11434",
        model: "",
    },

    // Trigger settings
    triggers: [
        {type: "string", value: "# "},
        {type: "string", value: ". "},
        {type: "string", value: ": "},
        {type: "string", value: ", "},
        {type: "string", value: "! "},
        {type: "string", value: "? "},
        {type: "string", value: "`"},
        {type: "string", value: "' "},
        {type: "string", value: "= "},
        {type: "string", value: "$ "},
        {type: "string", value: "> "},
        {type: "string", value: "\n"},

        // bullet list
        {type: "regex", value: "[\\t ]*(\\-|\\*)[\\t ]+$"},
        // numbered list
        {type: "regex", value: "[\\t ]*[0-9A-Za-z]+\\.[\\t ]+$"},
        // new line with spaces
        {type: "regex", value: "\\$\\$\\n[\\t ]*$"},
        // markdown multiline code block
        {type: "regex", value: "```[a-zA-Z0-9]*(\\n\\s*)?$"},
        // task list normal, sub or numbered.
        {type: "regex", value: "\\s*(-|[0-9]+\\.) \\[.\\]\\s+$"},
    ],

    delay: 500,
    // Request settings
    modelOptions: {
        temperature: 1,
        top_p: 0.1,
        frequency_penalty: 0.25,
        presence_penalty: 0,
        max_tokens: 800,
        num_ctx: 1024,
    },
    // Prompt settings
    /* systemMessage: `Your job is to predict the most logical text that should be written at the location of the <mask/>.
Your answer can be either code, a single word, or multiple sentences.
If the <mask/> is in the middle of a partial sentence, your answer should only be the 1 or 2 words fixes the sentence and not the entire sentence.
You are not allowed to have any overlapping text directly surrounding the <mask/>.  
Your answer must be in the same language as the text directly surrounding the <mask/>.
Your response must have the following format:
THOUGHT: here, you reason about the answer; use the 80/20 principle to be brief.
LANGUAGE: here, you write the language of your answer, e.g. English, Python, Dutch, etc.
ANSWER: here, you write the text that should be at the location of <mask/>
`, */
systemMessage: `Your job is to complete text inside a markdown file.
Your text can be code, LaTex math surrounded by $ and $$ characters, a single word, or multiple sentences. Your answer must be in the same language as the text.`,
    // Preprocessing settings
    dontIncludeDataviews: true,
    maxPrefixCharLimit: 4000,
    maxSuffixCharLimit: 4000,
    // Postprocessing settings
    removeDuplicateMathBlockIndicator: true,
    removeDuplicateCodeBlockIndicator: true,
    ignoredFilePatterns: "**/secret/**\n",
    ignoredTags: "",
    cacheSuggestions: true,
    debugMode: false,
};

export type Settings = z.input<typeof settingsSchema>;
export type Trigger = z.infer<typeof triggerSchema>;
export type PluginData = z.infer<typeof pluginDataSchema>;
