import {
    ModelOptions,
    PostProcessor,
    PredictionService,
    PreProcessor,
} from "../types";

import Context from "../../context_detection";
import RemoveCodeIndicators from "../post_processors/remove_code_indicators";
import RemoveMathIndicators from "../post_processors/remove_math_indicators";
import DataViewRemover from "../pre_processors/data_view_remover";
import LengthLimiter from "../pre_processors/length_limiter";
import RemoveOverlap from "../post_processors/remove_overlap";
import {Settings} from "../../settings/versions";
import RemoveWhitespace from "../post_processors/remove_whitespace";
import {err, ok, Result} from "neverthrow";
import { GenerateRequest, Ollama } from "ollama";
import ConvertObsidianMathIndicators from "../post_processors/convert_to_obsidian_latex_math";
import ConvertNotebookMathIndicators from "../pre_processors/convert_to_notebook_latex_math";

class FIM implements PredictionService {
    private readonly ollama: Ollama;

    private readonly systemMessage: string;
    private readonly preProcessors: PreProcessor[];
    private readonly postProcessors: PostProcessor[];
    private debugMode: boolean;

    private model: string;
    private modelOptions: ModelOptions;

    private constructor(
        ollama: Ollama,
        model: string,
        modelOptions: ModelOptions,
        systemMessage: string,
        preProcessors: PreProcessor[],
        postProcessors: PostProcessor[],
        debugMode: boolean,
    ) {
        this.ollama = ollama;
        this.model = model;
        this.modelOptions = modelOptions;
        this.systemMessage = systemMessage;
        this.preProcessors = preProcessors;
        this.postProcessors = postProcessors;
        this.debugMode = debugMode;
    }

    public static fromSettings(settings: Settings): PredictionService {
        const preProcessors: PreProcessor[] = [];
        if (settings.dontIncludeDataviews) {
            preProcessors.push(new DataViewRemover());
        }
        preProcessors.push(
            // length limiter should be last
            new ConvertNotebookMathIndicators(),
            new LengthLimiter(
                settings.maxPrefixCharLimit,
                settings.maxSuffixCharLimit
            ),
        );

        const postProcessors: PostProcessor[] = [];
        if (settings.removeDuplicateMathBlockIndicator) {
            postProcessors.push(new RemoveMathIndicators());
        }
        if (settings.removeDuplicateCodeBlockIndicator) {
            postProcessors.push(new RemoveCodeIndicators());
        }
        postProcessors.push(new ConvertObsidianMathIndicators());

        postProcessors.push(new RemoveOverlap());
        postProcessors.push(new RemoveWhitespace());

        let client: Ollama;
        if (settings.apiProvider === "ollama") {
            client = new Ollama({
                host: settings.ollamaApiSettings.host,
            })
        } else {
            throw new Error("Invalid API provider");
        }

        return new FIM(
            client,
            settings.ollamaApiSettings.model,
            settings.modelOptions,
            settings.systemMessage,
            preProcessors,
            postProcessors,
            settings.debugMode,
        );
    }

    async fetchPredictions(
        prefix: string,
        suffix: string
    ): Promise<{ promise: Promise<Result<string | null, Error>>, abort: () => void }> {
        const context: Context = Context.getContext(prefix, suffix);

        for (const preProcessor of this.preProcessors) {
            if (preProcessor.removesCursor(prefix, suffix)) {
                // empty string is returned to prevent the prediction
                return { promise: Promise.resolve(ok(null)), abort: () => {} }
            }

            ({prefix, suffix} = preProcessor.process(
                prefix,
                suffix,
                context
            ));
        }

        const system = this.getSystemMessageFor(context)

        const requestObject: GenerateRequest = {
            model: this.model,
            system: system,
            prompt: prefix,
            suffix: suffix,
            options: {
                temperature: this.modelOptions.temperature,
                top_p: this.modelOptions.top_p,
                frequency_penalty: this.modelOptions.frequency_penalty,
                presence_penalty: this.modelOptions.presence_penalty,
                num_predict: this.modelOptions.max_tokens,
                num_ctx: this.modelOptions.num_ctx,
            },
        }
        
        const stream = await this.ollama.generate({
            ...requestObject,
            stream: true
        })

        const streamer = async (): Promise<Result<string | null, Error>> => {
            let result = ''

            try {
                for await (const data of stream) {
                    if (data.done) {
                        if (this.debugMode) {
                            console.log("Copilot final data:", data);
                            console.log("Copilot final response:", result);
                        }

                        // postprocessing
                        for (const postProcessor of this.postProcessors) {
                            result = postProcessor.process(prefix, suffix, result, context);
                        }
                        return ok(result)
                    }
    
                    result += data.response
                }
            } catch (e) {
                if (e instanceof Error && e.name === 'AbortError') {
                    if (this.debugMode) {
                        console.log("Copilot aborted");
                    }

                    return ok(null)
                }

                return err(e)
            }

            return err(new Error("Unexpected end of stream"))
        }

        if (this.debugMode) {
            console.log("Copilot messages send:\n", requestObject);
        }

        // create abortable promise
        return { promise: streamer(), abort: () => {
            stream.abort()
        } }
    }

    private getSystemMessageFor(context: Context): string {
        if (context === Context.Text) {
            return this.systemMessage + "\n\n" + "The text is located in a paragraph. Your answer must complete this paragraph or sentence in a way that fits the surrounding text without overlapping with it. It must be in the same language as the paragraph.";
        }
        if (context === Context.Heading) {
            return this.systemMessage + "\n\n" + "The text is located in the Markdown heading. Your answer must complete this title in a way that fits the content of this paragraph and be in the same language as the paragraph.";
        }

        if (context === Context.BlockQuotes) {
            return this.systemMessage + "\n\n" + "The text is located within a quote. Your answer must complete this quote in a way that fits the context of the paragraph.";
        }
        if (context === Context.UnorderedList) {
            return this.systemMessage + "\n\n" + "The text is located in an unordered list. Your answer must include one or more list items that fit with the surrounding list without overlapping with it.";
        }

        if (context === Context.NumberedList) {
            return this.systemMessage + "\n\n" + "The text is located in a numbered list. Your answer must include one or more list items that fit the sequence and context of the surrounding list without overlapping with it.";
        }

        if (context === Context.CodeBlock) {
            return this.systemMessage + "\n\n" + "The text is located in a code block. Your answer must complete this code block in the same programming language and support the surrounding code and text outside of the code block.";
        }
        if (context === Context.MathBlock) {
            return this.systemMessage + "\n\n" + "The text is located in a math block. Your answer must only contain LaTeX code that captures the math discussed in the surrounding text. No text or explaination only LaTex math code.";
        }
        if (context === Context.MathBlockOpen) {
            return this.systemMessage + "\n\n" + "The text is located in an opened math block. Your answer must only contain LaTeX code that captures the math discussed in the surrounding text. No text or explaination only LaTex math code, then close the block.";
        }
        if (context === Context.TaskList) {
            return this.systemMessage + "\n\n" + "The text is located in a task list. Your answer must include one or more (sub)tasks that are logical given the other tasks and the surrounding text.";
        }

        return this.systemMessage;

    }
}

export default FIM;
