export const DSL_MARKER_OWNER = 'nts-dsl';

export const DSL_LANGUAGE_IDS = new Set(['nts', 'odsl', 'gdsl', 'sdsl']);

const CAD_COMMANDS = [
    'line', 'rectang', 'arc', 'boxarray', 'arcbylength',
];

const OBJECT_COMMANDS = [
    'project', 'level', 'placeobject', 'placeobjectarea', 'createroom', 'mysqlquery',
    'querymysql', 'shapeasset', 'animate', 'animategsap', 'animatemotion', 'timeline',
    'timelinegsap', 'timelinemotion', 'morph', 'morphcloud',
];

const SHAPE_COMMANDS = [
    'cube', 'box', 'plane', 'sphere', 'circle', 'cylinder', 'cone', 'torus',
    'ring', 'capsule',
];

const BLOCK_COMMANDS = [
    'wait', 'movex', 'movey', 'movez', 'move', 'movecurve', 'trajectory',
    'rotate', 'rotatex', 'rotatey', 'rotatez', 'scale', 'scalex', 'scaley',
    'scalez', 'color',
];

const LANGUAGE_KEYWORDS = [
    'for', 'in', 'if', 'else', 'let', 'function', 'def', 'return', 'true',
    'false', 'and', 'or', 'not',
];

const BUILTIN_FUNCTIONS = [
    'startpos', 'pos', 'angle', 'rotation', 'valign', 'color', 'roomid', 'template', 'grid',
    'start', 'size', 'gap', 'tilesize', 'wallheight', 'door', 'yaws', 'radius',
    'height', 'tube', 'segments', 'from', 'to', 'via', 'duration', 'ease',
    'yoyo', 'repeat', 'random', 'engine', 'wave', 'wavex', 'circlex', 'circlez',
    'curvex', 'curvez', 'add', 'sub', 'mul', 'div', 'pow', 'sqrt', 'deg', 'rad',
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sind', 'cosd', 'tand', 'exp',
    'log', 'ln', 'abs', 'eq', 'lt', 'gt', 'leq', 'geq', 'sum', 'prod', 'through',
    'targets', 'pointcount', 'count', 'pointsize', 'name', 'side',
];

const KNOWN_LINE_COMMANDS = new Set([
    ...CAD_COMMANDS,
    ...OBJECT_COMMANDS,
    ...SHAPE_COMMANDS,
    ...BLOCK_COMMANDS,
    ...LANGUAGE_KEYWORDS,
]);

const KNOWN_CALLS = new Set([
    ...KNOWN_LINE_COMMANDS,
    ...BUILTIN_FUNCTIONS,
]);

const makeDiagnostic = ({
    severity = 'error',
    message,
    lineNumber,
    startColumn = 1,
    endColumn,
}) => ({
    severity,
    message,
    lineNumber,
    startColumn,
    endColumn: Math.max(startColumn + 1, endColumn ?? startColumn + 1),
});

const stripStringsAndComments = (line) => {
    let output = '';
    let quote = null;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];

        if (!quote && char === '/' && next === '/') {
            return `${output}${' '.repeat(line.length - output.length)}`;
        }

        if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
            quote = quote === char ? null : quote || char;
            output += ' ';
            continue;
        }

        output += quote ? ' ' : char;
    }

    return output;
};

const getFunctionDefinitions = (lines) => {
    const functionNames = new Set();
    const variables = new Set();

    lines.forEach((line) => {
        const cleanLine = stripStringsAndComments(line);
        const functionMatch = /\b(?:function|def)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/i.exec(cleanLine);
        if (functionMatch) {
            functionNames.add(functionMatch[1].toLowerCase());
            functionMatch[2]
                .split(',')
                .map(item => item.trim())
                .filter(Boolean)
                .forEach(param => variables.add(param.replace(/^\$/, '').toLowerCase()));
        }

        const letMatch = /^\s*let\s+(\$?[A-Za-z_]\w*)\b/i.exec(cleanLine);
        if (letMatch) {
            variables.add(letMatch[1].replace(/^\$/, '').toLowerCase());
        }

        const forMatch = /^\s*for\s+(\$?[A-Za-z_]\w*)\s+in\b/i.exec(cleanLine);
        if (forMatch) {
            variables.add(forMatch[1].replace(/^\$/, '').toLowerCase());
        }
    });

    return { functionNames, variables };
};

const isFunctionDefinitionName = (line, index) => /\b(?:function|def)\s+$/i.test(line.slice(0, index));

const analyzeLineCommand = (line, cleanLine, lineNumber) => {
    const commandMatch = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(cleanLine);
    if (!commandMatch) {
        return null;
    }

    const command = commandMatch[1].toLowerCase();
    if (KNOWN_LINE_COMMANDS.has(command)) {
        return null;
    }

    return makeDiagnostic({
        message: `Unknown DSL keyword or command "${commandMatch[1]}".`,
        lineNumber,
        startColumn: line.indexOf(commandMatch[1]) + 1,
        endColumn: line.indexOf(commandMatch[1]) + commandMatch[1].length + 1,
    });
};

const analyzeFunctionCalls = (line, cleanLine, lineNumber, userFunctions) => {
    const diagnostics = [];
    const callRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    let match;

    while ((match = callRegex.exec(cleanLine)) !== null) {
        const name = match[1];
        const key = name.toLowerCase();

        if (KNOWN_CALLS.has(key) || userFunctions.has(key) || isFunctionDefinitionName(cleanLine, match.index)) {
            continue;
        }

        diagnostics.push(makeDiagnostic({
            message: `Undefined DSL function "${name}".`,
            lineNumber,
            startColumn: match.index + 1,
            endColumn: match.index + name.length + 1,
        }));
    }

    return diagnostics;
};

const analyzeVariables = (line, cleanLine, lineNumber, variables) => {
    const diagnostics = [];
    const variableRegex = /\$([A-Za-z_][A-Za-z0-9_]*)/g;
    let match;

    while ((match = variableRegex.exec(cleanLine)) !== null) {
        const name = match[1].toLowerCase();
        if (variables.has(name)) {
            continue;
        }

        diagnostics.push(makeDiagnostic({
            severity: 'warning',
            message: `Variable "$${match[1]}" is used before it is declared.`,
            lineNumber,
            startColumn: match.index + 1,
            endColumn: match.index + match[0].length + 1,
        }));
    }

    return diagnostics;
};

const countUnescaped = (text, target) => {
    let count = 0;

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === target && text[index - 1] !== '\\') {
            count += 1;
        }
    }

    return count;
};

const analyzeBalance = (line, cleanLine, lineNumber, state) => {
    const diagnostics = [];

    for (let index = 0; index < cleanLine.length; index += 1) {
        const char = cleanLine[index];
        if (char === '{') state.braceDepth += 1;
        if (char === '(') state.parenDepth += 1;
        if (char === '}') state.braceDepth -= 1;
        if (char === ')') state.parenDepth -= 1;

        if (state.braceDepth < 0 || state.parenDepth < 0) {
            diagnostics.push(makeDiagnostic({
                message: 'Closing bracket does not have a matching opening bracket.',
                lineNumber,
                startColumn: index + 1,
                endColumn: index + 2,
            }));
            state.braceDepth = Math.max(0, state.braceDepth);
            state.parenDepth = Math.max(0, state.parenDepth);
        }
    }

    const quoteCount = countUnescaped(line, '"');
    const apostropheCount = countUnescaped(line, "'");
    if (quoteCount % 2 !== 0 || apostropheCount % 2 !== 0) {
        diagnostics.push(makeDiagnostic({
            message: 'String is missing a closing quote.',
            lineNumber,
            startColumn: 1,
            endColumn: line.length + 1,
        }));
    }

    return diagnostics;
};

export const analyzeDslContent = (content = '', language = 'odsl') => {
    if (!DSL_LANGUAGE_IDS.has(language)) {
        return [];
    }

    const diagnostics = [];
    const lines = content.split(/\r?\n/);
    const { functionNames, variables } = getFunctionDefinitions(lines);
    const state = { braceDepth: 0, parenDepth: 0 };
    let hasProjectLine = false;
    let hasLevelLine = false;

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const cleanLine = stripStringsAndComments(line);
        const trimmed = cleanLine.trim();

        if (!trimmed) {
            return;
        }

        hasProjectLine = hasProjectLine || /^project\s+\S+/i.test(trimmed);
        hasLevelLine = hasLevelLine || /^level\s+L?\d+/i.test(trimmed);

        const commandDiagnostic = analyzeLineCommand(line, cleanLine, lineNumber);
        if (commandDiagnostic) {
            diagnostics.push(commandDiagnostic);
        }

        diagnostics.push(...analyzeFunctionCalls(line, cleanLine, lineNumber, functionNames));
        diagnostics.push(...analyzeVariables(line, cleanLine, lineNumber, variables));
        diagnostics.push(...analyzeBalance(line, cleanLine, lineNumber, state));
    });

    if (language === 'odsl' && !hasProjectLine) {
        diagnostics.push(makeDiagnostic({
            severity: 'warning',
            message: 'Common DSL should start with a selected project id, for example: project 125.',
            lineNumber: 1,
            startColumn: 1,
            endColumn: Math.max(2, lines[0]?.length + 1 || 2),
        }));
    }

    if (language === 'gdsl' && !hasLevelLine) {
        diagnostics.push(makeDiagnostic({
            severity: 'warning',
            message: 'Game DSL should include a level line, for example: level L0.',
            lineNumber: 1,
            startColumn: 1,
            endColumn: Math.max(2, lines[0]?.length + 1 || 2),
        }));
    }

    if (state.braceDepth > 0 || state.parenDepth > 0) {
        const lastLineNumber = Math.max(1, lines.length);
        diagnostics.push(makeDiagnostic({
            message: 'Unclosed bracket or parenthesis.',
            lineNumber: lastLineNumber,
            startColumn: 1,
            endColumn: Math.max(2, lines[lastLineNumber - 1]?.length + 1 || 2),
        }));
    }

    return diagnostics;
};

export const hasDslErrors = diagnostics => diagnostics.some(item => item.severity === 'error');
