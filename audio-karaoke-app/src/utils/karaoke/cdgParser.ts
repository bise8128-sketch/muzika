/**
 * CD+G Parser
 * Decodes .cdg file packets for karaoke graphics
 */

export enum CDGInstruction {
    MemoryPreset = 1,
    BorderPreset = 2,
    TileBlockNormal = 6,
    ScrollPreset = 20,
    ScrollCopy = 24,
    SetTransparentColor = 28,
    LoadColorTableLow = 30,
    LoadColorTableHigh = 31,
    TileBlockXor = 38
}

export interface CDGPacket {
    command: number;
    instruction: CDGInstruction;
    data: Uint8Array;
}

export class CDGParser {
    private data: Uint8Array;
    private packetIndex: number = 0;

    constructor(data: Uint8Array) {
        this.data = data;
    }

    getNextPacket(): CDGPacket | null {
        const PACKET_SIZE = 24;
        if (this.packetIndex + PACKET_SIZE > this.data.length) {
            return null;
        }

        const packet = this.data.slice(this.packetIndex, this.packetIndex + PACKET_SIZE);
        this.packetIndex += PACKET_SIZE;

        // CD+G command is usually 0x09 (SC_CDG_COMMAND)
        // Masks out top 2 bits (only lower 6 bits used)
        const command = packet[0] & 0x3F;
        const instruction = packet[1] & 0x3F;
        const packetData = packet.slice(4, 20); // 16 bytes of data

        return {
            command,
            instruction: instruction as CDGInstruction,
            data: packetData
        };
    }

    getPacketAtTime(timeSeconds: number): CDGPacket[] {
        // CD+G runs at 75 sectors per second, each sector has 4 packets
        // 300 packets per second
        const packetCount = Math.floor(timeSeconds * 300);
        const packets: CDGPacket[] = [];

        // Packets are sequential, we need to process all packets up to this point
        // But for performance, we usually just process the delta or maintain state.
        // For a simple 'get packets up to this time' implementation:
        this.packetIndex = 0;
        for (let i = 0; i < packetCount; i++) {
            const p = this.getNextPacket();
            if (p) packets.push(p);
            else break;
        }

        return packets;
    }
}
