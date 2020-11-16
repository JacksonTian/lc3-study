const Tag = Object.freeze({
    EOF: -1,        // eof
    NORMAL: 0,      // normal
    COMMENT: 1,     // comment
    PSEUDO_OP: 2,   // pseudoop
    HEX: 3,         // hexadecimal
    LABEL: 4,       // label
    OP: 5,          // opcode
    REGISTER: 6,    // register
    DEC: 7,          // decimal
    STRING: 8,      // string
    NUMBER: 9,      // number
});

module.exports = Tag;
