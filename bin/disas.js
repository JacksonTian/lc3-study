const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);

if (argv.length < 1) {
    console.log("lc3as [source] ...");
    process.exit(2);
}

const filename = path.resolve(argv[0]);

const REGISTERS = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];

const BR = [
    'BRnz',
    'BRp',
    'BRp',
    'BRzp',
    'BRn',
    'BRnp',
    'BRnz',
    'BRnzp'
];

class Disassembler {
    constructor(data) {
        const dataUInt16 = new Uint16Array(data.length / 2);
        for (var i = 0; i < data.length; i += 2) {
            dataUInt16[i / 2] = data[i] << 8 | data[i + 1];
        }
        console.log(dataUInt16);
        console.log(`.ORIG x${dataUInt16[0].toString(16)}`);
        for (let i = 1; i < dataUInt16.length; i++) {
            const instruction = dataUInt16[i];
            this.disassemble(i - 1, instruction);
        }
    }

    disassemble(address, instruction) {
        process.stdout.write(`0x${address.toString(16)} `);
        const opcode = instruction >> 12;
        switch (opcode) {
            case 0b0000:
                {
                    const nzp = (instruction >> 9) & 0x7;
                    const label = instruction & 0x1ff; // offset9
                    process.stdout.write(`${BR[nzp]} 0x${label.toString(16)}\n`);
                }
                break;
            case 0b0001:
                {
                    const dr = (instruction >> 9) & 0x7;
                    const sr1 = (instruction >> 6) & 0x7;
                    const mode = (instruction >> 5) & 0x1;
                    // ADD DR, SR1, SR2
                    // ADD DR, SR1, imm5
                    if (mode === 1) {
                        // imm5
                        const imm5 = instruction & 0x1f;
                        process.stdout.write(`ADD ${REGISTERS[dr]}, ${REGISTERS[sr1]}, #${imm5}\n`);
                    } else {
                        const sr2 = (instruction) & 0x7;
                        process.stdout.write(`ADD ${REGISTERS[dr]}, ${REGISTERS[sr1]}, ${REGISTERS[sr2]}\n`);
                    }
                }
                break;
            case 0b0010:
                {
                    // LD DR, LABEL
                    const dr = (instruction >> 9) & 0x7;
                    const offset9 = instruction & 0x1ff;
                    process.stdout.write(`LD ${REGISTERS[dr]}, 0x${offset9.toString(16)}\n`);
                }
                break;
            case 0b0011:
                {
                    const br = (instruction >> 9) & 0x7;
                    const offset9 = instruction & 0x1ff;
                    process.stdout.write(`LD ${REGISTERS[br]}, 0x${offset9.toString(16)}\n`);
                }
                break;
            case 0b0100:
                {
                    const mode = (instruction >> 11) & 0x1;
                    if (mode === 1) {
                        const offset11 = instruction & 0x7ff;
                        process.stdout.write(`JSR 0x${offset11.toString(16)}\n`);
                    } else {
                        const br = (instruction >> 6) & 0x7;
                        process.stdout.write(`JSRR ${REGISTERS[br]}\n`);
                    }
                }
                break;
            case 0b0101:
                {
                    const dr = (instruction >> 9) & 0x7;
                    const sr1 = (instruction >> 6) & 0x7;
                    const mode = (instruction >> 5) & 0x1;
                    // AND DR, SR1, SR2
                    // AND DR, SR1, imm5
                    if (mode === 1) {
                        // imm5
                        const imm5 = instruction & 0x1f;
                        process.stdout.write(`AND ${REGISTERS[dr]}, ${REGISTERS[sr1]}, #${imm5}\n`);
                    } else {
                        const sr2 = (instruction) & 0x7;
                        process.stdout.write(`AND ${REGISTERS[dr]}, ${REGISTERS[sr1]}, ${REGISTERS[sr2]}\n`);
                    }
                }
                break;
            case 0b0111:
                {
                    // STR SR, BaseR, offset6
                    const sr = (instruction >> 9) & 0x7;
                    const br = (instruction >> 6) & 0x7;
                    const offset6 = instruction & 0x3f;
                    process.stdout.write(`STR ${REGISTERS[sr]}, ${REGISTERS[br]}, 0x${offset6.toString(16)}\n`);
                }
                break;
            case 0b1001:
                {
                    // NOT DR, SR
                    const dr = (instruction >> 9) & 0x7;
                    const sr = (instruction >> 6) & 0x7;
                    process.stdout.write(`NOT ${REGISTERS[dr]}, ${REGISTERS[sr]}\n`);
                }
                break;
            case 0b1010:
                {
                    // LDI DR, LABEL
                    const dr = (instruction >> 9) & 0x7;
                    const offset9 = instruction & 0x1ff;
                    process.stdout.write(`LDI ${REGISTERS[dr]}, 0x${offset9.toString(16)}\n`);
                }
                break;
            case 0b1011:
                {
                    // STI SR, LABEL
                    const sr = (instruction >> 9) & 0x7;
                    const offset9 = instruction & 0x1ff;
                    process.stdout.write(`STI ${REGISTERS[sr]}, 0x${offset9.toString(16)}\n`);
                }
                break;
            case 0b1110:
                const dr = (instruction >> 9) & 0x7;
                const offset9 = instruction & 0x1ff;
                process.stdout.write(`LEA ${REGISTERS[dr]}, 0x${offset9.toString(16)}\n`);
                break;
            case 0b1111:
                const trapvector = instruction & 0xff;
                if (trapvector === 0x20) {
                    process.stdout.write(`GETC\n`);
                } else if (trapvector === 0x21) {
                    process.stdout.write(`OUT\n`);
                } else if (trapvector === 0x22) {
                    process.stdout.write(`PUTS\n`);
                } else if (trapvector === 0x23) {
                    process.stdout.write(`IN\n`);
                } else if (trapvector === 0x24) {
                    process.stdout.write(`PUTSP\n`);
                } else if (trapvector === 0x25) {
                    process.stdout.write(`HALT\n`);
                }
                break;
            case 0b1100:
                if (instruction === 0b1100000111000000) {
                    process.stdout.write(`RET\n`);
                } else {
                    const br = (instruction >> 6) & 0x7;
                    process.stdout.write(`JMP ${REGISTERS[br]}\n`);
                }
                break;
            case 0b1100:
                if (instruction === 0b1100000111000000) {
                    process.stdout.write(`RET\n`);
                } else {
                    const br = (instruction >> 6) & 0x7;
                    process.stdout.write(`JMP ${REGISTERS[br]}\n`);
                }
                break;
            case 0b0110:
                {
                    // LDR DR, BaseR, offset6
                    const dr = (instruction >> 9) & 0x7;
                    const br = (instruction >> 6) & 0x7;
                    const offset6 = instruction & 0x3f;
                    process.stdout.write(`LDR ${REGISTERS[dr]}, ${REGISTERS[br]}, #${offset6}\n`);
                }
                break;
            default:
                console.log(`0b${instruction.toString(2).padStart(16, '0')}`);
                throw new Error();
                break;
        }
    }
}

const disassembler = new Disassembler(fs.readFileSync(filename), filename);
// disassembler.disassemble();