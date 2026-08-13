export const DSL_LANGUAGES = [
    { id: 'nts', extensions: ['.nts'], aliases: ['NTS DSL', 'nts'] },
    { id: 'odsl', extensions: ['.odsl'], aliases: ['Office DSL', 'odsl'] },
    { id: 'gdsl', extensions: ['.gdsl', '.gsdl', '.dsl'], aliases: ['Game DSL', 'gdsl', 'gsdl'] },
    { id: 'sdsl', extensions: ['.sdsl'], aliases: ['Shape DSL', 'sdsl'] },
];

export const DSL_LANGUAGE_BY_EXTENSION = {
    nts: 'nts',
    odsl: 'odsl',
    gdsl: 'gdsl',
    gsdl: 'gdsl',
    dsl: 'gdsl',
    sdsl: 'sdsl',
};

const COMMON_FUNCTIONS = [
    'startPos', 'pos', 'angle', 'rotation', 'vAlign', 'color', 'roomId', 'template', 'grid',
    'start', 'size', 'gap', 'tileSize', 'wallHeight', 'door', 'yaws', 'radius',
    'height', 'tube', 'segments', 'from', 'to', 'via', 'duration', 'ease',
    'yoyo', 'repeat', 'random', 'engine', 'wave', 'wavex', 'circlex', 'circlez',
    'curvex', 'curvez', 'add', 'sub', 'mul', 'div', 'pow', 'sqrt', 'deg', 'rad',
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sind', 'cosd', 'exp', 'log',
    'ln', 'abs', 'eq', 'lt', 'gt', 'leq', 'geq', 'sum', 'prod', 'through',
    'targets', 'pointCount', 'count', 'pointSize', 'name',
];

const OFFICE_COMMANDS = [
    'placeObjectArea', 'placeObject', 'createRoom', 'mysqlQuery', 'queryMysql',
    'shapeAsset', 'animate', 'animateGsap', 'animateMotion', 'timeline',
    'timelineGsap', 'timelineMotion', 'morph', 'morphCloud',
];

const SHAPE_COMMANDS = [
    'cube', 'box', 'plane', 'sphere', 'circle', 'cylinder', 'cone', 'torus',
    'ring', 'capsule',
];

const CAD_COMMAND_DOCS = {
    line: {
        title: 'LINE',
        syntax: 'LINE x1,y1 x2,y2 or LINE (x1,y1,z1) (x2,y2,z2)',
        description: 'Draws a line segment between two 2D or 3D points.',
        example: 'LINE (0, 0, 0) (530, 250, 300)',
    },
    rectang: {
        title: 'RECTANG',
        syntax: 'RECTANG x1,y1 x2,y2',
        description: 'Builds a rectangle using opposite corners.',
        example: 'RECTANG 52,155 92,160',
    },
    arc: {
        title: 'ARC',
        syntax: 'ARC x1,y1 x2,y2 x3,y3',
        description: 'Builds an arc from start, mid, and end points.',
        example: 'ARC 60,13 55,18 60,23',
    },
    boxarray: {
        title: 'boxArray',
        syntax: 'boxArray(sizeX, sizeY, sizeZ, countX, countY, countZ, gapX=0, gapY=0, gapZ=0)',
        description: 'Builds repeated wireframe boxes or planar cell arrays.',
        example: 'boxArray(530, 250, 1, 2, 3, 4, 20)',
    },
    arcbylength: {
        title: 'arcByLength',
        syntax: 'arcByLength(centerX, centerY, radius, arcLength)',
        description: 'Builds an arc from a center point, radius, and arc length.',
        example: 'arcByLength(0, 0, 100, 157.08)',
    },
};

const COMMON_DOCS = {
    project: {
        title: 'project',
        syntax: 'project 125',
        description: 'Defines the active project for the DSL document.',
        example: 'project 125',
    },
    placeobject: {
        title: 'placeObject',
        syntax: 'placeObject TileKey startPos(x,y,z), pos(x,y,z), angle(x,y,z)',
        description: 'Places one object in the scene. startPos is a base offset and pos is the local placement offset.',
        example: 'placeObject FloorTile startPos(10,0,10), pos($x,0,0), angle(0,90,0)',
    },
    placeobjectarea: {
        title: 'placeObjectArea',
        syntax: 'placeObjectArea TileKey (w,h), side(north), color(#fff)',
        description: 'Places an area or grid of objects with modifiers like side, color, angle, and alignment.',
        example: 'placeObjectArea WallTile (1,10), side(north), color(#ffffff)',
    },
    shapeasset: {
        title: 'shapeAsset',
        syntax: 'shapeAsset AssetName { ... }',
        description: 'Defines an inline generated 3D asset that can be placed by the DSL.',
        example: 'shapeAsset SphereRow {\n  sphere orb01 radius(5) color(#c52822) segments(24)\n}',
    },
    animate: {
        title: 'animate',
        syntax: 'animate Target moveY from(0) to(10) duration(2) ease(easeInOut)',
        description: 'Defines a tween for a target object. Supports move, rotate, color, curve motion, and explicit engines.',
        example: 'animate Door1 rotateY from(0) to(90) duration(1.2) ease(power2.out)',
    },
    animategsap: {
        title: 'animateGsap',
        syntax: 'animateGsap Target rotateY from(0) to(90) duration(1.2)',
        description: 'Defines a GSAP animation explicitly.',
        example: 'animateGsap Door1 rotateY from(0) to(90) duration(1.2)',
    },
    animatemotion: {
        title: 'animateMotion',
        syntax: 'animateMotion Target moveY from(0) to(18) duration(1.8)',
        description: 'Defines a motion.dev animation explicitly.',
        example: 'animateMotion Sphere3 rotateY from(0,0,0) to(0,360,0) duration(4)',
    },
    timeline: {
        title: 'timeline',
        syntax: 'timeline Target repeat(-1) { ... }',
        description: 'Defines a multi-step animation timeline for a target object.',
        example: 'timeline Lift1 repeat(-1) {\n  moveY from(0) to(6) duration(2)\n  wait duration(1)\n}',
    },
    morph: {
        title: 'morph',
        syntax: 'morph through(TargetA,TargetB) duration(2) repeat(-1) pointCount(100)',
        description: 'Creates a morphing point-cloud path through scene targets or generated shapes.',
        example: 'morph through(Woman,OfficeChair) duration(2) repeat(-1) pointCount(120)',
    },
    morphcloud: {
        title: 'morphCloud',
        syntax: 'morphCloud through(TargetA,TargetB) pointCount(100) pointSize(0.001)',
        description: 'Defines an explicit morph cloud with target names and optional point settings.',
        example: 'morphCloud through(plane,sphere,helix) pointCount(150) pointSize(0.002)',
    },
    through: {
        title: 'through(...)',
        syntax: 'through(TargetA,TargetB,TargetC)',
        description: 'Lists the targets that a morph or morphCloud animation should pass through.',
        example: 'morph through(Woman,OfficeChair) duration(2)',
    },
    pointcount: {
        title: 'pointCount(value)',
        syntax: 'pointCount(100)',
        description: 'Controls how many points are used for a morph cloud.',
        example: 'morph through(plane,sphere) pointCount(150)',
    },
    pointsize: {
        title: 'pointSize(value)',
        syntax: 'pointSize(0.001)',
        description: 'Controls the rendered size of each morph cloud point.',
        example: 'morphCloud through(plane,sphere) pointSize(0.002)',
    },
    wait: {
        title: 'wait',
        syntax: 'wait duration(1)',
        description: 'Adds a pause inside a timeline.',
        example: 'wait duration(3)',
    },
    pos: {
        title: 'pos(x,y,z)',
        syntax: 'pos(2,0,0)',
        description: 'Sets the object placement offset in 3D coordinates.',
        example: 'pos(2,0,0)',
    },
    startpos: {
        title: 'startPos(x,y,z)',
        syntax: 'startPos(10,0,10)',
        description: 'Sets the base offset for patterns. Final position is startPos plus pos.',
        example: 'placeObject FloorTile startPos(10,0,10), pos($x,0,0)',
    },
    angle: {
        title: 'angle(x,y,z)',
        syntax: 'angle(0,90,0)',
        description: 'Sets rotation in degrees. In object placement, the Y value is commonly used for yaw.',
        example: 'placeObject Chair pos(0,0,0), angle(0,90,0)',
    },
    rotation: {
        title: 'rotation(x,y,z)',
        syntax: 'rotation(0,90,0)',
        description: 'Sets rotation in degrees. Alias of angle.',
        example: 'placeObject Chair pos(0,0,0), rotation(0,90,0)',
    },
    color: {
        title: 'color(value)',
        syntax: 'color(#ffffff)',
        description: 'Sets an object, area, shape, or animation color.',
        example: 'sphere marker radius(5) color(#14b8a6)',
    },
    for: {
        title: 'for',
        syntax: 'for i in 0..5 { ... }',
        description: 'Repeats commands over an inclusive integer range.',
        example: 'for i in 0..5 {\n  placeObject FloorTile pos(i,0,0)\n}',
    },
    let: {
        title: 'let',
        syntax: 'let n = 24',
        description: 'Declares a variable that can be reused in expressions.',
        example: 'let radius = 120',
    },
    function: {
        title: 'function',
        syntax: 'function name(x, z) { ... }',
        description: 'Defines a reusable DSL block.',
        example: 'function tile(x, z) {\n  placeObject FloorTile pos(x,0,z)\n}',
    },
    mysqlquery: {
        title: 'mysqlQuery',
        syntax: 'mysqlQuery "queryAllAssets" roomId(125)',
        description: 'Adds a query command to the parsed DSL output.',
        example: 'mysqlQuery "queryAllAssets" roomId(125)',
    },
    querymysql: {
        title: 'queryMysql',
        syntax: 'queryMysql "queryAllAssets" roomId(125)',
        description: 'Alias for mysqlQuery.',
        example: 'queryMysql "queryAllAssets" roomId(125)',
    },
};

const MATH_DOC = {
    title: 'math helper',
    syntax: 'add(a,b), mul(a,b), pow(a,b), sqrt(x), sin(x), cos(x)',
    description: 'Numeric helpers for placement, CAD, and animation expressions.',
    example: 'pos(circlex(i, radius), 0, circlez(i, radius))',
};

const registeredLanguages = new Set();
const registeredFeatureSets = new Set();

const ensureLanguage = (monacoInstance, language) => {
    if (!monacoInstance.languages.getLanguages().some(item => item.id === language.id)) {
        monacoInstance.languages.register(language);
    }
};

const createLanguageConfig = () => ({
    comments: {
        lineComment: '//',
        blockComment: ['//*', '*//'],
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
    ],
});

const setupCadDsl = (monacoInstance) => {
    const languageId = 'nts';

    monacoInstance.languages.setLanguageConfiguration(languageId, createLanguageConfig());
    monacoInstance.languages.setMonarchTokensProvider(languageId, {
        ignoreCase: true,
        tokenizer: {
            root: [
                [/\/\/\*/, 'comment', '@commentBlock'],
                [/\/\/.*$/, 'comment'],
                [/\b(?:LINE|RECTANG|ARC|for|in|let|def|function|true|false)\b/i, 'keyword'],
                [/\b(?:boxArray|arcByLength)\b/, 'dsl.function'],
                [/\b(?:add|sub|mul|div|pow|sqrt|deg|rad|sin|cos|tan|asin|acos|atan|sind|cosd|tand|exp|log|ln|abs|floor|ceil|round|sum|prod)\b/, 'dsl.function'],
                [/\$?[A-Za-z_]\w*/, 'variable'],
                [/-?\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
                [/-?\d+([eE][-+]?\d+)?/, 'number'],
                [/[{}[\]()]/, '@brackets'],
                [/[,:]/, 'delimiter'],
                [/[+\-*/=^]/, 'operator'],
                [/\s+/, 'white'],
            ],
            commentBlock: [
                [/[^/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/[/*]/, 'comment'],
            ],
        },
    });
};

const setupObjectDsl = (monacoInstance, languageId) => {
    monacoInstance.languages.setLanguageConfiguration(languageId, createLanguageConfig());
    monacoInstance.languages.setMonarchTokensProvider(languageId, {
        ignoreCase: true,
        defaultToken: '',
        tokenPostfix: '.dsl',
        keywords: [
            'project', 'level', 'for', 'in', 'if', 'let', 'function', 'true',
            'false', 'and', 'or', 'not', 'L1', 'L2',
        ],
        commands: [...OFFICE_COMMANDS, ...SHAPE_COMMANDS],
        functions: COMMON_FUNCTIONS,
        tokenizer: {
            root: [
                [/\/\/\*/, 'comment', '@commentBlock'],
                [/\/\/.*$/, 'comment'],
                [/"([^"\\]|\\.)*$/, 'string.invalid'],
                [/'([^'\\]|\\.)*$/, 'string.invalid'],
                [/"/, 'string', '@string_dq'],
                [/'/, 'string', '@string_sq'],
                [/#([0-9a-fA-F]{3,8})\b/, 'number.hex'],
                [/-?\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
                [/-?\d+([eE][-+]?\d+)?/, 'number'],
                [/[{}[\]()]/, '@brackets'],
                [/[,:]/, 'delimiter'],
                [/\$?[A-Za-z_][A-Za-z0-9_]*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@commands': 'keyword.control',
                        '@functions': 'dsl.function',
                        '@default': 'identifier',
                    },
                }],
                [/\s+/, 'white'],
            ],
            commentBlock: [
                [/[^/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/[/*]/, 'comment'],
            ],
            string_dq: [
                [/[^\\"]+/, 'string'],
                [/\\./, 'string.escape'],
                [/"/, 'string', '@pop'],
            ],
            string_sq: [
                [/[^\\']+/, 'string'],
                [/\\./, 'string.escape'],
                [/'/, 'string', '@pop'],
            ],
        },
    });
};

const splitTopLevelCsv = (text) => {
    const parts = [];
    let current = '';
    let depth = 0;

    for (const char of text) {
        if (char === '(') {
            depth += 1;
        } else if (char === ')') {
            depth = Math.max(0, depth - 1);
        }

        if (char === ',' && depth === 0) {
            if (current.trim()) {
                parts.push(current.trim());
            }
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        parts.push(current.trim());
    }

    return parts;
};

const getFunctionDefinitions = (model) => {
    const definitions = [];
    const lines = model.getValue().split(/\r?\n/);

    lines.forEach((line, index) => {
        const match = /(\b(?:function|def)\s+)([A-Za-z_]\w*)\s*\((.*?)\)\s*\{/.exec(line);
        if (!match) {
            return;
        }

        const keyword = match[1].trim().startsWith('def') ? 'def' : 'function';
        const params = match[3].trim() ? splitTopLevelCsv(match[3]) : [];
        const startColumn = match.index + match[1].length + 1;

        definitions.push({
            keyword,
            name: match[2],
            params,
            lineNumber: index + 1,
            startColumn,
            endColumn: startColumn + match[2].length,
        });
    });

    return definitions;
};

const getBuiltinDocs = (languageId) => {
    const docs = languageId === 'nts'
        ? { ...CAD_COMMAND_DOCS }
        : { ...COMMON_DOCS };

    COMMON_FUNCTIONS.forEach((name) => {
        const key = name.toLowerCase();
        if (!docs[key] && /^(add|sub|mul|div|pow|sqrt|deg|rad|sin|cos|tan|asin|acos|atan|sind|cosd|exp|log|ln|abs|eq|lt|gt|leq|geq|sum|prod)$/.test(key)) {
            docs[key] = MATH_DOC;
        }
    });

    SHAPE_COMMANDS.forEach((name) => {
        const key = name.toLowerCase();
        if (!docs[key]) {
            docs[key] = {
                title: name,
                syntax: `${name} objectName size(...), color(...)`,
                description: `Creates a ${name} primitive inside a shapeAsset block.`,
                example: `${name} object01 color(#14b8a6)`,
            };
        }
    });

    return docs;
};

const toHoverMarkdown = (doc, languageId) => [
    `**${doc.title}**`,
    '',
    `Syntax: \`${doc.syntax}\``,
    '',
    doc.description,
    '',
    `\`\`\`${languageId}`,
    doc.example,
    '```',
].join('\n');

const getUserFunctionSuggestions = (monacoInstance, model) => getFunctionDefinitions(model).map(definition => ({
    label: definition.name,
    kind: monacoInstance.languages.CompletionItemKind.Function,
    insertText: `${definition.name}(${definition.params.join(', ')})`,
    detail: 'User-defined function',
    documentation: `${definition.keyword} ${definition.name}(${definition.params.join(', ')})`,
}));

const registerCompletionItems = (monacoInstance, languageId) => {
    const snippets = [
        ['let variable', 'let ${1:n} = ${2:10}'],
        ['for loop', 'for ${1:i} in ${2:0}..${3:5} {\n  ${4:placeObject FloorTile pos(${1},0,0)}\n}'],
        ['function', 'function ${1:name}(${2:x}, ${3:z}) {\n  ${4:placeObject FloorTile pos(${2},0,${3})}\n}'],
        ['mysqlQuery', 'mysqlQuery "${1:queryAllAssets}" roomId(${2:125})'],
        ['shapeAsset', 'shapeAsset ${1:AssetName} {\n  ${2:sphere orb radius(5) color(#14b8a6)}\n}'],
        ['animateMotion', 'animateMotion ${1:Target} ${2:moveY} from(${3:0}) to(${4:10}) duration(${5:2}) ease(${6:easeInOut})'],
        ['timelineMotion', 'timelineMotion ${1:Target} repeat(${2:-1}) {\n  ${3:moveY from(0) to(10) duration(2)}\n  ${4:wait duration(1)}\n}'],
    ];

    monacoInstance.languages.registerCompletionItemProvider(languageId, {
        provideCompletionItems: (model) => ({
            suggestions: [
                ...snippets.map(([label, insertText]) => ({
                    label,
                    kind: monacoInstance.languages.CompletionItemKind.Snippet,
                    insertText,
                    insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                })),
                ...OFFICE_COMMANDS.map(command => ({
                    label: command,
                    kind: monacoInstance.languages.CompletionItemKind.Function,
                    insertText: command,
                })),
                ...SHAPE_COMMANDS.map(command => ({
                    label: command,
                    kind: monacoInstance.languages.CompletionItemKind.Class,
                    insertText: `${command} `,
                })),
                ...COMMON_FUNCTIONS.map(name => ({
                    label: `${name}(`,
                    kind: monacoInstance.languages.CompletionItemKind.Function,
                    insertText: `${name}(`,
                })),
                ...getUserFunctionSuggestions(monacoInstance, model),
            ],
        }),
    });
};

const registerLanguageFeatures = (monacoInstance, languageId) => {
    if (registeredFeatureSets.has(languageId)) {
        return;
    }
    registeredFeatureSets.add(languageId);

    const docs = getBuiltinDocs(languageId);

    monacoInstance.languages.registerHoverProvider(languageId, {
        provideHover(model, position) {
            const word = model.getWordAtPosition(position);
            if (!word) {
                return null;
            }

            const definition = getFunctionDefinitions(model).find(item => item.name === word.word);
            if (definition) {
                const signature = `${definition.keyword} ${definition.name}(${definition.params.join(', ')})`;
                return {
                    range: new monacoInstance.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                    contents: [
                        { value: '**User helper**' },
                        { value: `\`${signature}\`` },
                        { value: `Defined on line ${definition.lineNumber}.` },
                    ],
                };
            }

            const doc = docs[word.word.toLowerCase()];
            if (!doc) {
                return null;
            }

            return {
                range: new monacoInstance.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                contents: [{ value: toHoverMarkdown(doc, languageId) }],
            };
        },
    });

    monacoInstance.languages.registerDefinitionProvider(languageId, {
        provideDefinition(model, position) {
            const word = model.getWordAtPosition(position);
            if (!word) {
                return null;
            }

            const matches = getFunctionDefinitions(model)
                .filter(item => item.name === word.word)
                .map(item => ({
                    uri: model.uri,
                    range: new monacoInstance.Range(item.lineNumber, item.startColumn, item.lineNumber, item.endColumn),
                }));

            return matches.length ? matches : null;
        },
    });

    monacoInstance.languages.registerDocumentSymbolProvider(languageId, {
        provideDocumentSymbols(model) {
            return getFunctionDefinitions(model).map(item => ({
                name: item.name,
                detail: `${item.keyword}(${item.params.join(', ')})`,
                kind: monacoInstance.languages.SymbolKind.Function,
                range: new monacoInstance.Range(item.lineNumber, 1, item.lineNumber, model.getLineMaxColumn(item.lineNumber)),
                selectionRange: new monacoInstance.Range(item.lineNumber, item.startColumn, item.lineNumber, item.endColumn),
                tags: [],
            }));
        },
    });

    if (languageId !== 'nts') {
        monacoInstance.languages.registerColorProvider(languageId, {
            provideDocumentColors(model) {
                const colors = [];
                const regex = /#([0-9a-fA-F]{3,8})\b/g;

                for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
                    const line = model.getLineContent(lineNumber);
                    regex.lastIndex = 0;
                    let match;

                    while ((match = regex.exec(line)) !== null) {
                        const hex = match[1];
                        const normalized = hex.length === 3
                            ? hex.split('').map(char => char + char).join('')
                            : hex.padEnd(8, 'f').slice(0, 8);

                        colors.push({
                            color: {
                                red: Number.parseInt(normalized.slice(0, 2), 16) / 255,
                                green: Number.parseInt(normalized.slice(2, 4), 16) / 255,
                                blue: Number.parseInt(normalized.slice(4, 6), 16) / 255,
                                alpha: Number.parseInt(normalized.slice(6, 8), 16) / 255,
                            },
                            range: new monacoInstance.Range(lineNumber, match.index + 1, lineNumber, match.index + match[0].length + 1),
                        });
                    }
                }

                return colors;
            },
            provideColorPresentations(color) {
                const toHex = value => Math.round(value * 255).toString(16).padStart(2, '0');
                const alpha = color.alpha < 1 ? toHex(color.alpha) : '';
                return [{ label: `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}${alpha}` }];
            },
        });
    }

    registerCompletionItems(monacoInstance, languageId);
};

export const registerDslMonacoLanguages = (monacoInstance) => {
    DSL_LANGUAGES.forEach((language) => {
        ensureLanguage(monacoInstance, language);

        if (!registeredLanguages.has(language.id)) {
            registeredLanguages.add(language.id);
            if (language.id === 'nts') {
                setupCadDsl(monacoInstance);
            } else {
                setupObjectDsl(monacoInstance, language.id);
            }
        }

        registerLanguageFeatures(monacoInstance, language.id);
    });
};
