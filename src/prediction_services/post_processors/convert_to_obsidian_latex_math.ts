import { PostProcessor } from "../types";
import Context from "../../context_detection";

class ConvertObsidianMathIndicators implements PostProcessor {
    process(
        prefix: string,
        suffix: string,
        completion: string,
        context: Context
    ): string {
        if (context !== Context.CodeBlock) {
            if (prefix.endsWith("\\(") && completion.startsWith("\\(")) {
                completion = completion.slice(2);
            }
            
			// trim the whitespace as well, obsidian doesn't consider `$ ... $` as a math block
			completion = completion.replace(/(\\\(\s*)|(\s*\\\))/g, "$");			
			completion = completion.replace(/(\\\[)|(\\\])/g, "$$$$"); // $$ inserts only a $ ???
        }

        return completion;
    }
}

export default ConvertObsidianMathIndicators;
