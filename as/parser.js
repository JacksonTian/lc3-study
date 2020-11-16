'use strict';

const Tag = require("./tag");

class Parser {
    constructor(lexer) {
        this.lexer = lexer;
    }

    move() {
        do {
            this.look = this.lexer.scan();
        } while (this.look.tag === Tag.COMMENT);
    }

    match(tag) {
        if (this.look.tag === tag) {
            this.move();
        } else {
            this.error(`Expect ${tag}, but ${this.look.tag}: ${this.look.lexeme}`);
        }
    }

    matchWord(tag, lexeme) {
        if (this.look.tag === tag && this.look.lexeme === lexeme) {
            this.move();
        } else {
            this.error(`Expect ${tag} ${lexeme}, but ${this.look.tag}: ${this.look.lexeme}`);
        }
    }

    error(message) {
        const lexer = this.lexer;
        const token = this.look;
        console.log(`${lexer.filename}:${token.loc.start.line}:${token.loc.start.column}`);
        console.log(`${lexer.source.split('\n')[token.loc.start.line - 1]}`);
        console.log(`${' '.repeat(token.loc.start.column - 1)}^`);
        const prefix = `Unexpected token: ${token.tag} ${token.lexeme}.`;
        throw new SyntaxError(`${prefix} ${message}`);
    }

    program() {
        this.move();
        const list = [];
        while (this.look.tag !== Tag.EOF) {
            if (this.look.tag === Tag.PSEUDO_OP) {
                list.push(this.pseudoOp());
            } else if (this.look.tag === Tag.LABEL) {
                const label = this.look;
                this.move();
                list.push({type: 'label', name: label.lexeme});
            } else if (this.look.tag === Tag.OP) {
                list.push(this.instruction());
            } else {
                this.error('un-supported');
            }
        }

        return list;
    }

    block() {
        const name = this.look;
        this.match(Tag.LABEL);
        const instructions = [];
        while (!(this.look.tag === Tag.LABEL || this.look.tag === Tag.EOF)) {
            if (this.look.tag === Tag.OP) {
                instructions.push(this.instruction());
            } else if (this.look.tag === Tag.PSEUDO_OP) {
                instructions.push(this.pseudoOp());
            } else {
                this.error('un-support');
            }
        }

        return {
            type: 'block',
            name: name.lexeme,
            instructions: instructions
        };
    }

    instruction() {
        const op = this.look;
        this.match(Tag.OP);
        if (op.lexeme === 'LD' || op.lexeme === 'LDI' || op.lexeme === 'LEA') {
            // LD DR, LABEL
            // LEA DR, LABEL
            // LDI DR, LABEL
            const register = this.look;
            this.match(Tag.REGISTER);
            this.matchWord(Tag.NORMAL, ',');
            const label = this.look;
            this.match(Tag.LABEL);
            return {
                type: 'instruction',
                op: op,
                dr: register,
                label
            };
        } else if (op.lexeme === 'NOT') {
            // NOT DR, SR
            const dr = this.look;
            this.match(Tag.REGISTER);
            this.matchWord(Tag.NORMAL, ',');
            const sr = this.look;
            this.match(Tag.REGISTER);
            return {
                type: 'instruction',
                op: op,
                dr: dr,
                sr: sr
            };
        } else if (op.lexeme === 'PUTS' || op.lexeme === 'PUTs' || op.lexeme === 'OUT' || op.lexeme === 'RET'
            || op.lexeme === 'GETC' || op.lexeme === 'PUTSP' || op.lexeme === 'HALT') {
            return {
                type: 'instruction',
                op: op
            };
        } else if (op.lexeme === 'STI' || op.lexeme === 'ST') {
            // STI SR, LABEL
            // ST SR, LABEL
            const register = this.look;
            this.match(Tag.REGISTER);
            this.matchWord(Tag.NORMAL, ',');
            const label = this.look;
            this.match(Tag.LABEL);
            return {
                type: 'instruction',
                op: op,
                sr: register,
                label
            };
        } else if (op.lexeme === 'STR') {
            // STR SR, BaseR, offset6
            const sr = this.look;
            this.match(Tag.REGISTER);
            this.matchWord(Tag.NORMAL, ',');
            const br = this.look;
            this.match(Tag.REGISTER);
            this.matchWord(Tag.NORMAL, ',');
            const offset = this.look;
            this.move();
            return {
                type: 'instruction',
                op: op,
                sr: sr,
                br: br,
                offset: offset
            };
        } else if (op.lexeme === 'LDR') {
            // LDR DR, BaseR, offset6
            const dr = this.look;
            this.match(Tag.REGISTER);
            this.matchWord(Tag.NORMAL, ',');
            const br = this.look;
            this.match(Tag.REGISTER);
            this.matchWord(Tag.NORMAL, ',');
            const offset = this.look;
            this.move();
            return {
                type: 'instruction',
                op: op,
                dr: dr,
                br: br,
                offset: offset
            };
        } else if (op.lexeme === 'ADD' || op.lexeme === 'AND') {
            // ADD DR, SR1, SR2
            // ADD DR, SR1, imm5
            // AND DR, SR1, SR2
            // AND DR, SR1, imm5
            const dr = this.look;
            this.match(Tag.REGISTER);
            this.matchWord(Tag.NORMAL, ',');
            const sr1 = this.look;
            this.match(Tag.REGISTER);
            this.matchWord(Tag.NORMAL, ',');
            const token = this.look;
            if (token.tag === Tag.DEC || token.tag === Tag.HEX) {
                this.move();
                return {
                    type: 'instruction',
                    mode: 'immediate',
                    op: op,
                    dr: dr,
                    sr1: sr1,
                    imm5: token
                };
            } else if (token.tag === Tag.REGISTER) {
                this.move();
                return {
                    type: 'instruction',
                    mode: 'register',
                    op: op,
                    dr: dr,
                    sr1: sr1,
                    sr2: token
                };
            } else {
                this.error('expect imm5 or register');
            }
        } else if (op.lexeme === 'BRn' || op.lexeme === 'BRnz' || op.lexeme === 'BRnzp'
            || op.lexeme === 'BRp' || op.lexeme === 'BRzp' || op.lexeme === 'JSR'
            || op.lexeme === 'BRz' || op.lexeme === 'BRnp') {
            // BRn LABEL BRzp LABEL
            // BRz LABEL BRnp LABEL
            // BRp LABEL BRnz LABEL
            // BR† LABEL BRnzp LABEL
            const label = this.look;
            this.move();
            return {
                type: 'instruction',
                op: op,
                label: label
            };
        } else {
            this.error('un-support');
        }
    }

    pseudoOp() {
        const token = this.look;
        this.match(Tag.PSEUDO_OP);
        if (token.lexeme === '.ORIG') {
            const address = this.look;
            this.match(Tag.HEX);
            return {
                type: 'pseudo_op',
                name: 'origin',
                address: address
            }
        } if (token.lexeme === '.FILL') {
            const token = this.look;
            if (token.tag === Tag.HEX) {
                this.move();
                return {
                    type: 'pseudo_op',
                    name: 'fill',
                    value: {
                        type: 'value',
                        data: token
                    }
                }
            } else if (token.tag === Tag.LABEL) {
                this.move();
                return {
                    type: 'pseudo_op',
                    name: 'fill',
                    value: {
                        type: 'label',
                        data: token
                    }
                }
            } else {
                this.error('un-supported');
            }
        } else if (token.lexeme === '.STRINGZ') {
            const str = this.look;
            this.match(Tag.STRING);
            return {
                type: 'pseudo_op',
                name: 'stringz',
                value: str
            };
        }  else if (token.lexeme === '.END') {
            return {
                type: 'pseudo_op',
                name: 'end',
            };
        } else {
            this.error('un-supported');
        }
    }
}

module.exports = Parser;
