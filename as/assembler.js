'use strict';

const Lexer = require('./lexer');
const Parser = require('./parser');

const hex = {
    '0': 0,
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    'A': 10,
    'B': 11,
    'C': 12,
    'D': 13,
    'E': 14,
    'F': 15,
};

function traverse(ast) {
    const addresses = new Map();
    let index = -1;
    for (let i = 0; i < ast.length; i++) {
        const item = ast[i];
        if (item.type === 'label') {
            addresses.set(item.name, index);
        } else if (item.type === 'pseudo_op') {
            if (item.name === 'fill') {
                index = index + 1;
            } else if (item.name === 'origin') {
                // origin use 2 bytes
                // index = index + 1;
            } else if (item.name === 'stringz') {
                index = index + (item.value.lexeme.length + 1);
            } else if (item.name === 'end') {
                // noop
            }
        } else if (item.type === 'instruction') {
            index = index + 1;
        } else {
            console.log(item);
            throw new Error();
        }
    }
    return addresses;
}

function parseHex(value) {
    let sum = 0;
    for (let i = value.length - 1; i > 0; i--) {
        const v = hex[value[i]];
        sum += v << (value.length - 1 - i) * 4
    }
    return sum;
}

function parseDec(value) {
    return parseInt(value.substring(1), 10);
}

const INSTRUCTIONS = {
    'BR': 0,        /* branch */
    'ADD': 1,       /* add  */
    'LD': 2,        /* load */
    'ST': 3,        /* store */
    'JSR': 4,       /* jump register */
    'AND': 5,       /* bitwise and */
    'LDR': 6,       /* load register */
    'STR': 7,       /* store register */
    'RTI': 8,       /* unused */
    'NOT': 9,       /* bitwise not */
    'LDI': 10,      /* load indirect */
    'STI': 11,      /* store indirect */
    'JMP': 12,      /* jump */
    'RES': 13,      /* reserved (unused) */
    'LEA': 14,      /* load effective address */
    'TRAP': 15,     /* execute trap */
};

const TRAP = {
    'GETC': 0x20,
    'OUT': 0x21,
    'PUTs': 0x22,
    'PUTS': 0x22,
    'IN': 0x23,
    'PUTSP': 0x24,
    'HALT': 0x25,
};

const REGISTERS = {
    'R0': 0b000,
    'R1': 0b001,
    'R2': 0b010,
    'R3': 0b011,
    'R4': 0b100,
    'R5': 0b101,
    'R6': 0b110,
    'R7': 0b111
}

const NZP = {
    'BR': 0b000,
    'BRn': 0b100,
    'BRz': 0b010,
    'BRp': 0b001,
    'BRzp': 0b011,
    'BRnp': 0b101,
    'BRnz': 0b110,
    'BRnzp': 0b111
};

class Assembler {
    constructor(source, filename) {
        this.instructions = [];
        this.addresses = new Map();
        this.source = source;
        this.filename = filename;
    }

    emit(value) {
        const buff = Buffer.alloc(2);
        buff.writeUInt16BE(value);
        this.instructions.push(buff);
    }

    visit(ast) {
        // step 1
        this.addresses = traverse(ast);
        // step 2
        for (let i = 0; i < ast.length; i++) {
            const item = ast[i];
            if (item.type === 'label') {
                // do nothing
            } else if (item.type === 'pseudo_op') {
                this.visitPseudoOp(item);
            } else if (item.type === 'instruction') {
                this.visitInstruction(item);
            } else {
                console.log(item);
                throw new Error();
            }
        }
    }

    visitPseudoOp(ast) {
        if (ast.name === 'origin') {
            this.emit(parseHex(ast.address.lexeme));
        } else if (ast.name === 'fill') {
            if (ast.value.type === 'value') {
                const value = ast.value.data.lexeme;
                this.emit(parseHex(value));
            } else if (ast.value.type === 'label') {
                this.emit(this.addresses.get(ast.value.data.lexeme));
            } else {
                console.log(ast);
                throw new Error();
            }
        } else if (ast.name === 'stringz') {
            const str = ast.value.lexeme;
            for (let i = 0; i < str.length; i++) {
                const code = str.charCodeAt(i);
                this.emit(code);
            }
            this.emit(0);
        } else if (ast.name === 'end') {
            // do nothing
        } else {
            console.log(ast);
            throw new Error();
        }
    }

    visitInstruction(ast) {
        const op = ast.op.lexeme;
        const opcode = (INSTRUCTIONS[op] << 12);
        switch (op) {
            case 'ADD':
            case 'AND':
                // ADD DR, SR1, SR2
                // ADD DR, SR1, imm5
                // AND DR, SR1, SR2
                // AND DR, SR1, imm5
                if (ast.mode === 'immediate') {
                    const imm5 = parseDec(ast.imm5.lexeme) & 0x1f;
                    this.emit(opcode + (REGISTERS[ast.dr.lexeme] << 9) + (REGISTERS[ast.sr1.lexeme] << 6) + (1 << 5) + imm5);
                } else {
                    this.emit(opcode + (REGISTERS[ast.dr.lexeme] << 9) + (REGISTERS[ast.sr1.lexeme] << 6) + REGISTERS[ast.sr2.lexeme]);
                }
                break;
            case 'ST':
            case 'STI':
                this.emit(opcode + (REGISTERS[ast.sr.lexeme] << 9) + this.addresses.get(ast.label.lexeme));
                break;
            case 'LD':
            case 'LEA':
            case 'LDI':
                this.emit(opcode + (REGISTERS[ast.dr.lexeme] << 9) + this.addresses.get(ast.label.lexeme));
                break;
            case 'LDR':
                const offset6 = (parseDec(ast.offset.lexeme) & 0x3f);
                this.emit(opcode + (REGISTERS[ast.dr.lexeme] << 9) + (REGISTERS[ast.br.lexeme] << 6) + offset6);
                break;
            case 'JSR':
                this.emit(opcode + (1 << 11) + this.addresses.get(ast.label.lexeme));
                break;
            case 'BR':
            case 'BRn':
            case 'BRz':
            case 'BRp':
            case 'BRzp':
            case 'BRnp':
            case 'BRnz':
            case 'BRnzp': {
                const opcode = INSTRUCTIONS['BR'] << 12
                const nzp = NZP[op] << 9;
                this.emit(opcode + nzp + this.addresses.get(ast.label.lexeme));
            }
                break;
            case 'GETC':
            case 'OUT':
            case 'PUTS':
            case 'PUTs':
            case 'IN':
            case 'PUTSP':
            case 'HALT':
                this.emit((INSTRUCTIONS['TRAP'] << 12) + (TRAP[op] << 0));
                break;
            case 'STR':
                // STR	R0, R6, #-1
                // STR SR, BaseR, offset6
                // 0111 000 110 111111
                const imm5 = parseDec(ast.offset.lexeme) & 0x1f;
                this.emit(opcode + (REGISTERS[ast.sr.lexeme] << 9) + (REGISTERS[ast.br.lexeme] << 6) + imm5);
                break;
            case 'RET':
                this.emit(0b1100000111000000);
                break;
            case 'NOT':
                this.emit(opcode + (REGISTERS[ast.dr.lexeme] << 9) + (REGISTERS[ast.sr.lexeme] << 6) + 0b111111);
                break;
            default:
                console.log(ast);
                throw new Error();
                break;
        }
    }

    codegen() {
        const lexer = new Lexer(this.source, this.filename);
        const parser = new Parser(lexer);
        this.visit(parser.program());
        return Buffer.concat(this.instructions);
    }
}

module.exports = Assembler;