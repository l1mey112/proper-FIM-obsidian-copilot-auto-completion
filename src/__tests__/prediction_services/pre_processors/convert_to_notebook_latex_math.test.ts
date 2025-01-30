import {expect, test} from '@jest/globals';
import { INLINED_MATH_BLOCK_OPENED, isCursorInRegexBlock } from 'src/context_detection';
import { tokenise, tokenise_part } from 'src/prediction_services/pre_processors/convert_to_notebook_latex_math';
import { PrefixAndSuffix } from 'src/prediction_services/types';

test('tokenise part', () => {
	expect(tokenise_part(`Here is an example polynomial: $`)).toEqual([
		"Here is an example polynomial: ", "$"
	]);

	expect(tokenise_part(`$ among us eeaas $$1 + 2$$ 1$\n`)).toEqual([
		"$", " among us eeaas ", "$$", "1 + 2", "$$", " 1", "$", "\n"
	]);
});

const tokenise_tests: [PrefixAndSuffix, PrefixAndSuffix][] = [
	// over a border
	[
		{ prefix: `Here is an example polynomial: $`, suffix: `$ among us eeaas $$1 + 2$$ 1$\n` },
		{ prefix: `Here is an example polynomial: \\(`, suffix: `\\) among us eeaas \\[1 + 2\\] 1$\n` }
	],
	// aborting a math block
	[
		{ prefix: `what $$$$ $a \n`, suffix: `$abc` },
		{ prefix: `what \\[\\] $a \n`, suffix: `$abc` }
	],
	// double math block
	[
		{ prefix: `what $$ a + $ + b $$`, suffix: `c` },
		{ prefix: `what \\[ a + $ + b \\]`, suffix: `c` }
	],
	// multiple dollars
	[
		{ prefix: `what $$$$$a$ `, suffix: `\n` },
		{ prefix: `what \\[\\]\\(a\\) `, suffix: `\n` }
	],
	// autocompleting a math block
	[
		{ prefix: `polynomial example: $`, suffix: `$\n- which the above very much is.` },
		{ prefix: `polynomial example: \\(`, suffix: `\\)\n- which the above very much is.` }
	],
	// autocompleting a math block, with no closing dollar
	[
		{ prefix: `polynomial example: $`, suffix: `\n- which the above very much is.` },
		{ prefix: `polynomial example: \\(`, suffix: `\n- which the above very much is.` }
	],
	// autocompleting a math block, with no closing dollar and no \n
	[
		{ prefix: `polynomiale example: $`, suffix: `` },
		{ prefix: `polynomiale example: \\(`, suffix: `` }
	],
]

test.each(tokenise_tests)('tokenise full', (input, expected) => {
	expect(tokenise(input.prefix, input.suffix)).toEqual(expected);
})

test('context detect maths', () => {
	expect(isCursorInRegexBlock(`$`, '\n', INLINED_MATH_BLOCK_OPENED)).toBe(true);
	expect(isCursorInRegexBlock(`$`, '', INLINED_MATH_BLOCK_OPENED)).toBe(true);
	expect(isCursorInRegexBlock(`$P(x) = `, '\n', INLINED_MATH_BLOCK_OPENED)).toBe(true);
	expect(isCursorInRegexBlock(`$P(x) = `, '', INLINED_MATH_BLOCK_OPENED)).toBe(true);
})
