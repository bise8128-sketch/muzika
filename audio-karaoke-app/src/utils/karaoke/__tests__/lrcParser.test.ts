import { parseLRC } from '../lrcParser';

describe('lrcParser', () => {
    const sampleLRC = `
[ti:Sample Song]
[ar:Artist Name]
[00:01.00]First line of lyrics
[00:03.50]Second line with [00:04.00]multiple timestamps
[00:06.00]Last line
    `.trim();

    it('should parse metadata correctly', () => {
        const result = parseLRC(sampleLRC);
        expect(result.metadata.ti).toBe('Sample Song');
        expect(result.metadata.ar).toBe('Artist Name');
    });

    it('should parse timestamps and text correctly', () => {
        const result = parseLRC(sampleLRC);
        expect(result.lines.length).toBe(4);

        expect(result.lines[0].text).toBe('First line of lyrics');
        expect(result.lines[0].startTime).toBe(1.0);

        expect(result.lines[1].text).toBe('Second line with multiple timestamps');
        expect(result.lines[1].startTime).toBe(3.5);

        expect(result.lines[2].text).toBe('Second line with multiple timestamps');
        expect(result.lines[2].startTime).toBe(4.0);
    });

    it('should calculate endTimes correctly', () => {
        const result = parseLRC(sampleLRC);
        expect(result.lines[0].endTime).toBe(3.5);
        expect(result.lines[1].endTime).toBe(4.0);
        expect(result.lines[2].endTime).toBe(6.0);
    });

    it('should sort lines by startTime', () => {
        const outOfOrderLRC = `
[00:10.00]Late line
[00:05.00]Early line
        `.trim();
        const result = parseLRC(outOfOrderLRC);
        expect(result.lines[0].text).toBe('Early line');
        expect(result.lines[1].text).toBe('Late line');
    });
});
