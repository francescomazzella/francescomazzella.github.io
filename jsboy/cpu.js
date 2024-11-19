const KNOWN_ADDRESSES = {
    IOMemAddr: 0xFF00,
}

class CPU {
    /**
     * Creates a CPU that can execute opcodes
     * @param {JSBoy} jsboy Emulation core
     */
    constructor(jsboy) {

        this.jsboy = jsboy;

        this.registers = {

            _r: new Uint8Array(7),
            
            get a() { return this._r[0] },
            get b() { return this._r[1] },
            get c() { return this._r[2] },
            get d() { return this._r[3] },
            get e() { return this._r[4] },
            get h() { return this._r[5] },
            get l() { return this._r[6] },

            get af() { return this._r[0] << 8 | this.f     },
            get bc() { return this._r[1] << 8 | this._r[2] },
            get de() { return this._r[3] << 8 | this._r[4] },
            get hl() { return this._r[5] << 8 | this._r[6] },

            get f() {
                return (
                this.flags._z << 7 |
                this.flags._n << 6 |
                this.flags._h << 5 |
                this.flags._c << 4)
            },

            set a(v) { this._r[0] = v },
            set b(v) { this._r[1] = v },
            set c(v) { this._r[2] = v },
            set d(v) { this._r[3] = v },
            set e(v) { this._r[4] = v },
            set h(v) { this._r[5] = v },
            set l(v) { this._r[6] = v },

            set af(v) { this._r[0] = v >> 8; this.f     = v & 0xFF; },
            set bc(v) { this._r[1] = v >> 8; this._r[2] = v & 0xFF; },
            set de(v) { this._r[3] = v >> 8; this._r[4] = v & 0xFF; },
            set hl(v) { this._r[5] = v >> 8; this._r[6] = v & 0xFF; },

            set f(v) {
                this.flags._z = v >> 7 & 0b1;
                this.flags._n = v >> 6 & 0b1;
                this.flags._h = v >> 5 & 0b1;
                this.flags._c = v >> 4 & 0b1;
            },

            flags: {
                _z: 0, _n: 0, _h: 0, _c: 0,

                get z() { return this._z },
                get n() { return this._n },
                get h() { return this._h },
                get c() { return this._c },

                set z(v) { this._z = v ? 1 : 0 },
                set n(v) { this._n = v ? 1 : 0 },
                set h(v) { this._h = v ? 1 : 0 },
                set c(v) { this._c = v ? 1 : 0 },

            },

        }

        /** @type {number} The address of the next instruction to be executed */
        this.pc;
        this._sp = new Uint16Array(1);

        this._ops = {
            jsboy: this.jsboy,
            0x00: {
                m: '',
                f: () => {
                    return 0;
                },
            },
            0x00: {
                m: 'NOP',
                f: () => {
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            
            0x01: {
                m: 'LD BC, nn',
                f: () => {
                    this.registers.bc = this.jsboy.memory.readShort(this.pc + 1);
                    this.pc += 3;
                    return 12;
                },
                c: 12,
            },
            0x02: {
                m: 'LD (BC), A',
                f: () => {
                    this.jsboy.memory.write(this.registers.bc, this.registers.a);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x03: {
                m: 'INC BC',
                f: () => {
                    this.registers.bc++;
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x04: {
                m: 'INC B',
                f: () => {
                    this.registers.flags.h = ((this.registers.b & 0x0F) == 0x0F);
                    ++this.registers.b;
                    this.registers.flags.z = !this.registers.b;
                    this.registers.flags.n = 0;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x05: {
                m: 'DEC B',
                f: () => {
                    this.registers.flags.h = !(this.registers.b & 0x0F);
                    this.registers.flags.z = !(--this.registers.b);
                    this.registers.flags.n = 1;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x06: {
                m: 'LD B, n',
                f: () => {
                    this.registers.b = this.jsboy.memory.read(this.pc + 1);
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0x07: {
                m: 'RLCA',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.z = 0;
                    this.registers.flags.c = this.registers.a & 0x80;
                    this.registers.a = (this.registers.a << 1) | (this.registers.flags.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x08: {
                m: 'LD (nn), SP',
                f: () => {
                    // TODO: CHECK!!
                    let dst = this.jsboy.memory.readShort(this.pc + 1);
                    this.jsboy.memory.write(dst    , this.registers.sp >> 8);
                    this.jsboy.memory.write(dst + 1, this.registers.sp & 0xFF);
                    this.pc += 3;
                    return 20;
                },
                c: 20,
            },
            0x09: {
                m: 'ADD HL, BC',
                f: () => {
                    this.registers.hl = this._opSupport.Add16Bit(this.registers.hl, this.registers.bc);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x0A: {
                m: 'LD A, (BC)',
                f: () => {
                    this.registers.a = this.jsboy.memory.read(this.registers.bc);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x0B: {
                m: 'DEC BC',
                f: () => {
                    --this.registers.bc;
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x0C: {
                m: 'INC C',
                f: () => {
                    this.registers.flags.h = ((this.registers.c & 0x0F) == 0x0F);
                    ++this.registers.c;
                    this.registers.flags.z = !this.registers.c;
                    this.registers.flags.n = 0;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x0D: {
                m: 'DEC C',
                f: () => {
                    this.registers.flags.h = !(this.registers.c & 0x0F);
                    this.registers.flags.z = !(--this.registers.c);
                    this.registers.flags.n = 1;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x0E: {
                m: 'LD C, n',
                f: () => {
                    this.registers.c = this.jsboy.memory.read(this.pc + 1);
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0x0F: {
                m: 'RRCA',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.z = 0;
                    this.registers.flags.c = this.registers.a & 1;
                    this.registers.a = (this.registers.a >> 1) | (this.registers.flags.c << 7);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x10: {
                m: 'STOP',
                f: () => {
                    if (this._verbose) console.log('STOP instruction at', this.pc.toString(16).padStart(4, 0));
                    this.jsboy.status = EMULATOR_STATUS.pause;
                    // this.jsboy.stopped = true;
                    // if (!this.jsboy.memory.read(this.pc + 1))
                    //     this.jsboy.gpu._lcdOn = false;
                    this.pc += 2;
                    return 4;
                },
                c: 4,
            },
            0x11: {
                m: 'LD DE, nn',
                f: () => {
                    this.registers.de = this.jsboy.memory.readShort(this.pc + 1);
                    this.pc += 3;
                    return 12;
                },
                c: 12,
            },
            0x12: {
                m: 'LD (DE), A',
                f: () => {
                    this.jsboy.memory.write(this.registers.de, this.registers.a);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x13: {
                m: 'INC DE',
                f: () => {
                    this.registers.de++;
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x14: {
                m: 'INC D',
                f: () => {
                    this.registers.flags.h = ((this.registers.d & 0x0F) == 0x0F);
                    ++this.registers.d;
                    this.registers.flags.z = !this.registers.d;
                    this.registers.flags.n = 0;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x15: {
                m: 'DEC D',
                f: () => {
                    this.registers.flags.h = !(this.registers.d & 0x0F);
                    this.registers.flags.z = !(--this.registers.d);
                    this.registers.flags.n = 1;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x16: {
                m: 'LD D, n',
                f: () => {
                    this.registers.d = this.jsboy.memory.read(this.pc + 1);
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0x17: {
                m: 'RLA',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.z = 0;
                    let c = this.registers.flags.c;
                    this.registers.flags.c = this.registers.a & 0x80;
                    this.registers.a = (this.registers.a << 1) | c;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x18: {
                m: 'JR n',
                f: () => {
                    this.pc += 2;
                    this.pc += (this.jsboy.memory.read(this.pc - 1) << 24 >> 24);
                    return 8;
                },
                c: 8,
            },
            0x19: {
                m: 'ADD HL, DE',
                f: () => {
                    this.registers.hl = this._opSupport.Add16Bit(this.registers.hl, this.registers.de);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x1A: {
                m: 'LD A, (DE)',
                f: () => {
                    this.registers.a = this.jsboy.memory.read(this.registers.de);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x1B: {
                m: 'DEC DE',
                f: () => {
                    --this.registers.de;
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x1C: {
                m: 'INC E',
                f: () => {
                    this.registers.flags.h = ((this.registers.e & 0x0F) == 0x0F);
                    ++this.registers.e;
                    this.registers.flags.z = !this.registers.e;
                    this.registers.flags.n = 0;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x1D: {
                m: 'DEC E',
                f: () => {
                    this.registers.flags.h = !(this.registers.e & 0x0F);
                    this.registers.flags.z = !(--this.registers.e);
                    this.registers.flags.n = 1;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x1E: {
                m: 'LD E, n',
                f: () => {
                    this.registers.e = this.jsboy.memory.read(this.pc + 1);
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0x1F: {
                m: 'RRA',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.z = 0;
                    let c = this.registers.flags.c;
                    this.registers.flags.c = this.registers.a & 1;
                    this.registers.a = (this.registers.a >> 1) | (c << 7);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x20: {
                m: 'JR NZ, n',
                f: () => {
                    this.pc += 2;
                    if (!this.registers.flags.z)
                        this.pc += (this.jsboy.memory.read(this.pc - 1) << 24 >> 24);
                    return 8;
                },
                c: 8,
            },
            0x21: {
                m: 'LD HL, nn',
                f: () => {
                    this.registers.hl = this.jsboy.memory.readShort(this.pc + 1);
                    this.pc += 3;
                    return 12;
                },
                c: 12,
            },
            0x22: {
                m: 'LDI (HL), A',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl++, this.registers.a);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x23: {
                m: 'INC HL',
                f: () => {
                    this.registers.hl++;
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x24: {
                m: 'INC H',
                f: () => {
                    this.registers.flags.h = ((this.registers.h & 0x0F) == 0x0F);
                    ++this.registers.h;
                    this.registers.flags.z = !this.registers.h;
                    this.registers.flags.n = 0;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x25: {
                m: 'DEC H',
                f: () => {
                    this.registers.flags.h = !(this.registers.h & 0x0F);
                    this.registers.flags.z = !(--this.registers.h);
                    this.registers.flags.n = 1;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x26: {
                m: 'LD H, n',
                f: () => {
                    this.registers.h = this.jsboy.memory.read(this.pc + 1);
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0x27: {
                m: 'DAA',
                f: () => {
                    if (!this.registers.flags.n) {
                        if (this.registers.flags.c || this.registers.a > 0x99) {
                            this.registers.a += 0x60;
                            this.registers.flags.c = 1;
                        }
                        if (this.registers.flags.h || (this.registers.a & 0xF) > 0x9) {
                            this.registers.a += 0x6;
                        }
                    } else {
                        if (this.registers.flags.c)
                            this.registers.a -= 0x60;
                        if (this.registers.flags.h)
                            this.registers.a -= 0x6;
                    }

                    this.registers.flags.z = !this.registers.a;
                    this.registers.flags.h = 0;

                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x28: {
                m: 'JR Z, n',
                f: () => {
                    this.pc += 2;
                    if (this.registers.flags.z)
                        this.pc += (this.jsboy.memory.read(this.pc - 1) << 24 >> 24);
                    return 8;
                },
                c: 8,
            },
            0x29: {
                m: 'ADD HL, HL',
                f: () => {
                    this.registers.hl = this._opSupport.Add16Bit(this.registers.hl, this.registers.hl);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x2A: {
                m: 'LDI A, (HL)',
                f: () => {
                    this.registers.a = this.jsboy.memory.read(this.registers.hl++);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x2B: {
                m: 'DEC HL',
                f: () => {
                    --this.registers.hl;
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x2C: {
                m: 'INC L',
                f: () => {
                    this.registers.flags.h = ((this.registers.l & 0x0F) == 0x0F);
                    ++this.registers.l;
                    this.registers.flags.z = !this.registers.l;
                    this.registers.flags.n = 0;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x2D: {
                m: 'DEC L',
                f: () => {
                    this.registers.flags.h = !(this.registers.l & 0x0F);
                    this.registers.flags.z = !(--this.registers.l);
                    this.registers.flags.n = 1;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x2E: {
                m: 'LD L, n',
                f: () => {
                    this.registers.l = this.jsboy.memory.read(this.pc + 1);
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0x2F: {
                m: 'CPL',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = 1;
                    this.registers.a ^= 0xFF;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x30: {
                m: 'JR NC, n',
                f: () => {
                    this.pc += 2;
                    if (!this.registers.flags.c)
                        this.pc += (this.jsboy.memory.read(this.pc - 1) << 24 >> 24);
                    return 8;
                },
                c: 8,
            },
            0x31: {
                m: 'LD SP, nn',
                f: () => {
                    this.sp = this.jsboy.memory.readShort(this.pc + 1);
                    this.pc += 3;
                    return 12;
                },
                c: 12,
            },
            0x32: {
                m: 'LDD (HL), A',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl--, this.registers.a);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x33: {
                m: 'INC SP',
                f: () => {
                    this.registers.sp++;
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x34: {
                m: 'INC (HL)',
                f: () => {
                    let value = this.jsboy.memory.read(this.registers.hl);
                    this.registers.flags.h = ((value & 0x0F) == 0x0F);
                    value = (value + 1) & 0xFF;
                    this.registers.flags.z = !value;
                    this.registers.flags.n = 0;
                    this.jsboy.memory.write(this.registers.hl, value);
                    this.pc += 1;
                    return 12;
                },
                c: 12,
            },
            0x35: {
                m: 'DEC (HL)',
                f: () => {
                    let n = this.jsboy.memory.read(this.registers.hl);
                    this.registers.flags.h = !(n & 0x0F);
                    n = (n - 1) & 0xFF;
                    this.registers.flags.z = !n;
                    this.registers.flags.n = 1;
                    this.jsboy.memory.write(this.registers.hl, n);
                    this.pc += 1;
                    return 12;
                },
                c: 12,
            },
            0x36: {
                m: 'LD (HL), n',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl, this.jsboy.memory.read(this.pc + 1));
                    this.pc += 2;
                    return 12;
                },
                c: 12,
            },
            0x37: {
                m: 'SCF',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = 0;
                    this.registers.flags.c = 1;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x38: {
                m: 'JR C, n',
                f: () => {
                    this.pc += 2;
                    if (this.registers.flags.c)
                        this.pc += (this.jsboy.memory.read(this.pc - 1) << 24 >> 24);
                    return 8;
                },
                c: 8,
            },
            0x39: {
                m: 'ADD HL, SP',
                f: () => {
                    this.registers.hl = this._opSupport.Add16Bit(this.registers.hl, this.sp);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x3A: {
                m: 'LDD A, (HL)',
                f: () => {
                    this.registers.a = this.jsboy.memory.read(this.registers.hl--);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x3B: {
                m: 'DEC SP',
                f: () => {
                    --this.sp;
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x3C: {
                m: 'INC A',
                f: () => {
                    this.registers.flags.h = ((this.registers.a & 0x0F) == 0x0F);
                    ++this.registers.a;
                    this.registers.flags.z = !this.registers.a;
                    this.registers.flags.n = 0;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x3D: {
                m: 'DEC A',
                f: () => {
                    this.registers.flags.h = !(this.registers.a & 0x0F);
                    this.registers.flags.z = !(--this.registers.a);
                    this.registers.flags.n = 1;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x3E: {
                m: 'LD A, n',
                f: () => {
                    this.registers.a = this.jsboy.memory.read(this.pc + 1);
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0x3F: {
                m: 'CCF',
                f: () => {
                    this.registers.flags.c = !this.registers.flags.c;
                    this.registers.flags.n = this.registers.flags.h = 0;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x40: {
                m: 'LD B, B',
                f: () => {
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x41: {
                m: 'LD B, C',
                f: () => {
                    this.registers.b = this.registers.c;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x42: {
                m: 'LD B, D',
                f: () => {
                    this.registers.b = this.registers.d;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x43: {
                m: 'LD B, E',
                f: () => {
                    this.registers.b = this.registers.e;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x44: {
                m: 'LD B, H',
                f: () => {
                    this.registers.b = this.registers.h;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x45: {
                m: 'LD B, L',
                f: () => {
                    this.registers.b = this.registers.l;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x46: {
                m: 'LD B, (HL)',
                f: () => {
                    this.registers.b = this.jsboy.memory.read(this.registers.hl);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x47: {
                m: 'LD B, A',
                f: () => {
                    this.registers.b = this.registers.a;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x48: {
                m: 'LD C, B',
                f: () => {
                    this.registers.c = this.registers.b;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x49: {
                m: 'LD C, C',
                f: () => {
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x4A: {
                m: 'LD C, D',
                f: () => {
                    this.registers.c = this.registers.d;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x4B: {
                m: 'LD C, E',
                f: () => {
                    this.registers.c = this.registers.e;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x4C: {
                m: 'LD C, H',
                f: () => {
                    this.registers.c = this.registers.h;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x4D: {
                m: 'LD C, L',
                f: () => {
                    this.registers.c = this.registers.l;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x4E: {
                m: 'LD C, (HL)',
                f: () => {
                    this.registers.c = this.jsboy.memory.read(this.registers.hl);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x4F: {
                m: 'LD C, A',
                f: () => {
                    this.registers.c = this.registers.a;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x50: {
                m: 'LD D, B',
                f: () => {
                    this.registers.d = this.registers.b;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x51: {
                m: 'LD D, C',
                f: () => {
                    this.registers.d = this.registers.c;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x52: {
                m: 'LD D, D',
                f: () => {
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x53: {
                m: 'LD D, E',
                f: () => {
                    this.registers.d = this.registers.e;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x54: {
                m: 'LD D, H',
                f: () => {
                    this.registers.d = this.registers.h;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x55: {
                m: 'LD D, L',
                f: () => {
                    this.registers.d = this.registers.l;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x56: {
                m: 'LD D, (HL)',
                f: () => {
                    this.registers.d = this.jsboy.memory.read(this.registers.hl);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x57: {
                m: 'LD D, A',
                f: () => {
                    this.registers.d = this.registers.a;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x58: {
                m: 'LD E, B',
                f: () => {
                    this.registers.e = this.registers.b;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x59: {
                m: 'LD E, C',
                f: () => {
                    this.registers.e = this.registers.c;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x5A: {
                m: 'LD E, D',
                f: () => {
                    this.registers.e = this.registers.d;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x5B: {
                m: 'LD E, E',
                f: () => {
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x5C: {
                m: 'LD E, H',
                f: () => {
                    this.registers.e = this.registers.h;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x5D: {
                m: 'LD E, L',
                f: () => {
                    this.registers.e = this.registers.l;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x5E: {
                m: 'LD E, (HL)',
                f: () => {
                    this.registers.e = this.jsboy.memory.read(this.registers.hl);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x5F: {
                m: 'LD E, A',
                f: () => {
                    this.registers.e = this.registers.a;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x60: {
                m: 'LD H, B',
                f: () => {
                    this.registers.h = this.registers.b;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x61: {
                m: 'LD H, C',
                f: () => {
                    this.registers.h = this.registers.c;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x62: {
                m: 'LD H, D',
                f: () => {
                    this.registers.h = this.registers.d;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x63: {
                m: 'LD H, E',
                f: () => {
                    this.registers.h = this.registers.e;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x64: {
                m: 'LD H, H',
                f: () => {
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x65: {
                m: 'LD H, L',
                f: () => {
                    this.registers.h = this.registers.l;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x66: {
                m: 'LD H, (HL)',
                f: () => {
                    this.registers.h = this.jsboy.memory.read(this.registers.hl);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x67: {
                m: 'LD H, A',
                f: () => {
                    this.registers.h = this.registers.a;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x68: {
                m: 'LD L, B',
                f: () => {
                    this.registers.l = this.registers.b;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x69: {
                m: 'LD L, C',
                f: () => {
                    this.registers.l = this.registers.c;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x6A: {
                m: 'LD L, D',
                f: () => {
                    this.registers.l = this.registers.d;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x6B: {
                m: 'LD L, E',
                f: () => {
                    this.registers.l = this.registers.e;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x6C: {
                m: 'LD L, H',
                f: () => {
                    this.registers.l = this.registers.h;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x6D: {
                m: 'LD L, L',
                f: () => {
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x6E: {
                m: 'LD L, (HL)',
                f: () => {
                    this.registers.l = this.jsboy.memory.read(this.registers.hl);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x6F: {
                m: 'LD L, A',
                f: () => {
                    this.registers.l = this.registers.a;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x70: {
                m: 'LD (HL), B',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl, this.registers.b);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x71: {
                m: 'LD (HL), C',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl, this.registers.c);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x72: {
                m: 'LD (HL), D',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl, this.registers.d);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x73: {
                m: 'LD (HL), E',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl, this.registers.e);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x74: {
                m: 'LD (HL), H',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl, this.registers.h);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x75: {
                m: 'LD (HL), L',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl, this.registers.l);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x76: {
                m: 'HALT',
                f: () => {
                    if (this._verbose) console.log('HALT instruction');
                    if (this.jsboy.ime || (this.jsboy.memory._ie[0] & this.jsboy.memory._io[0x000F]) == 0) {
                        this.jsboy.halted = true;
                    }
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x77: {
                m: 'LD (HL), A',
                f: () => {
                    this.jsboy.memory.write(this.registers.hl, this.registers.a);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x78: {
                m: 'LD A, B',
                f: () => {
                    this.registers.a = this.registers.b;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x79: {
                m: 'LD A, C',
                f: () => {
                    this.registers.a = this.registers.c;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x7A: {
                m: 'LD A, D',
                f: () => {
                    this.registers.a = this.registers.d;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x7B: {
                m: 'LD A, E',
                f: () => {
                    this.registers.a = this.registers.e;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x7C: {
                m: 'LD A, H',
                f: () => {
                    this.registers.a = this.registers.h;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x7D: {
                m: 'LD A, L',
                f: () => {
                    this.registers.a = this.registers.l;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x7E: {
                m: 'LD A, (HL)',
                f: () => {
                    this.registers.a = this.jsboy.memory.read(this.registers.hl);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x7F: {
                m: 'LD A, A',
                f: () => {
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },

            0x80: {
                m: 'ADD A, B',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.b);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x81: {
                m: 'ADD A, C',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x82: {
                m: 'ADD A, D',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.d);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x83: {
                m: 'ADD A, E',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.e);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x84: {
                m: 'ADD A, H',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.h);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x85: {
                m: 'ADD A, L',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.l);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x86: {
                m: 'ADD A, (HL)',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.jsboy.memory.read(this.registers.hl));
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x87: {
                m: 'ADD A, A',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.a);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x88: {
                m: 'ADC A, B',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.b + this.registers.flags.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x89: {
                m: 'ADC A, C',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.c + this.registers.flags.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x8A: {
                m: 'ADC A, D',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.d + this.registers.flags.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x8B: {
                m: 'ADC A, E',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.e + this.registers.flags.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x8C: {
                m: 'ADC A, H',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.h + this.registers.flags.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x8D: {
                m: 'ADC A, L',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.registers.l + this.registers.flags.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x8E: {
                m: 'ADC A, (HL)',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.jsboy.memory.read(this.registers.hl) + this.registers.flags.c);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0x90: {
                m: 'SUB B',
                f: () => {
                    this.registers.a = this._opSupport.Sub8Bit(this.registers.a, this.registers.b);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x91: {
                m: 'SUB C',
                f: () => {
                    this.registers.a = this._opSupport.Sub8Bit(this.registers.a, this.registers.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x92: {
                m: 'SUB D',
                f: () => {
                    this.registers.a = this._opSupport.Sub8Bit(this.registers.a, this.registers.d);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x93: {
                m: 'SUB E',
                f: () => {
                    this.registers.a = this._opSupport.Sub8Bit(this.registers.a, this.registers.e);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x94: {
                m: 'SUB H',
                f: () => {
                    this.registers.a = this._opSupport.Sub8Bit(this.registers.a, this.registers.h);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x95: {
                m: 'SUB L',
                f: () => {
                    this.registers.a = this._opSupport.Sub8Bit(this.registers.a, this.registers.l);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0x96: {
                m: 'SUB (HL)',
                f: () => {
                    this.registers.a = this._opSupport.Sub8Bit(this.registers.a, this.jsboy.memory.read(this.registers.hl));
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },

            0xA0: {
                m: 'AND B',
                f: () => {
                    this.registers.flags.n = this.registers.flags.c = 0;
                    this.registers.flags.h = 1;
                    this.registers.flags.z = !(this.registers.a &= this.registers.b);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xA1: {
                m: 'AND C',
                f: () => {
                    this.registers.flags.n = this.registers.flags.c = 0;
                    this.registers.flags.h = 1;
                    this.registers.flags.z = !(this.registers.a &= this.registers.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xA2: {
                m: 'AND D',
                f: () => {
                    this.registers.flags.n = this.registers.flags.c = 0;
                    this.registers.flags.h = 1;
                    this.registers.flags.z = !(this.registers.a &= this.registers.d);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xA3: {
                m: 'AND E',
                f: () => {
                    this.registers.flags.n = this.registers.flags.c = 0;
                    this.registers.flags.h = 1;
                    this.registers.flags.z = !(this.registers.a &= this.registers.e);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xA4: {
                m: 'AND H',
                f: () => {
                    this.registers.flags.n = this.registers.flags.c = 0;
                    this.registers.flags.h = 1;
                    this.registers.flags.z = !(this.registers.a &= this.registers.h);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xA5: {
                m: 'AND L',
                f: () => {
                    this.registers.flags.n = this.registers.flags.c = 0;
                    this.registers.flags.h = 1;
                    this.registers.flags.z = !(this.registers.a &= this.registers.l);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xA6: {
                m: 'AND (HL)',
                f: () => {
                    this.registers.flags.n = this.registers.flags.c = 0;
                    this.registers.flags.h = 1;
                    this.registers.flags.z = !(this.registers.a &= this.jsboy.memory.read(this.registers.hl));
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xA7: {
                m: 'AND A',
                f: () => {
                    this.registers.flags.n = this.registers.flags.c = 0;
                    this.registers.flags.h = 1;
                    this.registers.flags.z = !this.registers.a;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xA8: {
                m: 'XOR B',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.registers.b);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xA9: {
                m: 'XOR C',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.registers.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xAA: {
                m: 'XOR D',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.registers.d);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xAB: {
                m: 'XOR E',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.registers.e);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xAC: {
                m: 'XOR H',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.registers.h);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xAD: {
                m: 'XOR L',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.registers.l);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xAE: {
                m: 'XOR (HL)',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.jsboy.memory.read(this.registers.hl));
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xAF: {
                m: 'XOR A',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.registers.a);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },

            0xB0: {
                m: 'OR B',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a |= this.registers.b);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xB1: {
                m: 'OR C',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a |= this.registers.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xB2: {
                m: 'OR D',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a |= this.registers.d);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xB3: {
                m: 'OR E',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a |= this.registers.e);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xB4: {
                m: 'OR H',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a |= this.registers.h);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xB5: {
                m: 'OR L',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a |= this.registers.l);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xB6: {
                m: 'OR (HL)',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a |= this.jsboy.memory.read(this.registers.hl));
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xB7: {
                m: 'OR A',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a |= this.registers.a);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xB8: {
                m: 'CP B',
                f: () => {
                    this._opSupport.Sub8Bit(this.registers.a, this.registers.b);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xB9: {
                m: 'CP C',
                f: () => {
                    this._opSupport.Sub8Bit(this.registers.a, this.registers.c);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xBA: {
                m: 'CP D',
                f: () => {
                    this._opSupport.Sub8Bit(this.registers.a, this.registers.d);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xBB: {
                m: 'CP E',
                f: () => {
                    this._opSupport.Sub8Bit(this.registers.a, this.registers.e);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xBC: {
                m: 'CP H',
                f: () => {
                    this._opSupport.Sub8Bit(this.registers.a, this.registers.h);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xBD: {
                m: 'CP L',
                f: () => {
                    this._opSupport.Sub8Bit(this.registers.a, this.registers.l);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xBE: {
                m: 'CP (HL)',
                f: () => {
                    this._opSupport.Sub8Bit(this.registers.a, this.jsboy.memory.read(this.registers.hl));
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xBF: {
                m: 'CP A',
                f: () => {
                    this._opSupport.Sub8Bit(this.registers.a, this.registers.a);
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xC0: {
                m: 'RET NZ',
                f: () => {
                    if (!this.registers.flags.z) {
                        this.pc = this.jsboy.memory.readShort(this.sp);
                        this.sp += 2;
                    } else
                        this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xC1: {
                m: 'POP BC',
                f: () => {
                    this.registers.bc = this.jsboy.memory.readShort(this.sp);
                    this.sp += 2;
                    this.pc += 1;
                    return 12;
                },
                c: 12,
            },
            0xC2: {
                m: 'JP NZ, nn',
                f: () => {
                    if (!this.registers.flags.z)
                        this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    else
                        this.pc += 3;
                    return 12;
                },
                c: 12,
            },
            0xC3: {
                m: 'JP nn',
                f: () => {
                    this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    return 12;
                },
                c: 12,
            },
            0xC4: {
                m: 'CALL NZ, nn',
                f: () => {
                    if (!this.registers.flags.z) {
                        this.sp -= 2;
                        this.jsboy.memory.writeShort(this.sp, this.pc + 3);
                        this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    } else {
                        this.pc += 3;
                    }
                    return 12;
                },
                c: 12,
            },
            0xC5: {
                m: 'PUSH BC',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.registers.bc);
                    this.pc += 1;
                    return 16;
                },
                c: 16,
            },
            0xC6: {
                m: 'ADD A, n',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.jsboy.memory.read(this.pc + 1));
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0xC7: {
                m: 'RST 00',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.pc + 1);
                    this.pc = 0;
                    return 32;
                },
                c: 32,
            },
            0xC8: {
                m: 'RET Z',
                f: () => {
                    if (this.registers.flags.z) {
                        this.pc = this.jsboy.memory.readShort(this.sp);
                        this.sp += 2;
                    } else
                        this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xC9: {
                m: 'RET',
                f: () => {
                    this.pc = this.jsboy.memory.readShort(this.sp);
                    this.sp += 2;
                    return 8;
                },
                c: 8,
            },
            0xCA: {
                m: 'JP Z, nn',
                f: () => {
                    if (this.registers.flags.z)
                        this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    else
                        this.pc += 3;
                    return 12;
                },
                c: 12,
            },
            get 0xCB() {
                return this._extOps[this.jsboy.memory.read(++this.jsboy.cpu.pc)]
            },
            0xCC: {
                m: 'CALL Z, nn',
                f: () => {
                    if (this.registers.flags.z) {
                        this.sp -= 2;
                        this.jsboy.memory.writeShort(this.sp, this.pc + 3);
                        this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    } else {
                        this.pc += 3;
                    }
                    return 12;
                },
                c: 12,
            },
            0xCD: {
                m: 'CALL nn',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.pc + 3);
                    this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    return 12;
                },
                c: 12,
            },
            0xCE: {
                m: 'ADC A, n',
                f: () => {
                    this.registers.a = this._opSupport.Add8Bit(this.registers.a, this.jsboy.memory.read(this.pc + 1) + this.registers.flags.c);
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0xCF: {
                m: 'RST 08',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.pc + 1);
                    this.pc = 0x08;
                    return 32;
                },
                c: 32,
            },
            
            0xD0: {
                m: 'RET NC',
                f: () => {
                    if (!this.registers.flags.c) {
                        this.pc = this.jsboy.memory.readShort(this.sp);
                        this.sp += 2;
                    } else
                        this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xD1: {
                m: 'POP DE',
                f: () => {
                    this.registers.de = this.jsboy.memory.readShort(this.sp);
                    this.sp += 2;
                    this.pc += 1;
                    return 12;
                },
                c: 12,
            },
            0xD2: {
                m: 'JP NC, nn',
                f: () => {
                    if (!this.registers.flags.c)
                        this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    else
                        this.pc += 3;
                    return 12;
                },
                c: 12,
            },
            0xD4: {
                m: 'CALL NC, nn',
                f: () => {
                    if (!this.registers.flags.c) {
                        this.sp -= 2;
                        this.jsboy.memory.writeShort(this.sp, this.pc + 3);
                        this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    } else {
                        this.pc += 3;
                    }
                    return 12;
                },
                c: 12,
            },
            0xD5: {
                m: 'PUSH DE',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.registers.de);
                    this.pc += 1;
                    return 16;
                },
                c: 16,
            },
            0xD6: {
                m: 'SUB n',
                f: () => {
                    this.registers.a = this._opSupport.Sub8Bit(this.registers.a, this.jsboy.memory.read(this.pc + 1));
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0xD7: {
                m: 'RST 10',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.pc + 1);
                    this.pc = 0x10;
                    return 32;
                },
                c: 32,
            },
            0xD8: {
                m: 'RET C',
                f: () => {
                    if (this.registers.flags.c) {
                        this.pc = this.jsboy.memory.readShort(this.sp);
                        this.sp += 2;
                    } else
                        this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xD9: {
                m: 'RETI',
                f: () => {
                    this.pc = this.jsboy.memory.readShort(this.sp);
                    this.sp += 2;
                    this.jsboy.halted = false;
                    return 8;
                },
                c: 8,
            },
            0xDA: {
                m: 'JP C, nn',
                f: () => {
                    if (this.registers.flags.c)
                        this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    else
                        this.pc += 3;
                    return 12;
                },
                c: 12,
            },
            0xDC: {
                m: 'CALL C, nn',
                f: () => {
                    if (this.registers.flags.c) {
                        this.sp -= 2;
                        this.jsboy.memory.writeShort(this.sp, this.pc + 3);
                        this.pc = this.jsboy.memory.readShort(this.pc + 1);
                    } else {
                        this.pc += 3;
                    }
                    return 12;
                },
                c: 12,
            },
            0xDE: {
                m: 'SBC A, n',
                f: () => {
                    this.registers.a = this._opSupport.Sub8Bit(this.registers.a, this.jsboy.memory.read(this.pc + 1) + this.registers.flags.c);
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0xDF: {
                m: 'RST 18',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.pc + 1);
                    this.pc = 0x18;
                    return 32;
                },
                c: 32,
            },

            0xE0: {
                m: 'LDH (n), A',
                f: () => {
                    this.jsboy.memory.write(KNOWN_ADDRESSES.IOMemAddr + this.jsboy.memory.read(this.pc + 1), this.registers.a);
                    this.pc += 2;
                    return 12;
                },
                c: 12,
            },
            0xE1: {
                m: 'POP HL',
                f: () => {
                    this.registers.hl = this.jsboy.memory.readShort(this.sp);
                    this.sp += 2;
                    this.pc += 1;
                    return 12;
                },
                c: 12,
            },
            0xE2: {
                m: 'LDH (C), A',
                f: () => {
                    this.jsboy.memory.write(KNOWN_ADDRESSES.IOMemAddr + this.registers.c, this.registers.a);
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xE5: {
                m: 'PUSH HL',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.registers.hl);
                    this.pc += 1;
                    return 16;
                },
                c: 16,
            },
            0xE6: {
                m: 'AND n',
                f: () => {
                    this.registers.flags.n = this.registers.flags.c = 0;
                    this.registers.flags.h = 1;
                    this.registers.flags.z = !(this.registers.a &= this.jsboy.memory.read(this.pc + 1));
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0xE7: {
                m: 'RST 20',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.pc + 1);
                    this.pc = 0x20;
                    return 32;
                },
                c: 32,
            },
            0xE9: {
                m: 'JP (HL)',
                f: () => {
                    this.pc = this.registers.hl;
                    return 4;
                },
                c: 4,
            },
            0xEA: {
                m: 'LD (nn), A',
                f: () => {
                    this.jsboy.memory.write(this.jsboy.memory.readShort(this.pc + 1), this.registers.a);
                    this.pc += 3;
                    return 16;
                },
                c: 16,
            },
            0xEE: {
                m: 'XOR n',
                f: () => {
                    this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.jsboy.memory.read(this.pc + 1));
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0xEF: {
                m: 'RST 28',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.pc + 1);
                    this.pc = 0x28;
                    return 32;
                },
                c: 32,
            },
            0xF0: {
                m: 'LDH A, (n)',
                f: () => {
                    this.registers.a = this.jsboy.memory.read(KNOWN_ADDRESSES.IOMemAddr + this.jsboy.memory.read(this.pc + 1));
                    this.pc += 2;
                    return 12;
                },
                c: 12,
            },
            0xF1: {
                m: 'POP AF',
                f: () => {
                    this.registers.af = this.jsboy.memory.readShort(this.sp);
                    this.sp += 2;
                    this.pc += 1;
                    return 12;
                },
                c: 12,
            },
            0xF3: {
                m: 'DI',
                f: () => {
                    this.jsboy.ime = false;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xF5: {
                m: 'PUSH AF',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.registers.af);
                    this.pc += 1;
                    return 16;
                },
                c: 16,
            },
            0xF6: {
                m: 'OR n',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a |= this.jsboy.memory.read(this.pc + 1));
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0xF7: {
                m: 'RST 30',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.pc + 1);
                    this.pc = 0x30;
                    return 32;
                },
                c: 32,
            },
            0xF8: {
                m: 'LDHL SP, n',
                f: () => {
                    this.registers.hl = this._opSupport.Add16Bit(this.sp, this.jsboy.memory.read(this.pc + 1) << 24 >> 24);
                    this.pc += 2;
                    return 12;
                },
                c: 12,
            },
            0xF9: {
                m: 'LD SP, HL',
                f: () => {
                    this.sp = this.registers.hl;
                    this.pc += 1;
                    return 8;
                },
                c: 8,
            },
            0xFA: {
                m: 'LD A, (nn)',
                f: () => {
                    this.registers.a = this.jsboy.memory.read(this.jsboy.memory.readShort(this.pc + 1));
                    this.pc += 3;
                    return 16;
                },
                c: 16,
            },
            0xFB: {
                m: 'EI',
                f: () => {
                    this.jsboy._imePending = true;
                    this.pc += 1;
                    return 4;
                },
                c: 4,
            },
            0xFE: {
                m: 'CP n',
                f: () => {
                    this._opSupport.Sub8Bit(this.registers.a, this.jsboy.memory.read(this.pc + 1));
                    this.pc += 2;
                    return 8;
                },
                c: 8,
            },
            0xFF: {
                m: 'RST 38',
                f: () => {
                    this.sp -= 2;
                    this.jsboy.memory.writeShort(this.sp, this.pc + 1);
                    this.pc = 0x38;
                    return 32;
                },
                c: 32,
            },
            _extOps: {
                // #region RLC

                0x00: {
                    m: 'RLC B',
                    f: () => {
                        this.registers.b = this._opSupport.RotateLeft(this.registers.b);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x01: {
                    m: 'RLC C',
                    f: () => {
                        this.registers.c = this._opSupport.RotateLeft(this.registers.c);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x02: {
                    m: 'RLC D',
                    f: () => {
                        this.registers.d = this._opSupport.RotateLeft(this.registers.d);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x03: {
                    m: 'RLC E',
                    f: () => {
                        this.registers.e = this._opSupport.RotateLeft(this.registers.e);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x04: {
                    m: 'RLC H',
                    f: () => {
                        this.registers.h = this._opSupport.RotateLeft(this.registers.h);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x05: {
                    m: 'RLC L',
                    f: () => {
                        this.registers.l = this._opSupport.RotateLeft(this.registers.l);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x06: {
                    m: 'RLC (HL)',
                    f: () => {
                        this.jsboy.memory.write(this.registers.hl, this._opSupport.RotateLeft(this.jsboy.memory.read(this.registers.hl)));
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0x07: {
                    m: 'RLC A',
                    f: () => {
                        this.registers.a = this._opSupport.RotateLeft(this.registers.a);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region RRC

                0x08: {
                    m: 'RRC B',
                    f: () => {
                        this.registers.b = this._opSupport.RotateRight(this.registers.b);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x09: {
                    m: 'RRC C',
                    f: () => {
                        this.registers.c = this._opSupport.RotateRight(this.registers.c);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x0A: {
                    m: 'RRC D',
                    f: () => {
                        this.registers.d = this._opSupport.RotateRight(this.registers.d);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x0B: {
                    m: 'RRC E',
                    f: () => {
                        this.registers.e = this._opSupport.RotateRight(this.registers.e);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x0C: {
                    m: 'RRC H',
                    f: () => {
                        this.registers.h = this._opSupport.RotateRight(this.registers.h);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x0D: {
                    m: 'RRC L',
                    f: () => {
                        this.registers.l = this._opSupport.RotateRight(this.registers.l);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x0E: {
                    m: 'RRC B',
                    f: () => {
                        this.jsboy.memory.write(this.registers.hl, this._opSupport.RotateRight(this.jsboy.memory.read(this.registers.hl)));
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0x0F: {
                    m: 'RRC A',
                    f: () => {
                        this.registers.a = this._opSupport.RotateRight(this.registers.a);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region RL

                0x10: {
                    m: 'RL B',
                    f: () => {
                        this.registers.b = this._opSupport.RotateLeftThroughCarry(this.registers.b);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x11: {
                    m: 'RL C',
                    f: () => {
                        this.registers.c = this._opSupport.RotateLeftThroughCarry(this.registers.c);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x12: {
                    m: 'RL D',
                    f: () => {
                        this.registers.d = this._opSupport.RotateLeftThroughCarry(this.registers.d);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x13: {
                    m: 'RL E',
                    f: () => {
                        this.registers.e = this._opSupport.RotateLeftThroughCarry(this.registers.e);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x14: {
                    m: 'RL H',
                    f: () => {
                        this.registers.h = this._opSupport.RotateLeftThroughCarry(this.registers.h);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x15: {
                    m: 'RL L',
                    f: () => {
                        this.registers.l = this._opSupport.RotateLeftThroughCarry(this.registers.l);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x16: {
                    m: 'RL (HL)',
                    f: () => {
                        this.jsboy.memory.write(this.registers.hl, this._opSupport.RotateLeftThroughCarry(this.jsboy.memory.read(this.registers.hl)));
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0x17: {
                    m: 'RL A',
                    f: () => {
                        this.registers.a = this._opSupport.RotateLeftThroughCarry(this.registers.a);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region RR

                0x18: {
                    m: 'RR B',
                    f: () => {
                        this.registers.b = this._opSupport.RotateRightThroughCarry(this.registers.b);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x19: {
                    m: 'RR C',
                    f: () => {
                        this.registers.c = this._opSupport.RotateRightThroughCarry(this.registers.c);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x1A: {
                    m: 'RR D',
                    f: () => {
                        this.registers.d = this._opSupport.RotateRightThroughCarry(this.registers.d);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x1B: {
                    m: 'RR E',
                    f: () => {
                        this.registers.e = this._opSupport.RotateRightThroughCarry(this.registers.e);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x1C: {
                    m: 'RR H',
                    f: () => {
                        this.registers.h = this._opSupport.RotateRightThroughCarry(this.registers.h);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x1D: {
                    m: 'RR L',
                    f: () => {
                        this.registers.l = this._opSupport.RotateRightThroughCarry(this.registers.l);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x1E: {
                    m: 'RR (HL)',
                    f: () => {
                        this.jsboy.memory.write(this.registers.hl, this._opSupport.RotateRightThroughCarry(this.jsboy.memory.read(this.registers.hl)));
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0x1F: {
                    m: 'RR A',
                    f: () => {
                        this.registers.a = this._opSupport.RotateRightThroughCarry(this.registers.a);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region SLA

                0x20: {
                    m: 'SLA B',
                    f: () => {
                        this.registers.b = this._opSupport.ShiftLeftA(this.registers.b);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x21: {
                    m: 'SLA C',
                    f: () => {
                        this.registers.c = this._opSupport.ShiftLeftA(this.registers.c);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x22: {
                    m: 'SLA D',
                    f: () => {
                        this.registers.d = this._opSupport.ShiftLeftA(this.registers.d);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x23: {
                    m: 'SLA E',
                    f: () => {
                        this.registers.e = this._opSupport.ShiftLeftA(this.registers.e);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x24: {
                    m: 'SLA H',
                    f: () => {
                        this.registers.h = this._opSupport.ShiftLeftA(this.registers.h);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x25: {
                    m: 'SLA L',
                    f: () => {
                        this.registers.l = this._opSupport.ShiftLeftA(this.registers.l);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x26: {
                    m: 'SLA (HL)',
                    f: () => {
                        this.jsboy.memory.write(this._opSupport.ShiftLeftA(this.jsboy.memory.read(this.registers.hl)));
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0x27: {
                    m: 'SLA A',
                    f: () => {
                        this.registers.a = this._opSupport.ShiftLeftA(this.registers.a);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region SRA

                0x28: {
                    m: 'SRA B',
                    f: () => {
                        this.registers.b = this._opSupport.ShiftRightA(this.registers.b);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x29: {
                    m: 'SRA C',
                    f: () => {
                        this.registers.c = this._opSupport.ShiftRightA(this.registers.c);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x2A: {
                    m: 'SRA D',
                    f: () => {
                        this.registers.d = this._opSupport.ShiftRightA(this.registers.d);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x2B: {
                    m: 'SRA E',
                    f: () => {
                        this.registers.e = this._opSupport.ShiftRightA(this.registers.e);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x2C: {
                    m: 'SRA H',
                    f: () => {
                        this.registers.h = this._opSupport.ShiftRightA(this.registers.h);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x2D: {
                    m: 'SRA L',
                    f: () => {
                        this.registers.l = this._opSupport.ShiftRightA(this.registers.l);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x2E: {
                    m: 'SRA (HL)',
                    f: () => {
                        this.jsboy.memory.write(this._opSupport.ShiftRightA(this.jsboy.memory.read(this.registers.hl)));
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0x2F: {
                    m: 'SRA A',
                    f: () => {
                        this.registers.a = this._opSupport.ShiftRightA(this.registers.a);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region SWAP

                0x30: {
                    m: 'SWAP B',
                    f: () => {
                        this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                        this.registers.b = this.registers.b >> 4 | (this.registers.b & 0xF) << 4;
                        this.registers.flags.z = !this.registers.b;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x31: {
                    m: 'SWAP C',
                    f: () => {
                        this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                        this.registers.c = this.registers.c >> 4 | (this.registers.c & 0xF) << 4;
                        this.registers.flags.z = !this.registers.c;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x32: {
                    m: 'SWAP D',
                    f: () => {
                        this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                        this.registers.d = this.registers.d >> 4 | (this.registers.d & 0xF) << 4;
                        this.registers.flags.z = !this.registers.d;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x33: {
                    m: 'SWAP E',
                    f: () => {
                        this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                        this.registers.e = this.registers.e >> 4 | (this.registers.e & 0xF) << 4;
                        this.registers.flags.z = !this.registers.e;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x34: {
                    m: 'SWAP H',
                    f: () => {
                        this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                        this.registers.h = this.registers.h >> 4 | (this.registers.h & 0xF) << 4;
                        this.registers.flags.z = !this.registers.h;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x35: {
                    m: 'SWAP L',
                    f: () => {
                        this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                        this.registers.l = this.registers.l >> 4 | (this.registers.l & 0xF) << 4;
                        this.registers.flags.z = !this.registers.l;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x36: {
                    m: 'SWAP (HL)',
                    f: () => {
                        this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                        let v = this.jsboy.memory.read(this.registers.hl);
                        this.jsboy.memory.write(this.registers.hl, v >> 4 | (v & 0xF) << 4)
                        this.registers.flags.z = !v;
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0x37: {
                    m: 'SWAP A',
                    f: () => {
                        this.registers.flags.n = this.registers.flags.h = this.registers.flags.c = 0;
                        this.registers.a = this.registers.a >> 4 | (this.registers.a & 0xF) << 4;
                        this.registers.flags.z = !this.registers.a;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region SRL

                0x38: {
                    m: 'SRL B',
                    f: () => {
                        this.registers.b = this._opSupport.ShiftRightL(this.registers.b);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x39: {
                    m: 'SRL C',
                    f: () => {
                        this.registers.c = this._opSupport.ShiftRightL(this.registers.c);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x3A: {
                    m: 'SRL D',
                    f: () => {
                        this.registers.d = this._opSupport.ShiftRightL(this.registers.d);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x3B: {
                    m: 'SRL E',
                    f: () => {
                        this.registers.e = this._opSupport.ShiftRightL(this.registers.e);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x3C: {
                    m: 'SRL H',
                    f: () => {
                        this.registers.h = this._opSupport.ShiftRightL(this.registers.h);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x3D: {
                    m: 'SRL L',
                    f: () => {
                        this.registers.l = this._opSupport.ShiftRightL(this.registers.l);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x3E: {
                    m: 'SRL (HL)',
                    f: () => {
                        this.jsboy.memory.write(this.registers.hl, this._opSupport.ShiftRightL(this.jsboy.memory.read(this.registers.hl)));
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0x3F: {
                    m: 'SRL A',
                    f: () => {
                        this.registers.a = this._opSupport.ShiftRightL(this.registers.a);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region BIT 0

                0x40: {
                    m: 'BIT 0, B',
                    f: () => {
                        this._opSupport.Bit(this.registers.b, 0);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x41: {
                    m: 'BIT 0, C',
                    f: () => {
                        this._opSupport.Bit(this.registers.c, 0);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x42: {
                    m: 'BIT 0, D',
                    f: () => {
                        this._opSupport.Bit(this.registers.d, 0);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x43: {
                    m: 'BIT 0, E',
                    f: () => {
                        this._opSupport.Bit(this.registers.e, 0);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x44: {
                    m: 'BIT 0, H',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 0);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x45: {
                    m: 'BIT 0, L',
                    f: () => {
                        this._opSupport.Bit(this.registers.l, 0);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x46: {
                    m: 'BIT 0, (HL)',
                    f: () => {
                        this._opSupport.Bit(this.jsboy.memory.read(this.registers.hl), 0);
                        this.pc += 1;
                        return 12;
                    },
                    c: 12,
                },
                0x47: {
                    m: 'BIT 0, A',
                    f: () => {
                        this._opSupport.Bit(this.registers.a, 0);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region BIT 1

                0x48: {
                    m: 'BIT 1, B',
                    f: () => {
                        this._opSupport.Bit(this.registers.b, 1);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x49: {
                    m: 'BIT 1, C',
                    f: () => {
                        this._opSupport.Bit(this.registers.c, 1);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x4A: {
                    m: 'BIT 1, D',
                    f: () => {
                        this._opSupport.Bit(this.registers.d, 1);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x4B: {
                    m: 'BIT 1, E',
                    f: () => {
                        this._opSupport.Bit(this.registers.e, 1);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x4C: {
                    m: 'BIT 1, H',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 1);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x4D: {
                    m: 'BIT 1, L',
                    f: () => {
                        this._opSupport.Bit(this.registers.l, 1);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x4E: {
                    m: 'BIT 1, (HL)',
                    f: () => {
                        this._opSupport.Bit(this.jsboy.memory.read(this.registers.hl), 1);
                        this.pc += 1;
                        return 12;
                    },
                    c: 12,
                },
                0x4F: {
                    m: 'BIT 1, A',
                    f: () => {
                        this._opSupport.Bit(this.registers.a, 1);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region BIT 2

                0x50: {
                    m: 'BIT 2, B',
                    f: () => {
                        this._opSupport.Bit(this.registers.b, 2);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x51: {
                    m: 'BIT 2, C',
                    f: () => {
                        this._opSupport.Bit(this.registers.c, 2);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x52: {
                    m: 'BIT 2, D',
                    f: () => {
                        this._opSupport.Bit(this.registers.d, 2);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x53: {
                    m: 'BIT 2, E',
                    f: () => {
                        this._opSupport.Bit(this.registers.e, 2);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x54: {
                    m: 'BIT 2, H',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 2);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x55: {
                    m: 'BIT 2, L',
                    f: () => {
                        this._opSupport.Bit(this.registers.l, 2);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x56: {
                    m: 'BIT 2, (HL)',
                    f: () => {
                        this._opSupport.Bit(this.jsboy.memory.read(this.registers.hl), 2);
                        this.pc += 1;
                        return 12;
                    },
                    c: 12,
                },
                0x57: {
                    m: 'BIT 2, A',
                    f: () => {
                        this._opSupport.Bit(this.registers.a, 2);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region BIT 3

                0x58: {
                    m: 'BIT 3, B',
                    f: () => {
                        this._opSupport.Bit(this.registers.b, 3);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x59: {
                    m: 'BIT 3, C',
                    f: () => {
                        this._opSupport.Bit(this.registers.c, 3);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x5A: {
                    m: 'BIT 3, D',
                    f: () => {
                        this._opSupport.Bit(this.registers.d, 3);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x5B: {
                    m: 'BIT 3, E',
                    f: () => {
                        this._opSupport.Bit(this.registers.e, 3);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x5C: {
                    m: 'BIT 3, H',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 3);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x5D: {
                    m: 'BIT 3, L',
                    f: () => {
                        this._opSupport.Bit(this.registers.l, 3);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x5E: {
                    m: 'BIT 3, (HL)',
                    f: () => {
                        this._opSupport.Bit(this.jsboy.memory.read(this.registers.hl), 3);
                        this.pc += 1;
                        return 12;
                    },
                    c: 12,
                },
                0x5F: {
                    m: 'BIT 3, A',
                    f: () => {
                        this._opSupport.Bit(this.registers.a, 3);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region BIT 4

                0x60: {
                    m: 'BIT 4, B',
                    f: () => {
                        this._opSupport.Bit(this.registers.b, 2);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x61: {
                    m: 'BIT 4, C',
                    f: () => {
                        this._opSupport.Bit(this.registers.c, 4);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x62: {
                    m: 'BIT 4, D',
                    f: () => {
                        this._opSupport.Bit(this.registers.d, 4);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x63: {
                    m: 'BIT 4, E',
                    f: () => {
                        this._opSupport.Bit(this.registers.e, 4);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x64: {
                    m: 'BIT 4, H',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 4);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x65: {
                    m: 'BIT 4, L',
                    f: () => {
                        this._opSupport.Bit(this.registers.l, 4);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x66: {
                    m: 'BIT 4, (HL)',
                    f: () => {
                        this._opSupport.Bit(this.jsboy.memory.read(this.registers.hl), 4);
                        this.pc += 1;
                        return 12;
                    },
                    c: 12,
                },
                0x67: {
                    m: 'BIT 4, A',
                    f: () => {
                        this._opSupport.Bit(this.registers.a, 4);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region BIT 5

                0x68: {
                    m: 'BIT 5, B',
                    f: () => {
                        this._opSupport.Bit(this.registers.b, 5);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x69: {
                    m: 'BIT 5, C',
                    f: () => {
                        this._opSupport.Bit(this.registers.c, 5);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x6A: {
                    m: 'BIT 5, D',
                    f: () => {
                        this._opSupport.Bit(this.registers.d, 5);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x6B: {
                    m: 'BIT 5, E',
                    f: () => {
                        this._opSupport.Bit(this.registers.e, 5);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x6C: {
                    m: 'BIT 5, H',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 5);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x6D: {
                    m: 'BIT 5, L',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 5);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x6E: {
                    m: 'BIT 5, (HL)',
                    f: () => {
                        this._opSupport.Bit(this.jsboy.memory.read(this.registers.hl), 5);
                        this.pc += 1;
                        return 12;
                    },
                    c: 12,
                },
                0x6F: {
                    m: 'BIT 5, A',
                    f: () => {
                        this._opSupport.Bit(this.registers.a, 5);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region BIT 6

                0x70: {
                    m: 'BIT 6, B',
                    f: () => {
                        this._opSupport.Bit(this.registers.b, 6);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x71: {
                    m: 'BIT 6, C',
                    f: () => {
                        this._opSupport.Bit(this.registers.c, 6);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x72: {
                    m: 'BIT 6, D',
                    f: () => {
                        this._opSupport.Bit(this.registers.d, 6);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x73: {
                    m: 'BIT 6, E',
                    f: () => {
                        this._opSupport.Bit(this.registers.e, 6);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x74: {
                    m: 'BIT 6, H',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 6);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x75: {
                    m: 'BIT 6, L',
                    f: () => {
                        this._opSupport.Bit(this.registers.l, 6);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x76: {
                    m: 'BIT 6, (HL)',
                    f: () => {
                        this._opSupport.Bit(this.jsboy.memory.read(this.registers.hl), 6);
                        this.pc += 1;
                        return 12;
                    },
                    c: 12,
                },
                0x77: {
                    m: 'BIT 6, A',
                    f: () => {
                        this._opSupport.Bit(this.registers.a, 6);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region BIT 7

                0x78: {
                    m: 'BIT 7, B',
                    f: () => {
                        this._opSupport.Bit(this.registers.b, 7);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x79: {
                    m: 'BIT 7, C',
                    f: () => {
                        this._opSupport.Bit(this.registers.c, 7);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x7A: {
                    m: 'BIT 7, D',
                    f: () => {
                        this._opSupport.Bit(this.registers.d, 7);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x7B: {
                    m: 'BIT 7, E',
                    f: () => {
                        this._opSupport.Bit(this.registers.e, 7);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x7C: {
                    m: 'BIT 7, H',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 7);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x7D: {
                    m: 'BIT 7, L',
                    f: () => {
                        this._opSupport.Bit(this.registers.h, 7);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x7E: {
                    m: 'BIT 7, (HL)',
                    f: () => {
                        this._opSupport.Bit(this.jsboy.memory.read(this.registers.hl), 7);
                        this.pc += 1;
                        return 12;
                    },
                    c: 12,
                },
                0x7F: {
                    m: 'BIT 7, A',
                    f: () => {
                        this._opSupport.Bit(this.registers.a, 7);
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region RES 0

                0x80: {
                    m: 'RES 0, B',
                    f: () => {
                        this.registers.b &= ~1;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x81: {
                    m: 'RES 0, C',
                    f: () => {
                        this.registers.c &= ~1;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x82: {
                    m: 'RES 0, D',
                    f: () => {
                        this.registers.d &= ~1;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x83: {
                    m: 'RES 0, E',
                    f: () => {
                        this.registers.e &= ~1;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x84: {
                    m: 'RES 0, H',
                    f: () => {
                        this.registers.h &= ~1;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x85: {
                    m: 'RES 0, L',
                    f: () => {
                        this.registers.l &= ~1;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0x86: {
                    m: 'RES 0, (HL)',
                    f: () => {
                        this.jsboy.memory.write(this.registers.hl, this.jsboy.memory.read(this.registers.hl) & ~1);
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0x87: {
                    m: 'RES 0, A',
                    f: () => {
                        this.registers.a &= ~1;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region RES 7

                0xB8: {
                    m: 'RES 7, B',
                    f: () => {
                        this.registers.b &= ~0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xB9: {
                    m: 'RES 7, C',
                    f: () => {
                        this.registers.c &= ~0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xBA: {
                    m: 'RES 7, D',
                    f: () => {
                        this.registers.d &= ~0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xBB: {
                    m: 'RES 7, E',
                    f: () => {
                        this.registers.e &= ~0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xBC: {
                    m: 'RES 7, H',
                    f: () => {
                        this.registers.h &= ~0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xBD: {
                    m: 'RES 7, L',
                    f: () => {
                        this.registers.l &= ~0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xBE: {
                    m: 'RES 7, (HL)',
                    f: () => {
                        this.jsboy.memory.write(this.registers.hl, this.jsboy.memory.read(this.registers.hl) & ~0x80);
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0xBF: {
                    m: 'RES 7, A',
                    f: () => {
                        this.registers.a &= ~0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion

                // #region SET 5

                0xE8: {
                    m: 'SET 5, B',
                    f: () => {
                        this.registers.b |= 0x20;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xE9: {
                    m: 'SET 5, C',
                    f: () => {
                        this.registers.c |= 0x20;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xEA: {
                    m: 'SET 5, D',
                    f: () => {
                        this.registers.d |= 0x20;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xEB: {
                    m: 'SET 5, E',
                    f: () => {
                        this.registers.e |= 0x20;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xEC: {
                    m: 'SET 5, H',
                    f: () => {
                        this.registers.h |= 0x20;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xED: {
                    m: 'SET 5, L',
                    f: () => {
                        this.registers.l |= 0x20;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xEE: {
                    m: 'SET 5, (HL)',
                    f: () => {
                        this.jsboy.memory.write(this.registers.hl, this.jsboy.memory.read(this.registers.hl) | 0x20);
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0xEF: {
                    m: 'SET 5, A',
                    f: () => {
                        this.registers.a |= 0x20;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion
            
                // #region SET 7

                0xF8: {
                    m: 'SET 7, B',
                    f: () => {
                        this.registers.b |= 0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xF9: {
                    m: 'SET 7, C',
                    f: () => {
                        this.registers.c |= 0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xFA: {
                    m: 'SET 7, D',
                    f: () => {
                        this.registers.d |= 0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xFB: {
                    m: 'SET 7, E',
                    f: () => {
                        this.registers.e |= 0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xFC: {
                    m: 'SET 7, H',
                    f: () => {
                        this.registers.h |= 0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xFD: {
                    m: 'SET 7, L',
                    f: () => {
                        this.registers.l |= 0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },
                0xFE: {
                    m: 'SET 7, (HL)',
                    f: () => {
                        this.jsboy.memory.write(this.registers.hl, this.jsboy.memory.read(this.registers.hl) | 0x80);
                        this.pc += 1;
                        return 16;
                    },
                    c: 16,
                },
                0xFF: {
                    m: 'SET 7, A',
                    f: () => {
                        this.registers.a |= 0x80;
                        this.pc += 1;
                        return 8;
                    },
                    c: 8,
                },

                // #endregion
            
            },
        }
        this._opSupport = {
            RotateLeftThroughCarry: (value) => {
                this.registers.flags.n = this.registers.flags.h = 0;
                let c = this.registers.flags.c;
                this.registers.flags.c = value & 0x80;
                value = ((value << 1) | c) & 0xFF;
                this.registers.flags.z = !value;
                return value;
            },
            RotateRightThroughCarry: (value) => {
                this.registers.flags.n = this.registers.flags.h = 0;
                let c = this.registers.flags.c;
                this.registers.flags.c = value & 1;
                value = (value >> 1) | (c << 7);
                this.registers.flags.z = !value;
                return value;
            },
            RotateLeft: (value) => {
                this.registers.flags.n = this.registers.flags.h = 0;
                this.registers.flags.c = value & 0x80;
                value = ((value << 1) | this.registers.flags.c) & 0xFF;
                this.registers.flags.z = !value;
                return value;
            },
            RotateRight: (value) => {
                this.registers.flags.n = this.registers.flags.h = 0;
                this.registers.flags.c = value & 1;
                value = (value >> 1) | (this.registers.flags.c << 7);
                this.registers.flags.z = !value;
                return value;
            },
            
            Add8Bit: (a, b) => {
                this.registers.flags.n = 0; // Reset N
                let result = a + b; // SHORT result
                this.registers.flags.c = result & 0xFF00; // Set C if carry (> 8bit)
                this.registers.flags.z = !(result & 0xFF); // Set Z if zero
                this.registers.flags.h = (((result & 0x0F) + (b & 0x0F)) > 0x0F); // Set H if hcarry
                return result;
            },
            Add16Bit: (a, b) => {
                let prevZ = this.registers.flags.z;
                let finalResult = (a & 0xFF) + (b & 0xFF);
                finalResult = finalResult & 0xFF | (this._opSupport.Add8Bit(a >> 8, (b >> 8) + (finalResult >> 8)) << 8);
                this.registers.flags.z = prevZ;
                this.registers.flags.n = 0;
                return finalResult;
            },
            Sub8Bit: (a, b) => {
                this.registers.flags.n = 1; // Set N
                this.registers.flags.c = (b > a); // Set C if borrow
                this.registers.flags.h = ((b & 0x0f) > (a & 0x0f)); // Set H if hcarry
                let result = a - b;
                this.registers.flags.z = !(result & 0xFF); // Set Z if zero
                return result;
            },

            ShiftLeftA: (value) => {
                this.registers.flags.n = this.registers.flags.h = 0;
                this.registers.flags.c = (value & 0x80);
                this.registers.flags.z = !(value <<= 1);
                return value;
            },

            ShiftRightA: (value) => {
                this.registers.flags.n = this.registers.flags.h = 0;
                this.registers.flags.c = value & 1;
                value = (value & 0x80) | (value >> 1);
                this.registers.z = !value;
                return value;
            },

            ShiftRightL: (value) => {
                this.registers.flags.n = this.registers.flags.h = 0;
                this.registers.flags.c = value & 1;
                value >>= 1;
                this.registers.z = !value;
                return value;
            },

            Bit: (value, bit) => {
                this.registers.flags.z = !(value & (1 << bit));
                this.registers.flags.n = 0;
                this.registers.flags.h = 1;
            },
        }

        this._verbose = false;

        this.reset();

    }

    get sp() { return this._sp[0]; }
    set sp(value) { this._sp[0] = value; }

    /**
     * Clears the registers and flags
     */
    reset() {

        this.ime = false,
        this.registers.af = 0;
        this.registers.bc = 0;
        this.registers.de = 0;
        this.registers.hl = 0;
        this.sp = 0;
        this.pc = 0;
    }

    /**
     * Executes the passed opcode.
     * Autonomously takes the opcode's "parameters" from memory
     */
    execute() {

        this.pcPrev = this.pc;
        let opcode = this.jsboy.memory.read(this.pc);

        let op = this._ops[opcode];
        let cycles = 0;
        if (op) {
            cycles = op.f();
        } else {
            this.jsboy.status = EMULATOR_STATUS.pause;
            if (opcode === 0xCB) {
                this.pc--;
            }
        }

        if ((this.jsboy.status != EMULATOR_STATUS.play && this.jsboy.status != EMULATOR_STATUS.frame) || this._verbose)
            console.log(
                this.pcPrev.toString(16).padStart(4, 0),
                opcode.toString(16).padStart(2, 0) + ((opcode === 0xCB) ? ' ' + this.jsboy.memory.read(this.pcPrev + 1).toString(16).padStart(2, 0) : ''),
                op && op.m || 'UNK',
                `\t(new PC: ${this.pc.toString(16).padStart(4, 0)})`);

        return cycles;
    }

    get state() {
        return {
            i: this.ime,
            r: Array.from(this.registers._r),
            f: this.registers.f,
            p: this.pc,
            s: this.sp,
        };
    }

    set state(s) {
        this.ime = s.i;
        this.registers._r.set(s.r);
        this.registers.f = s.f;
        this.pc = s.p;
        this.sp = s.s;
    }
}