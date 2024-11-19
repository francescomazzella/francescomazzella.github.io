class GBoy extends ClassEventsES6 {
    constructor() {

        super();

        this._constants = {
            ROMBank0:  0x0100,
            IOMemAddr: 0xFF00,
        }

        // 0000-3FFF   16KB ROM Bank 00     (in cartridge, fixed at bank 00)
        // 4000-7FFF   16KB ROM Bank 01..NN (in cartridge, switchable bank number)
        // 8000-9FFF   8KB Video RAM (VRAM) (switchable bank 0-1 in CGB Mode)
        // A000-BFFF   8KB External RAM     (in cartridge, switchable bank, if any)
        // C000-CFFF   4KB Work RAM Bank 0 (WRAM)
        // D000-DFFF   4KB Work RAM Bank 1 (WRAM)  (switchable bank 1-7 in CGB Mode)
        // E000-FDFF   Same as C000-DDFF (ECHO)    (typically not used)
        // FE00-FE9F   Sprite Attribute Table (OAM)
        // FEA0-FEFF   Not Usable
        // FF00-FF7F   I/O Ports
        // FF80-FFFE   High RAM (HRAM)
        // FFFF        Interrupt Enable Register

        this._bios = [49,254,255,175,33,255,159,50,203,124,32,251,33,38,255,14,17,62,128,50,226,12,62,243,226,50,62,119,119,62,252,224,71,17,4,1,33,16,128,26,205,149,0,205,150,0,19,123,254,52,32,243,17,216,0,6,8,26,19,34,35,5,32,249,62,25,234,16,153,33,47,153,14,12,61,40,8,50,13,32,249,46,15,24,243,103,62,100,87,224,66,62,145,224,64,4,30,2,14,12,240,68,254,144,32,250,13,32,247,29,32,242,14,19,36,124,30,131,254,98,40,6,30,193,254,100,32,6,123,226,12,62,135,226,240,66,144,224,66,21,32,210,5,32,79,22,32,24,203,79,6,4,197,203,17,23,193,203,17,23,5,32,245,34,35,34,35,201,206,237,102,102,204,13,0,11,3,115,0,131,0,12,0,13,0,8,17,31,136,137,0,14,220,204,110,230,221,221,217,153,187,187,103,99,110,14,236,204,221,220,153,159,187,185,51,62,60,66,185,165,185,165,66,60,33,4,1,17,168,0,26,19,190,32,254,35,125,254,52,32,245,6,25,120,134,35,5,32,251,134,32,254,62,1,224,80];
        
        // #region OLD registers

        /*
        this.registers = {
            _r = new Uint8Array(8),
            get af() { return this._r[0] << 8 | this._r[7] },
            get bc() { return this._r[1] << 8 | this._r[2] },
            get de() { return this._r[3] << 8 | this._r[4] },
            get hl() { return this._r[5] << 8 | this._r[6] }
        }
        */
       /*
        this.registers = {
            _r: new Uint16Array(4),

            // GET

            // 8 bit
            get a() { return this._r[0] >> 8 },
            get f() { return this._r[0] & 0xFF }, // Zero, Underflow (Negative), Nibble Overflow (Half Carry), Byte Overflow (Carry)
            get b() { return this._r[1] >> 8 },
            get c() { return this._r[1] & 0xFF },
            get d() { return this._r[2] >> 8 },
            get e() { return this._r[2] & 0xFF },
            get h() { return this._r[3] >> 8 },
            get l() { return this._r[3] & 0xFF },

            // 16 bit
            get af() { return this._r[0] },
            get bc() { return this._r[1] },
            get de() { return this._r[2] },
            get hl() { return this._r[3] },
            
            // flags
            get zero() { return this._r[0] | 0x80 > 0 },

            // SET
            set a(value) { this._r[0] = value << 8 | this.f },
            set f(value) { this._r[0] = this.a << 8 | value },
            set b(value) { this._r[1] = value << 8 | this.c },
            set c(value) { this._r[1] = this.b << 8 | value },
            set d(value) { this._r[2] = value << 8 | this.e },
            set e(value) { this._r[2] = this.d << 8 | value },

            set de(value) { this._r[2] = value },
            set hl(value) { this._r[3] = value },

            set zero(value) {
                if (value) this._r[0] = this._r[0] | 0x80; // 0b0000000010000000
                else this._r[0] = this._r[0] & 0xFF7F; // 0b1111111101111111
            }
        }
        */

        // #endregion
       
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

        this.sp = 0, this.pc = 0;
        this.memory = new Uint8Array(0xFFFF);
        this.interrupts = true;

        this._breakpoints = [];
        this._skipBreakpoint = false;

        this._raf, this.turbo;

        this._ops = {
            0x00: {
                m: '',
                f: () => {
                    
                },
                c: 0,
            },
            0x00: {
                m: 'NOP',
                f: () => {
                    this.pc += 1;
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
                },
                c: 4,
            },
            0x06: {
                m: 'LD B, n',
                f: () => {
                    this.registers.b = this.memory[this.pc + 1];
                    this.pc += 2;
                },
                c: 8,
            },
            0x08: {
                m: 'LD (nn), SP',
                f: () => {
                    // TODO: CHECK!!
                    let dst = this.memory[this.pc + 2] << 8 | this.memory[this.pc + 1];
                    this.memory[dst] = this.registers.sp >> 8;
                    this.memory[dst + 1] = this.registers.sp & 0xFF;
                    this.pc += 2;
                },
                c: 20,
            },
            0x0C: {
                m: 'INC C',
                f: () => {
                    this.registers.flags.h = !(this.registers.c & 0x0F);
                    ++this.registers.c;
                    this.registers.flags.z = !(this.registers.c);
                    this.registers.flags.n = 0;
                    this.pc += 1;
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
                },
                c: 4,
            },
            0x0E: {
                m: 'LD C, n',
                f: () => {
                    this.registers.c = this.memory[this.pc + 1];
                    this.pc += 2;
                },
                c: 8,
            },
            0x11: {
                m: 'LD DE, nn',
                f: () => {
                    this.registers.de = this.memory[this.pc + 2] << 8 | this.memory[this.pc + 1];
                    this.pc += 3;
                },
                c: 12,
            },
            0x13: {
                m: 'INC DE',
                f: () => {
                    this.registers.de++;
                    this.pc += 1;
                }
            },
            0x17: {
                m: 'RL A',
                f: () => {
                    this.registers.a = this._opSupport.RotateLeftWithCarry(this.registers.a);
                    this.pc += 1;
                },
                c: 8,
            },
            0x1A: {
                m: 'LD A, (DE)',
                f: () => {
                    this.registers.a = this.memory[this.registers.de];
                    this.pc += 1;
                },
                c: 8,
            },
            0x20: {
                m: 'JR NZ, n',
                f: () => {
                    if (!this.registers.flags.z)
                        this.pc += (this.memory[this.pc + 1] << 24 >> 24);
                    this.pc += 2;
                },
                c: 8,
            },
            0x21: {
                m: 'LD HL, nn',
                f: () => {
                    this.registers.hl = this.memory[this.pc + 2] << 8 | this.memory[this.pc + 1];
                    this.pc += 3;
                },
                c: 12,
            },
            0x22: {
                m: 'LDI (HL), A',
                f: () => {
                    this.memory[this.registers.hl++] = this.registers.a;
                    this.pc += 1;
                },
                c: 8,
            },
            0x23: {
                m: 'INC HL',
                f: () => {
                    this.registers.hl++;
                    this.pc += 1;
                },
                c: 8,
            },
            0x31: {
                m: 'LD SP, nn',
                f: () => {
                    this.sp = this.memory[this.pc + 2] << 8 | this.memory[this.pc + 1];
                    this.pc += 3;
                },
                c: 12,
            },
            0x32: {
                m: 'LDD (HL), A',
                f: () => {
                    this.memory[this.registers.hl--] = this.registers.a;
                    this.pc += 1;
                },
                c: 8,
            },
            0x3E: {
                m: 'LD A, n',
                f: () => {
                    this.registers.a = this.memory[this.pc + 1];
                    this.pc += 2;
                },
                c: 8,
            },
            0x4F: {
                m: 'LD C, A',
                f: () => {
                    this.registers.c = this.registers.a;
                    this.pc += 1;
                },
                c: 4,
            },
            0x77: {
                m: 'LD (HL), A',
                f: () => {
                    this.memory[this.registers.hl] = this.registers.a;
                    this.pc += 1;
                },
                c: 8,
            },
            0xAF: {
                m: 'XOR A',
                f: () => {
                    this.registers.f = 0;
                    this.registers.flags.z = !(this.registers.a ^= this.registers.a);
                    this.pc += 1;
                },
                c: 4,
            },

            0xC1: {
                m: 'POP BC',
                f: () => {
                    this.registers.c = this.memory[this.sp];
                    this.registers.b = this.memory[this.sp + 1];
                    this.sp += 2;
                    this.pc += 1;
                },
                c: 12,
            },
            0xC3: {
                m: 'JP nn',
                f: () => {
                    this.pc = this.memory[this.pc + 2] << 8 | this.memory[this.pc + 1];
                },
                c: 12,
            },
            0xC5: {
                m: 'PUSH BC',
                f: () => {
                    this.memory[this.sp - 1] = this.registers.b;
                    this.memory[this.sp - 2] = this.registers.c;
                    this.sp -= 2;
                    this.pc += 1;
                },
                c: 16,
            },
            0xCB: {
                m: 'EXT',
                f: () => {
                    let opcode = this.memory[++this.pc];
                    let op = this._extOps[opcode];
                    op.f();

                    console.log(opcode.toString(16), op.m);
                },
                get c() { return this._extOps[this.memory[++this.pc]].c },
            },
            0xCD: {
                m: 'CALL nn',
                f: () => {
                    this.memory[this.sp - 1] = this.pc >> 8;
                    this.memory[this.sp - 2] = this.pc & 0xFF;
                    this.pc = this.memory[this.pc + 2] << 8 | this.memory[this.pc + 1];
                    this.sp -= 2;
                },
                c: 12,
            },

            0xE0: {
                m: 'LDH (n), A',
                f: () => {
                    this.memory[this.memory[this.pc + 1] + this._constants.IOMemAddr] = this.registers.a;
                    this.pc += 2;
                },
                c: 12,
            },
            0xE2: {
                m: 'LDH (C), A',
                f: () => {
                    this.memory[this.registers.c + this._constants.IOMemAddr] = this.registers.a;
                    this.pc += 1;
                },
                c: 8,
            },
            0xF0: {
                m: 'LDH A, (n)',
                f: () => {
                    this.registers.a = this.memory[this.memory[this.pc + 1] + this._constants.IOMemAddr];
                    this.pc += 2;
                },
                c: 12,
            },
            0xF3: {
                m: 'DI',
                f: () => {
                    console.log('TODO: DISABLE INTERRUPTS');
                    this.pc += 1;
                },
                c: 4,
            },
            0xFB: {
                m: 'EI',
                f: () => {
                    console.log('TODO: ENABLE INTERRUPTS');
                    this.pc += 1;
                },
                c: 4,
            },
            0xFE: {
                m: 'CP n',
                f: () => {
                    let n = this.memory[this.pc + 1];
                    this.registers.flags.z = !(this.registers.a - n);
                    this.registers.flags.n = 1;
                    this.registers.flags.h = (n & 0x0F) > (this.registers.a & 0x0F);
                    this.registers.flags.c = n > this.registers.a;
                    this.pc += 2;
                },
                c: 8,
            },
            0xFF: {
                m: 'RST 38',
                f: () => {
                    this.memory[this.sp - 1] = this.pc >> 8;
                    this.memory[this.sp - 2] = this.pc & 0xFF;
                    this.pc = 0x38;
                    this.sp -= 2;
                },
                c: 32,
            },
        }


        this._extOps = {
            0x11: {
                m: 'RL C',
                f: () => {
                    this.registers.c = this._opSupport.RotateLeftWithCarry(this.registers.c);
                    this.pc += 1;
                },
                c: 8,
            },
            0x7C: {
                m: 'BIT 7, H',
                f: () => {
                    this.registers.flags.z = !(this.registers.h >> 7);
                    this.registers.flags.n = 0;
                    this.registers.flags.h = 1;
                    this.pc += 1;
                },
                c: 8,
            },
        }

        this._opSupport = {
            RotateLeftWithCarry: (value) => {
                this.registers.flags.n = this.registers.flags.h = 0;

                let c = this.registers.flags.c;
                this.registers.flags.c = value >> 7;

                value = value << 1 & 0xFF | c;
                this.registers.flags.z = !value;

                return value;
            }
        }

        this.reset();
    }

    reset(bios = true) {

        this.looping = false;

        if (bios) {

            this.memory.set(this._bios);

            this.sp = 0x0000;
            this.pc = 0x0000;

        } else {

            this.registers.af = 0x01B0;
            this.registers.bc = 0x0013;
            this.registers.de = 0x00D8;
            this.registers.hl = 0x014D;
            this.sp = 0xFFFE;

            this.memory[0xFF05] = 0x00;
            this.memory[0xFF06] = 0x00;
            this.memory[0xFF07] = 0x00;
            this.memory[0xFF10] = 0x80;
            this.memory[0xFF11] = 0xBF;
            this.memory[0xFF12] = 0xF3;
            this.memory[0xFF14] = 0xBF;
            this.memory[0xFF16] = 0x3F;
            this.memory[0xFF17] = 0x00;
            this.memory[0xFF19] = 0xBF;
            this.memory[0xFF1A] = 0x7F;
            this.memory[0xFF1B] = 0xFF;
            this.memory[0xFF1C] = 0x9F;
            this.memory[0xFF1E] = 0xBF;
            this.memory[0xFF20] = 0xFF;
            this.memory[0xFF21] = 0x00;
            this.memory[0xFF22] = 0x00;
            this.memory[0xFF23] = 0xBF;
            this.memory[0xFF24] = 0x77;
            this.memory[0xFF25] = 0xF3;
            this.memory[0xFF26] = 0xF1;
            this.memory[0xFF40] = 0x91;
            this.memory[0xFF42] = 0x00;
            this.memory[0xFF43] = 0x00;
            this.memory[0xFF45] = 0x00;
            this.memory[0xFF47] = 0xFC;
            this.memory[0xFF48] = 0xFF;
            this.memory[0xFF49] = 0xFF;
            this.memory[0xFF4A] = 0x00;
            this.memory[0xFF4B] = 0x00;
            this.memory[0xFFFF] = 0x00;

            this.pc = 0x0000;
        }


        this.memory.set(TETRIS);

    }

    cycle(self = this) {

        if (!this._skipBreakpoint) {
            if (this._breakpoints.length) {
                for (let b of this._breakpoints) {
                    if (this.pc === b.index && !b.condition ||
                        this.pc === b.index && b.condition) {
                        this.looping = false;
                        this._skipBreakpoint = true;
                        return;
                    }
                }
            }
        } else {
            this._skipBreakpoint = false;
        }

        let lastPC = self.pc;

        let opcode = self.memory[self.pc];
        let op = self._ops[opcode];
        try {
            op.f();
        } catch (e) {
            console.error(e);
            self.looping = false;
        }

        console.log(lastPC.toString(16).padStart(4, 0), opcode.toString(16).padStart(2, 0), op && op.m || 'UNK', '\t(new PC:', self.pc.toString(16).padStart(4, 0), ')');

        if (self.looping) {
            if (!self.turbo) {
                self._raf = requestAnimationFrame(() => self.cycle(self));
            } else {
                setZeroTimeout(() => self.cycle(self));
            }
        }

        self.trigger('cycle');

    }

    play() {
        this.looping = !this.looping;
        if (this.looping) {
            this._raf = requestAnimationFrame(() => this.cycle(this));
        } else {
            cancelAnimationFrame(this._raf);
        }
    }

    step() {
        if (this.looping) {
            this.looping = false;
        } else {
            this._raf = requestAnimationFrame(() => this.cycle(this));
        }
    }

    exportState() {
        let result = {
            r: Array.from(this.registers._r),
            f: this.registers.f,
            p: this.pc,
            s: this.sp,
            m: Array.from(this.memory)
        }
        return result;
    }

    importState(o) {
        this.reset(false);
        this.registers._r.set(o.r);
        this.registers.f = o.f;
        this.pc = o.p;
        this.sp = o.s;
        this.memory.set(o.m);
    }

}