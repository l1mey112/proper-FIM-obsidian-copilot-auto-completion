import State from "./state";
import { DocumentChanges } from "../render_plugin/document_changes_listener";
import EventListener from "../event_listener";
import { Notice } from "obsidian";
import Context from "../context_detection";
import { PredictionResponse, PredictionCancelable } from "src/prediction_services/types";

class PredictingState extends State {
    private prediction: Promise<PredictionCancelable> | null = null;
    private readonly prefix: string;
    private readonly suffix: string;

    constructor(context: EventListener, prefix: string, suffix: string) {
        super(context);
        this.prefix = prefix;
        this.suffix = suffix;
    }

    static createAndStartPredicting(
        context: EventListener,
        prefix: string,
        suffix: string
    ): PredictingState {
        const predictingState = new PredictingState(context, prefix, suffix);
        predictingState.startPredicting();
        context.setContext(Context.getContext(prefix, suffix));
        return predictingState;
    }

    handleCancelKeyPressed(): boolean {
        this.cancelPrediction();
        return true;
    }

    async handleDocumentChange(
        documentChanges: DocumentChanges
    ): Promise<void> {
        if (
            documentChanges.hasCursorMoved() ||
            documentChanges.hasUserTyped() ||
            documentChanges.hasUserDeleted() ||
            documentChanges.isTextAdded()
        ) {
            this.cancelPrediction();
        }
    }

    private cancelPrediction(): void {
        if (this.prediction) {
            this.prediction.then(prediction => {
                // can be null if the prediction was aborted
                try {
                    if (prediction && prediction.abort) {
                        prediction.abort()
                    }
                } catch (e) {
                    // ignore
                }
            })
        }
        this.context.transitionToIdleState();
    }

    startPredicting(): void {
        if (this.prediction) {
            this.cancelPrediction()
        }
        this.prediction = this.context.predictionService?.fetchPredictions(
            this.prefix,
            this.suffix
        )

        this.prediction.then(prediction => this.predict(prediction.promise))
    }

    private async predict(response: Promise<PredictionResponse>): Promise<void> {

        const result = await response

        if (result.isErr()) {
            new Notice(
                `Copilot: Something went wrong cannot make a prediction. Full error is available in the dev console. Please check your settings. `
            );
            console.error(result.error);
            this.context.transitionToIdleState();
        }

        const prediction = result.unwrapOr("");

        // prediction was aborted or empty
        if (prediction === null || prediction === "") {
            this.context.transitionToIdleState();
            return;
        }
        this.context.transitionToSuggestingState(prediction, this.prefix, this.suffix);
    }

    getStatusBarText(): string {
        return `Predicting for ${this.context.context}`;
    }
}

export default PredictingState;
