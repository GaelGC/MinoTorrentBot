import { Result } from "typescript-result";


function split_line(line: string): Result<Error, string[]> {
    // Remove all useless spaces
    const trimmed = line.replace(/\s+/g, ' ').trim().split(' ');

    // Resulting strings
    var dequoted_res: string[] = new Array();

    // When in quote mode, stores the current string buffer
    var quote_buffer = "";
    var in_quote = false;

    for (var idx = 0; idx < trimmed.length; idx++) {
        const cur_str = trimmed[idx];
        const trimmed_str = cur_str.replace("\"", "");
        if (cur_str.length > trimmed_str.length + 2) {
            return Result.error(new Error(`Invalid argument ${cur_str}.`));
        }
        const quote_pos = cur_str.indexOf("\"");
        const last_quote_pos = cur_str.lastIndexOf("\"");
        // We check that the pattern is either X or X" if we are already in a quote.
        if (in_quote && !([-1, cur_str.length - 1].includes(quote_pos))) {
            return Result.error(new Error(
                `Invalid argument ${cur_str}. Expected quotes to be at the end.`));
        }
        // We check that the pattern is either "X, X or "X" if we are not in a quote.
        if (!in_quote && ((quote_pos !== -1 && quote_pos !== 0) ||
            (last_quote_pos !== quote_pos && last_quote_pos !== cur_str.length - 1))) {
            return Result.error(new Error(
                `Invalid argument ${cur_str}. Expected quotes to be at the beginning` +
                " and optionally end."));
        }

        if (quote_pos === -1) {
            if (in_quote) {
                quote_buffer += " " + trimmed_str;
            } else {
                dequoted_res.push(trimmed_str);
            }
        }
        if (quote_pos === 0) {
            in_quote = true;
            quote_buffer = trimmed_str;
        }
        if (last_quote_pos === cur_str.length - 1) {
            in_quote = false;
            quote_buffer += " " + trimmed_str;
            dequoted_res.push(quote_buffer);
        }
    }
    if (in_quote) {
        return Result.error(new Error("Invalid line: Unended quote."));
    }
    return Result.ok(dequoted_res);
}

export function split_message(message: string): Result<Error, string[][]> {
    var res: string[][] = new Array();
    var lines = message.split('\n');

    for (var idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (line.trim().length === 0) {
            continue;
        }
        const splitted = split_line(line);
        if (splitted.isFailure()) {
            return Result.error(new Error(
                `error on line ${line}\n${splitted.error.message}`));
        } else {
            res.push(splitted.value)
        }
    }
    return Result.ok(res);
}