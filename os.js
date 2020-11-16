'use strict';

/* Registers */
const R_R0 = 0;
const R_R1 = 1;
const R_R2 = 2;
const R_R3 = 3;
const R_R4 = 4;
const R_R5 = 5;
const R_R6 = 6;
const R_R7 = 7;
const R_PC = 8; /* program counter */
const R_COND = 9;
const R_COUNT = 10;

const PC_START = 0x3000;

const OP_BR = 0;        /* branch */
const OP_ADD = 1;       /* add  */
const OP_LD = 2;        /* load */
const OP_ST = 3;        /* store */
const OP_JSR = 4;       /* jump register */
const OP_AND = 5;       /* bitwise and */
const OP_LDR = 6;       /* load register */
const OP_STR = 7;       /* store register */
const OP_RTI = 8;       /* unused */
const OP_NOT = 9;       /* bitwise not */
const OP_LDI = 10;      /* load indirect */
const OP_STI = 11;      /* store indirect */
const OP_JMP = 12;      /* jump */
const OP_RES = 13;      /* reserved (unused) */
const OP_LEA = 14;      /* load effective address */
const OP_TRAP = 15;     /* execute trap */

/* Condition Flags */
const FL_POS = 1 << 0;  /* P */
const FL_ZRO = 1 << 1;  /* Z */
const FL_NEG = 1 << 2;  /* N */

const TRAP_GETC = 0x20;     /* get character from keyboard, not echoed onto the terminal */
const TRAP_OUT = 0x21;      /* output a character */
const TRAP_PUTS = 0x22;     /* output a word string */
const TRAP_IN = 0x23;       /* get character from keyboard, echoed onto the terminal */
const TRAP_PUTSP = 0x24;    /* output a byte string */
const TRAP_HALT = 0x25;     /* halt the program */

function signExtend(x, bitCount) {
    if ((x >> (bitCount - 1)) & 1) {
        x |= (0xFFFF << bitCount);
        // Need to and it with this so we don't exceed 16-bits
        x &= 0xFFFF;
    }
    return x;
}

class OS {
    constructor() {
        this.memory = new Uint16Array(65536);
        this.registers = new Uint16Array(R_COUNT);
        this.registers[R_PC] = PC_START;
        this.running = true;
    }

    /* Update Flags */
    updateFlags(r) {
        if (this.registers[r] == 0) {
            this.registers[R_COND] = FL_ZRO;
        } else if (this.registers[r] >> 15) /* a 1 in the left-most bit indicates negative */ {
            this.registers[R_COND] = FL_NEG;
        } else {
            this.registers[R_COND] = FL_POS;
        }
    }

    boot(img) {
        // load image to memory
        const origin = img[0];
        for (let i = 1; i < img.length; i++) {
            this.memory[origin + i - 1] = img[i];
        }

        while (this.running) {
            const instr = this.memory[this.registers[R_PC]];
            this.registers[R_PC]++;
            const op = instr >> 12;
            switch (op) {
                case OP_LD:
                    /* LD */
                    {
                        const r0 = (instr >> 9) & 0x7;
                        const pcOffset = signExtend(instr & 0x1FF, 9);
                        this.registers[r0] = this.memory[this.registers[R_PC] + pcOffset];
                        this.updateFlags(r0);
                    }
                    console.log(`LD DR, LABEL`);
                    break;
                case OP_LEA:
                    /* LEA */
                    {
                        const dr = (instr >> 9) & 0x7;
                        const pcOffset = signExtend(instr & 0x1FF, 9);
                        this.registers[dr] = this.registers[R_PC] + pcOffset;
                        this.updateFlags(dr);
                    }
                    break;
                case OP_TRAP:
                    /* TRAP */
                    switch (instr & 0xFF) {
                        // case TRAP_GETC:
                        //     /* TRAP GETC */
                        //     /* read a single ASCII char */
                        //     reg[R_R0] = getchar();
                        //     break;
                        // case TRAP_OUT:
                        //     /* TRAP OUT */
                        //     putc(reg[R_R0], stdout);
                        //     fflush(stdout);
                        //     break;
                        case TRAP_PUTS:
                            /* TRAP PUTS */
                            {
                                /* one char per word */
                                let offset = this.registers[R_R0];
                                let c = this.memory[offset];
                                while (c) {
                                    process.stdout.write(String.fromCharCode(c));
                                    offset++;
                                    c = this.memory[offset];
                                }
                                process.stdout.write('\n');
                            }
                            break;
                        // case TRAP_IN:
                        //     /* TRAP IN */
                        //     {
                        //         printf("Enter a character: ");
                        //         const c = getchar();
                        //         putc(c, stdout);
                        //         reg[R_R0] = c;
                        //     }
                        //     break;
                        // case TRAP_PUTSP:
                        //     /* TRAP PUTSP */
                        //     {
                        //         /* one char per byte (two bytes per word)
                        //            here we need to swap back to
                        //            big endian format */
                        //         const c = memory + reg[R_R0];
                        //         while (c) {
                        //             const char1 = (c) & 0xFF;
                        //             putc(char1, stdout);
                        //             const char2 = (c) >> 8;
                        //             if (char2) putc(char2, stdout);
                        //             ++c;
                        //         }
                        //         fflush(stdout);
                        //     }
                        //     break;
                        case TRAP_HALT:
                            /* TRAP HALT */
                            console.log("HALT");
                            this.running = false;
                            break;
                        default:
                            console.log('un-supported OP_TRAP');
                            process.exit(0);
                            break;
                    }
                    break;
                case OP_JSR:
                    /* JSR */
                    {
                        const longFlag = (instr >> 11) & 1;
                        this.registers[R_R7] = this.registers[R_PC];
                        if (longFlag) {
                            const longPcOffset = signExtend(instr & 0x7FF, 11);
                            this.registers[R_PC] += longPcOffset;  /* JSR */
                        } else {
                            const r1 = (instr >> 6) & 0x7;
                            this.registers[R_PC] = this.registers[r1]; /* JSRR */
                        }
                    }
                    break;
                case OP_STR:
                    /* STR */
                    {
                        const r0 = (instr >> 9) & 0x7;
                        const r1 = (instr >> 6) & 0x7;
                        const offset = signExtend(instr & 0x3F, 6);
                        this.memory[this.registers[r1] + offset] = this.registers[r0];
                    }
                    break;
                case OP_LDR:
                    /* LDR */
                    {
                        const r0 = (instr >> 9) & 0x7;
                        const r1 = (instr >> 6) & 0x7;
                        const offset = signExtend(instr & 0x3F, 6);
                        this.registers[r0] = this.memory[this.registers[r1] + offset];
                        this.updateFlags(r0);
                    }
                    break;
                case OP_LDI:
                    /* LDI */
                    {
                        /* destination register (DR) */
                        const r0 = (instr >> 9) & 0x7;
                        /* PCoffset 9*/
                        const pcOffset = signExtend(instr & 0x1FF, 9);
                        /* add pc_offset to the current PC, look at that memory location to get the final address */
                        this.registers[r0] = this.memory[this.memory[this.registers[R_PC] + pcOffset]];
                        this.updateFlags(r0);
                    }
                    break;
                case OP_ADD:
                    /* ADD */
                    {
                        /* destination register (DR) */
                        const r0 = (instr >> 9) & 0x7;
                        /* first operand (SR1) */
                        const r1 = (instr >> 6) & 0x7;
                        /* whether we are in immediate mode */
                        const immFlag = (instr >> 5) & 0x1;
                        if (immFlag) {
                            const imm5 = signExtend(instr & 0x1F, 5);
                            this.registers[r0] = this.registers[r1] + imm5;
                        } else {
                            const r2 = instr & 0x7;
                            this.registers[r0] = this.registers[r1] + this.registers[r2];
                        }
                        this.updateFlags(r0);
                    }
                    break;
                case OP_AND:
                    /* AND */
                    {
                        const r0 = (instr >> 9) & 0x7;
                        const r1 = (instr >> 6) & 0x7;
                        const immFlag = (instr >> 5) & 0x1;

                        if (immFlag) {
                            const imm5 = signExtend(instr & 0x1F, 5);
                            this.registers[r0] = this.registers[r1] & imm5;
                        }
                        else {
                            const r2 = instr & 0x7;
                            this.registers[r0] = this.registers[r1] & this.registers[r2];
                        }
                        this.updateFlags(r0);
                    }
                    break;
                case OP_BR:
                    /* BR */
                    {
                        const pcOffset = signExtend(instr & 0x1FF, 9);
                        const condFlag = (instr >> 9) & 0x7;
                        if (condFlag & this.registers[R_COND]) {
                            this.registers[R_PC] += pcOffset;
                        }
                    }
                    break;
                default:
                    console.log('un-supported');
                    console.log(instr.toString(2));
                    process.exit(-1);
                    break;
            }
        }
    }
}

module.exports = OS;
