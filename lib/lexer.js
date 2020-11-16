'use strict';

const Tag = require('./tag');

function isLetter(c) {
    if (typeof c !== 'string') {
        return false;
    }
    // letter = "A" … "Z" | "a" … "z"
    var code = c.charCodeAt(0);
    return (code >= 0x41 && code <= 0x5a ||
        code >= 0x61 && code <= 0x7a);
}

function isNumeric(peek) {
    return (peek === '0' || peek === '1' || peek === '2' || peek === '3'
        || peek === '4' || peek === '5' || peek === '6' || peek === '7'
        || peek === '8' || peek === '9' || peek === 'A' || peek === 'B'
        || peek === 'C' || peek === 'D' || peek === 'E' || peek === 'F');
}

class Token {
    constructor(tag, lexeme, loc) {
        this.tag = tag;
        this.lexeme = lexeme;
        this.loc = loc;
    }
}

class Lexer {
    constructor(source, filename, offset = {}) {
        this.source = source;
        this.filename = filename;

        this.index = offset.index || -1;
        this.peek = ' ';
        this.words = new Map();
        this.line = offset.line || 1;
        this.column = offset.column || 0;
        // reserved words
        this.reserve('LD', Tag.OP);
        this.reserve('LDR', Tag.OP);
        this.reserve('LDI', Tag.OP);
        this.reserve('LEA', Tag.OP);
        this.reserve('STI', Tag.OP);
        this.reserve('RET', Tag.OP);
        this.reserve('ST', Tag.OP);
        this.reserve('STR', Tag.OP);
        this.reserve('ADD', Tag.OP);
        this.reserve('AND', Tag.OP);
        this.reserve('NOT', Tag.OP);
        this.reserve('BRn', Tag.OP);
        this.reserve('BRp', Tag.OP);
        this.reserve('BRz', Tag.OP);
        this.reserve('BRnz', Tag.OP);
        this.reserve('BRnp', Tag.OP);
        this.reserve('BRzp', Tag.OP);
        this.reserve('BRnzp', Tag.OP);
        this.reserve('JSR', Tag.OP);

        // Trap Service Routine
        this.reserve('GETC', Tag.OP);
        this.reserve('OUT', Tag.OP);
        this.reserve('PUTS', Tag.OP);
        this.reserve('PUTs', Tag.OP);
        this.reserve('IN', Tag.OP);
        this.reserve('PUTSP', Tag.OP);
        this.reserve('HALT', Tag.OP);

        // registers
        this.reserve('R0', Tag.REGISTER);
        this.reserve('R1', Tag.REGISTER);
        this.reserve('R2', Tag.REGISTER);
        this.reserve('R3', Tag.REGISTER);
        this.reserve('R4', Tag.REGISTER);
        this.reserve('R5', Tag.REGISTER);
        this.reserve('R6', Tag.REGISTER);
        this.reserve('R7', Tag.REGISTER);
        this.reserve('R8', Tag.REGISTER);

    }

    // read and consume a char
    getch() {
        if (this.peek === '\n') {
            // line number
            this.line++;
            this.column = 0;
        }
        this.index++;
        this.column++;
        this.peek = this.source[this.index]; // 其它返回实际字节值
    }

    // read a char by offset
    readch(i = 0) {
        // 只读取，不消费
        return this.source[this.index + i];
    }

    ungetch() {
        this.index--;
        this.column--;
        this.peek = this.source[this.index]; // 其它返回实际字节值
    }

    reserve(lexeme, tag) {
        if (this.words.has(lexeme)) {
            throw new Error(`duplicate reserved word: ${lexeme}`);
        }
        this.words.set(lexeme, tag);
    }

    skipWhitespaces() {
        // 忽略空格,和TAB ch =='\n'
        while (this.peek === ' ' || this.peek === '\t' ||
            this.peek === '\n' || this.peek === '\r') {
            this.getch();
        }
    }

    loc() {
        return {
            line: this.line,
            column: this.column
        };
    }

    scan() {
        this.skipWhitespaces();
        let start = this.loc();
        if (this.peek === ';') {
            let str = ';';
            while (this.peek !== '\n' && this.peek !== '\r' && this.peek) {
                str += this.peek;
                this.getch();
            }
            return new Token(Tag.COMMENT, str, {
                start,
                end: this.loc()
            });
        }

        if (this.peek === '.') {
            let str = '.';
            this.getch();
            while (isLetter(this.peek)) {
                str += this.peek;
                this.getch();
            }
            return new Token(Tag.PSEUDO_OP, str, {
                start,
                end: this.loc()
            });
        }

        if (this.peek === '"') {
            var quote = this.peek;
            let str = '';
            this.getch();
            let start = this.loc();
            var end;
            for (; ;) {
              if (this.peek === quote) {
                end = this.loc();
                this.getch();
                break;
              }
        
              var c = this.peek;
              if (this.peek === '\\') {
                this.getch();
                switch (this.peek) { // 解析转义字符
                case '0':
                  c = '\0';
                  break;
                case 'b':
                  c = '\b';
                  break;
                case 't':
                  c = '\t';
                  break;
                case 'n':
                  c = '\n';
                  break;
                case 'v':
                  c = '\v';
                  break;
                case 'f':
                  c = '\f';
                  break;
                case 'r':
                  c = '\r';
                  break;
                case '\'':
                  c = '\'';
                  break;
                case '\\':
                  c = '\\';
                  break;
                case 'e':
                  c = '\e';
                  break;
                default:
                  this.error(`Invalid char: \\0x${this.peek}/'\\0x${this.peek.charCodeAt(0)}'`);
                }
                str += c;
                this.getch();
              } else if (this.peek) {
                str += this.peek;
                this.getch();
              } else {
                this.error('Unexpect end of file');
              }
            }
            return new Token(Tag.STRING, str, {
              start, end
            });
        }

        if (this.peek === '#') {
            let str = '#';
            this.getch();
            while (this.peek && (this.peek === '-' || isNumeric(this.peek))) {
                str += this.peek;
                this.getch();
            }
            return new Token(Tag.DEC, str, {
                start,
                end: this.loc()
            });
        }

        if (this.peek === 'x') {
            let str = 'x';
            this.getch();
            while (isNumeric(this.peek)) {
                str += this.peek;
                this.getch();
            }
            return new Token(Tag.HEX, str, {
                start,
                end: this.loc()
            });
        }

        if (isLetter(this.peek)) {
            let str = '';
            do {
                str += this.peek;
                this.getch();
            } while (isLetter(this.peek) || isNumeric(this.peek) || this.peek === '_');

            // reserve words
            if (this.words.has(str)) {
                var tag = this.words.get(str);
                return new Token(tag, str, {
                    start: start,
                    end: this.loc()
                });
            }

            return new Token(Tag.LABEL, str, {
                start: start,
                end: this.loc()
            });
        }

        if (!this.peek) {
            var tok = new Token(Tag.EOF, this.peek, {
                start,
                end: this.loc()
            });
            return tok;
        }

        var tok = new Token(Tag.NORMAL, this.peek, {
            start,
            end: this.loc()
        });
        this.getch();
        return tok;
    }

    error(message) {
        console.error(`${this.filename}:${this.line}:${this.column}`);
        console.error(`${this.source.split('\n')[this.line - 1]}`);
        console.error(`${' '.repeat(this.column - 1)}^`);
        throw new SyntaxError(message);
      }
}

module.exports = Lexer;
