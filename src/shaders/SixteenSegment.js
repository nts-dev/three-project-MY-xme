export default class SixteenSegmentDisplay {
    constructor(canvas, count = 6, width = canvas.width, height = canvas.height) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.count = count;
        this.width = width;
        this.height = height;

        this.segmentColor = '#00ff00';
        this.backgroundColor = '#000000';
        this.segmentWidth = 6;
        this.segmentLength = 40;
        this.segmentSpacing = 6;

        this.charMap = SixteenSegmentDisplay.CharacterMasks;
    }

    drawText(text = '') {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, this.width, this.height);

        const charWidth = this.width / this.count;
        for (let i = 0; i < this.count; i++) {
            const char = text[i] || ' ';
            const mask = this.charMap[char.toUpperCase()] || 0;
            this.drawCharacter(mask, i * charWidth, 0, charWidth, this.height);
        }
    }

    drawCharacter(mask, x, y, w, h) {
        const ctx = this.ctx;
        ctx.fillStyle = this.segmentColor;
        ctx.shadowColor = this.segmentColor;
        ctx.shadowBlur = 12;

        const sw = this.segmentWidth;
        const spacing = this.segmentSpacing;

        // Define 16 segment positions (simplified layout)
        const segments = [
            { x: x + spacing, y: y + spacing, w: w - 2 * spacing, h: sw }, // A1 top
            { x: x + spacing, y: y + h / 2 - sw / 2, w: w - 2 * spacing, h: sw }, // G middle
            { x: x + spacing, y: y + h - spacing - sw, w: w - 2 * spacing, h: sw }, // D bottom
            { x: x + spacing, y: y + spacing, w: sw, h: h / 2 - spacing }, // F left top
            { x: x + spacing, y: y + h / 2, w: sw, h: h / 2 - spacing }, // E left bottom
            { x: x + w - spacing - sw, y: y + spacing, w: sw, h: h / 2 - spacing }, // B right top
            { x: x + w - spacing - sw, y: y + h / 2, w: sw, h: h / 2 - spacing }, // C right bottom
            { x: x + spacing, y: y + h / 4 - sw / 2, w: w - 2 * spacing, h: sw }, // H upper middle
            { x: x + spacing, y: y + (3 * h) / 4 - sw / 2, w: w - 2 * spacing, h: sw }, // I lower middle
            { x: x + w / 2 - sw / 2, y: y + spacing, w: sw, h: h / 2 - spacing }, // J center vertical top
            { x: x + w / 2 - sw / 2, y: y + h / 2, w: sw, h: h / 2 - spacing }, // K center vertical bottom
            { x: x + spacing, y: y + spacing, w: sw, h: sw }, // L top-left dot
            { x: x + w - spacing - sw, y: y + spacing, w: sw, h: sw }, // M top-right dot
            { x: x + spacing, y: y + h - spacing - sw, w: sw, h: sw }, // N bottom-left dot
            { x: x + w - spacing - sw, y: y + h - spacing - sw, w: sw, h: sw }, // O bottom-right dot
            { x: x + w / 2 - sw / 2, y: y + h / 2 - sw / 2, w: sw, h: sw } // P center dot
        ];

        for (let i = 0; i < segments.length; i++) {
            if ((mask & (1 << i)) !== 0) {
                const s = segments[i];
                ctx.fillRect(s.x, s.y, s.w, s.h);
            }
        }

        ctx.shadowBlur = 0;
    }

    static CharacterMasks = {
        ' ': 0,
        '0': 0b0000000000111111,
        '1': 0b0000000000000110,
        '2': 0b0000000001011011,
        '3': 0b0000000001001111,
        '4': 0b0000000001100110,
        '5': 0b0000000001101101,
        '6': 0b0000000001111101,
        '7': 0b0000000000000111,
        '8': 0b0000000001111111,
        '9': 0b0000000001101111,
        'A': 0b0000000001110111,
        'B': 0b0000000001111100,
        'C': 0b0000000000111001,
        'D': 0b0000000001011110,
        'E': 0b0000000001111001,
        'F': 0b0000000001110001,
        'H': 0b0000000001110110,
        '-': 0b0000000001000000
        // Add more characters as needed
    };
}
