import Context from "src/context_detection";
import { PrefixAndSuffix, PreProcessor } from "../types";

export function tokenise_part(part: string) {
	const tokens: (`$$` | `$` | `\n` | string)[] = []

	let i = 0
	for (const match of part.matchAll(/(?:\$\$)|(?:\$)|(?:\n)/g)) {		
		match.index = match.index as number
		
		const new_idx = match.index + match[0].length
		
		// slice != ''
		if (i !== match.index) {
			tokens.push(part.slice(i, match.index))
		}
		i = new_idx

		switch (match[0]) {
			case '$$':
			case '$':
			case '\n':
				tokens.push(match[0])
				break
			default:
				throw new Error('unreachable')
		}
	}

	if (i < part.length) {
		tokens.push(part.slice(i))
	}

	return tokens
}

export function tokenise(prefix: string, suffix: string): PrefixAndSuffix {
	// compose the combined string into tokens, then reassemble them
	// null is the divider between the prefix and suffix
	const tokens: (`$$` | `$` | null | `\n` | `` | string)[] = [
		...tokenise_part(prefix),
		null,
		...tokenise_part(suffix),
		``, // end of the line
	]

	// construct the new prefix and suffix
	let new_prefix = ''
	let new_suffix = ''

	let inside_suffix = false
	let i = 0
	let mi = 0
	let st: `normal` | `$` | `$$` = `normal`

	function commit_single(token: string) {
		if (inside_suffix) {
			new_suffix += token
		} else {
			new_prefix += token
		}
	}

	function contains_cursor(begin: number, end: number) {
		for (let i = begin; i < end; i++) {
			if (tokens[i] === null) {
				return true
			}
		}
		return false
	}

	function commit(token_prefix: string, begin: number, end: number, token_suffix: string) {
		const items = [token_prefix, ...tokens.slice(begin, end), token_suffix]

		for (const item of items) {
			if (item === null) {
				inside_suffix = true
				continue
			}
			commit_single(item)
		}
	}

	for (i = 0; i < tokens.length; i++) {
		const token = tokens[i]

		switch (st) {
			case 'normal': {
				// classify the token

				switch (token) {
				case '$':
					// commit everything before this
					commit('', mi, i, '')

					st = '$'
					mi = i // remember where we are, this could be aborted

					break
				case '$$':
					// commit everything before this
					commit('', mi, i, '')

					st = '$$'
					mi = i // remember where we are, this could be aborted
					break
				}
				break
			}

			case '$': {
				switch (token) {
				case '$':
					// we have a math block
					commit('\\(', mi + 1, i, '\\)')

					st = 'normal'
					mi = i + 1
					break
				case '':
				case '\n':
					// it makes more sense to treat this as a half open math block
					// only if the cursor is in the suffix
					// obsidian doesn't auto close the $ sign
					if (contains_cursor(mi + 1, i)) {
						commit('\\(', mi + 1, i, token)
						mi = i + 1
					} else {
						// abort the math block $ now, commit everything here by just moving on
					}
					st = 'normal'
					break
				case '$$':
					// $a$$b$ is allowed, parsed as $a$,$b$ in obsidian
					commit('\\(', mi + 1, i, '\\)')
					st = '$' // stay in single math mode
					mi = i + 1
					break
				}
				break
			}

			case '$$': {
				switch (token) {
				case '$$':
					// we have a math block
					commit('\\[', mi + 1, i, '\\]')

					st = 'normal'
					mi = i + 1
					break
				}
				break
			}
		}
	}
	// commit rest
	if (mi != i) {
		commit('', mi, i, '')
	}

	return { prefix: new_prefix, suffix: new_suffix }	
}


// see convert_to_obsidian_latex_math.ts
class ConvertNotebookMathIndicators implements PreProcessor {
	process(prefix: string, suffix: string, context: Context): PrefixAndSuffix {
		if (context !== Context.CodeBlock) {
			return tokenise(prefix, suffix);
        }

		return { prefix, suffix };
	}
	
	removesCursor() {
		return false
	}
}

export default ConvertNotebookMathIndicators;
