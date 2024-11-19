const CARTRIDGE_CONFIGURATION = {
    compatibility: {
        cgb: {
            0x80: true,
            0x00: false,
        },
        sgb: {
            0x00: false,
            0x03: true,
        },
    },
    type: {
        0x00: { name: 'ROM ONLY', mbc: 0,  },
        0x01: { name: 'ROM+MBC1', mbc: 1, },
        0x02: { name: 'ROM+MBC1+RAM', mbc: 1, },
        0x03: { name: 'ROM+MBC1+RAM+BATTERY', mbc: 1, },
        0x05: { name: 'ROM+MBC2', mbc: 2, },
        0x06: { name: 'ROM+MBC2+BATTERY', mbc: 2, },
        0x08: { name: 'ROM+RAM', mbc: 0, },
        0x09: { name: 'ROM+RAM+BATTERY', mbc: 0, },
        0x0B: { name: 'ROM+MMM01', mbc: 0, },
        0x0C: { name: 'ROM+MMM01+SRAM', mbc: 0, },
        0x0D: { name: 'ROM+MMM01+SRAM+BATTERY', mbc: 0, },
        0x0F: { name: 'ROM+MBC3+TIMER+BATTERY', mbc: 3, },
        0x10: { name: 'ROM+MBC3+TIMER+RAM+BATTERY', mbc: 3, },
        0x11: { name: 'ROM+MBC3', mbc: 3, },
        0x12: { name: 'ROM+MBC3+RAM', mbc: 3, },
        0x13: { name: 'ROM+MBC3+RAM+BATTERY', mbc: 3, },
        0x19: { name: 'ROM+MBC5', mbc: 5, },
        0x1A: { name: 'ROM+MBC5+RAM', mbc: 5, },
        0x1B: { name: 'ROM+MBC5+RAM+BATTERY', mbc: 5, },
        0x1C: { name: 'ROM+MBC5+RUMBLE', mbc: 5, },
        0x1D: { name: 'ROM+MBC5+RUMBLE+SRAM', mbc: 5, },
        0x1E: { name: 'ROM+MBC5+RUMBLE+SRAM+BATTERY', mbc: 5, },
        0x1F: { name: 'POCKET CAMERA', mbc: 0, },
        0xFD: { name: 'BANDAI TAMA5', mbc: 0, },
        0xFE: { name: 'HuC3', mbc: 0, },
        0xFF: { name: 'HuC1+RAM+BATTERY', mbc: 0, },
    },
    rom: {
        0x00: { size:    0x8000, },
        0x01: { size:   0x10000, },
        0x02: { size:   0x20000, },
        0x03: { size:   0x40000, },
        0x04: { size:   0x80000, },
        0x05: { size:  0x100000, },
        0x06: { size:  0x200000, },
        0x52: { size:  0x120000, },
        0x53: { size:  0x140000, },
        0x54: { size:  0x180000, },
    },
    ram: {
        0x0: { size:     0x0 },
        0x1: { size:  0x1000 },
        0x2: { size:  0x2000 },
        0x3: { size:  0x8000 },
        0x4: { size: 0x20000 },
    },
    destination: {
        0x0: 'Japan',
        0x1: 'World',
    },
}

class Memory {
    
    // #region Memory Structure Info

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

    // #endregion

    /**
     * Creates a new Memory module for the emulator
     * @param {JSBoy} jsboy emulation core
     * @param {Uint8Array} rom ROM data to be loaded
     */
    constructor(jsboy, rom = undefined) {

        this.jsboy = jsboy;

        this._bios = [49,254,255,175,33,255,159,50,203,124,32,251,33,38,255,14,17,62,128,50,226,12,62,243,226,50,62,119,119,62,252,224,71,17,4,1,33,16,128,26,205,149,0,205,150,0,19,123,254,52,32,243,17,216,0,6,8,26,19,34,35,5,32,249,62,25,234,16,153,33,47,153,14,12,61,40,8,50,13,32,249,46,15,24,243,103,62,100,87,224,66,62,145,224,64,4,30,2,14,12,240,68,254,144,32,250,13,32,247,29,32,242,14,19,36,124,30,131,254,98,40,6,30,193,254,100,32,6,123,226,12,62,135,226,240,66,144,224,66,21,32,210,5,32,79,22,32,24,203,79,6,4,197,203,17,23,193,203,17,23,5,32,245,34,35,34,35,201,206,237,102,102,204,13,0,11,3,115,0,131,0,12,0,13,0,8,17,31,136,137,0,14,220,204,110,230,221,221,217,153,187,187,103,99,110,14,236,204,221,220,153,159,187,185,51,62,60,66,185,165,185,165,66,60,33,4,1,17,168,0,26,19,190,32,254,35,125,254,52,32,245,6,25,120,134,35,5,32,251,134,32,254,62,1,224,80];

        this.rom = {
            /** @type {Uint8Array} The actual ROM data */
            data: undefined,
            header: {
                title: undefined,
                cgb: undefined,
                licensee: undefined,
                sgb: undefined,
                type: undefined,
                size: undefined,
                ram: undefined,
                destination: undefined,
                mask: undefined,
                headerChecksum: undefined,
                checksum: undefined,
            },
        };

        this._romBank = 1;
        this._ramBank = 0;
        this._mbcMode = 0;
        this._eramEnable = 0;

        this._vram = new Uint8Array(0x2000);
        this._wram = new Uint8Array(0x2000);
        this._oam  = new Uint8Array(0x100);
        this._io   = new Uint8Array(0x100);
        this._hram = new Uint8Array(0x80);
        this._ie   = new Uint8Array(0x1);
        this._eram;

        rom && this.loadRom(rom);
    }

    get state() {
        return {
            r: {
                d: Array.from(this.rom.data),
                h: JSON.stringify(this.rom.header),
            },
            v: Array.from(this._vram),
            w: Array.from(this._wram),
            o: Array.from(this._oam),
            i: Array.from(this._io),
            h: Array.from(this._hram),
            e: Array.from(this._eram),
            t: this._ie[0],
            s: {
                b: this._romBank,
                r: this._ramBank,
                m: this._mbcMode,
                e: this._eramEnable,
            }
        }
    }

    set state(s) {
        this.rom.data.set(s.r.d);
        this.rom.header = JSON.parse(s.r.h);

        this._vram.set(s.v);
        this._wram.set(s.w);
        this._oam .set(s.o);
        this._io  .set(s.i);
        this._hram.set(s.h);
        this._eram.set(s.e);
        this._ie[0] = s.t;

        this._romBank = s.s.b;
        this._ramBank = s.s.r;
        this._mbcMode = s.s.m;
        this._eramEnable = s.s.e;
    }

    loadRom(rom, patches = true) {

        this.rom.data = new Uint8Array(rom);

        // #region Header

        // Title
        this.rom.header.title = String.fromCharCode.apply(String, rom.slice(0x134, 0x143)).replace(/[^\x20-\x7E]+/g,'');
        // CGB
        this.rom.header.cgb = CARTRIDGE_CONFIGURATION.compatibility.cgb[rom[0x143]] || false;
        // Licensee Code
        this.rom.header.licensee = rom[0x14B] != 0x33 ? rom[0x14B] : String.fromCharCode.apply(String, rom.slice(0x144, 0x146));
        // SGB
        this.rom.header.sgb = CARTRIDGE_CONFIGURATION.compatibility.sgb[rom[0x146]] || false;
        // Cartridge Type
        this.rom.header.type = CARTRIDGE_CONFIGURATION.type[rom[0x147]];
        // ROM Size
        this.rom.header.size = CARTRIDGE_CONFIGURATION.rom[rom[0x148]] && CARTRIDGE_CONFIGURATION.rom[rom[0x148]].size;
        // RAM Size
        this.rom.header.ram = CARTRIDGE_CONFIGURATION.ram[rom[0x149]] && CARTRIDGE_CONFIGURATION.ram[rom[0x149]].size;
        // Destination
        this.rom.header.destination = CARTRIDGE_CONFIGURATION.destination[rom[0x14A]] || 'Unknown';
        // ROM Version Mask
        this.rom.header.mask = rom[0x14C];
        // Header Checksum
        this.rom.header.headerChecksum = rom[0x14D];
        // Global Checksum
        this.rom.header.checksum = rom[0x14E] << 8 | rom[0x14F];

        // #endregion

        this._eram = new Uint8Array(this.rom.header.ram);

        patches && this.applyPatches();

    }

    applyPatches() {
        switch (this.rom.header.title) {
            case 'TETRIS':
                // Replaces JR Z, n at address 0x02F0 with a HALT
                // as a timing problem keeps the game go past the
                // copyright screen
                this.rom.data[0x02F0] = 0x76;
                break;
        }
    }

    write(address, data) {

        if (this.jsboy.memory.rom.header.title == 'TETRIS' && address == 0xFF80)
            return;

        if (address < 0x8000) {
            // MBC
            this._handleBanking(address, data);
        } else if (address >= 0x8000 && address < 0xA000) {
            // VRAM
            this._vram[address - 0x8000] = data;
            // if (address < 0x9800)
            //     this.jsboy.gpu.updateTile(address);
        } else if (address >= 0xA000 && address < 0xC000) {
            // External RAM
            if (this._eramEnable)
                this._eram[(address - 0xA000) + (0x2000 * this._ramBank)] = (this.rom.header.type.mbc === 2 ? (data | 0xFF) : data);
        } else if (address >= 0xC000 && address < 0xE000) {
            // WRAM
            this._wram[address - 0xC000] = data;
        } else if (address >= 0xE000 && address < 0xFE00) {
            // ECHO
            this._wram[address - 0xE000] = data;
        } else if (address >= 0xFE00 && address < 0xFEA0) {
            // OAM
            this._oam[address - 0xFE00] = data;
        } else if (address >= 0xFEA0 && address < 0xFF00) {
            // Reserved
        } else if (address >= 0xFF00 && address < 0xFF80) {
            // IO
            this._handleIOWrite(address, data);
        } else if (address >= 0xFF80 && address < 0xFFFF) {
            // HRAM
            this._hram[address - 0xFF80] = data;
        } else {
            // IE Register
            this._ie[0] = data;
        }
    }

    writeShort(address, data) {
        this.write(address, data & 0xFF);
        this.write(address + 1, data >> 8);
    }

    read(address) {
        if (this.jsboy._biosMode && address < this._bios.length) {
            return this._bios[address];
        } else

        if (address < 0x8000) {
            // ROM
            if (address < 0x4000) {
                // Bank 00
                return this.rom.data[address];
            } else {
                // Bank NN
                return this.rom.data[address - 0x4000 + (0x4000 * (this._romBank || 1))];
            }
        } else if (address >= 0x8000 && address < 0xA000) {
            // VRAM
            return this._vram[address - 0x8000];
        } else if (address >= 0xA000 && address < 0xC000) {
            // External WRAM
            return this._eramEnable ? this._eram[(address - 0xA000) + (0x2000 * this._ramBank)] : 0;
        } else if (address >= 0xC000 && address < 0xE000) {
            // WRAM
            return this._wram[address - 0xC000];
        } else if (address >= 0xE000 && address < 0xFE00) {
            // ECHO
            return this._wram[address - 0xE000];
        } else if (address >= 0xFE00 && address < 0xFEA0) {
            // OAM
            return this._oam[address - 0xFE00];
        } else if (address >= 0xFEA0 && address < 0xFF00) {
            // Reserved
        } else if (address >= 0xFF00 && address < 0xFF80) {
            // IO
            return this._handleIORead(address);
        } else if (address >= 0xFF80 && address < 0xFFFF) {
            // HRAM
            return this._hram[address - 0xFF80];
        } else if (address === 0xFFFF) {
            // IE Register
            return this._ie[0];
        }
        return 0xFF;
    }

    readShort(address) {
        return this.read(address + 1) << 8 | this.read(address);
    }

    reset() {
        
        this._romBank = 1;
        this._ramBank = 0;
        this._mbcMode = 0;
        this._eramEnable = 0;

        this._vram = new Uint8Array(0x2000);
        this._wram = new Uint8Array(0x2000);
        this._oam  = new Uint8Array(0x100);
        this._io   = new Uint8Array(0x100);
        this._hram = new Uint8Array(0x80);
        this._ie   = new Uint8Array(0x1);
        this._eram;

    }

    _handleBanking(address, data) {
        if (address < 0x2000) {
            // RAM Enable
            if (this.rom.header.type.mbc === 2 && (address & 0b100000000))
                return;
            this._eramEnable = data === 0xA;
        } else if (address >= 0x2000 && address < 0x4000) {
            // ROM Bank Select
            if (this.rom.header.type.mbc === 1) {
                // MBC1
                this._romBank = (data | this._romBank & 0b01100000) || 1;
            } else if (this.rom.header.type.mbc === 2 && address & 0b100000000) {
                // MBC2
                this._romBank = (data & 0xF) || 1;
            }
        } else if (address >= 0x4000 && address < 0x6000) {
            if (this._mbcMode === 0) {
                // 16/8 mode => ROM Bank Select MSB (bits 5-6)
                this._romBank = (data & 0b11 << 5) | (this._romBank & 0b11111)
            } else {
                // 4/32 mode => RAM Bank Select
                this._ramBank = data & 0b11;
            }
        } else {
            // MBC Mode Select
            this._mbcMode = data & 0b1;
        }
    }

    _handleIOWrite(address, data) {
        switch (address) {
            // DIV
            case 0xFF04:
                this._io[address - 0xFF00] = 0;
                return;

            // SQUARE W/ SWEEP Channel 1
            // NR10
            case 0xFF10:
                this.jsboy.papu.channel1.registers.NR10.value = data;
                return;
            // NR11
            case 0xFF11:
                this.jsboy.papu.channel1.registers.NR11.value = data;
                return;
            // NR12
            case 0xFF12:
                this.jsboy.papu.channel1.registers.NR12.value = data;
                return;
            // NR13
            case 0xFF13:
                this.jsboy.papu.channel1.registers.NR13.value = data;
                return;
            // NR14
            case 0xFF14:
                this.jsboy.papu.channel1.registers.NR14.value = data;
                return;

            // SQUARE Channel 2
            // NR20 UNUSED
            case 0xFF15:
                return;
            // NR21
            case 0xFF16:
                this.jsboy.papu.channel2.registers.NR21.value = data;
                return;
            // NR22
            case 0xFF17:
                this.jsboy.papu.channel2.registers.NR22.value = data;
                return;
            // NR23
            case 0xFF18:
                this.jsboy.papu.channel2.registers.NR23.value = data;
                return;
            // NR24
            case 0xFF19:
                this.jsboy.papu.channel2.registers.NR24.value = data;
                return;

            // WAVE Channel 3
            // NR30
            case 0xFF1A:
                this.jsboy.papu.channel3.registers.NR30.value = data;
                return;
            // NR31
            case 0xFF1B:
                this.jsboy.papu.channel3.registers.NR31.value = data;
                return;
            // NR32
            case 0xFF1C:
                this.jsboy.papu.channel3.registers.NR32.value = data;
                return;
            // NR33
            case 0xFF1D:
                this.jsboy.papu.channel3.registers.NR33.value = data;
                return;
            // NR34
            case 0xFF1E:
                this.jsboy.papu.channel3.registers.NR34.value = data;
                return;

            // NOISE Channel 4
            // NR40 UNUSED
            case 0xFF1F:
                return;
            // NR41
            case 0xFF20:
                this.jsboy.papu.channel4.registers.NR41.value = data;
                return;
            // NR42
            case 0xFF21:
                this.jsboy.papu.channel4.registers.NR42.value = data;
                return;
            // NR43
            case 0xFF22:
                this.jsboy.papu.channel4.registers.NR43.value = data;
                return;
            // NR44
            case 0xFF23:
                this.jsboy.papu.channel4.registers.NR44.value = data;
                return;

            // NR50
            case 0xFF24:
                this.jsboy.papu.registers.NR50.value = data;
                return;
            // NR51
            case 0xFF25:
                this.jsboy.papu.registers.NR51.value = data;
                return;
            // NR52
            case 0xFF26:
                this.jsboy.papu.registers.NR52.value = data;
                return;

            // LCDC
            case 0xFF40:
                this.jsboy.gpu.LCDCUpdate(data & 0xFF);
                break;
            // STAT
            case 0xFF41:
                this.jsboy.gpu.stat = data & 0xFF;
                break;
            // SCY
            case 0xFF42:
                this.jsboy.gpu._scrollY = data & 0xFF;
                break;
            // SCX
            case 0xFF43:
                this.jsboy.gpu._scrollX = data & 0xFF;
                break;
            // LY
            case 0xFF44:
                this.jsboy.gpu._ly = 0;
                // this._io[address - 0xFF00] = 0;
                return;
            // LY
            case 0xFF45:
                this.jsboy.gpu._lyc = data & 0xFF;
                // this._io[address - 0xFF00] = 0;
                return;
            // DMA
            case 0xFF46:
                this._transferDMA(data);
                return;
            // WY
            case 0xFF4A:
                this.jsboy.gpu._windowY = data & 0xFF;
                break;
            // WX
            case 0xFF4B:
                this.jsboy.gpu._windowX = data & 0xFF;
                break;
        }

        this._io[address - 0xFF00] = data;

        // Handle Channel 3 PCM write
        if (address >= 0xFF30 && address < 0xFF40) {
            if (this.jsboy.papu.channel3.canPlay)
                this.jsboy.papu.runJIT();
            address = (address & 0xF) << 1;
            this.jsboy.papu.channel3.pcm[address    ] = data >> 4;
            this.jsboy.papu.channel3.pcm[address | 1] = data & 0xF;
        }
    }

    _handleIORead(address) {
        switch (address) {
            // Joypad
            case 0xFF00:
                return this.jsboy.joypad.state;

            // SQUARE W/ SWEEP Channel 1
            // NR10
            case 0xFF10:
                return this.jsboy.papu.channel1.registers.NR10._value;
            // NR11
            case 0xFF11:
                return this.jsboy.papu.channel1.registers.NR11._value;
            // NR12
            case 0xFF12:
                return this.jsboy.papu.channel1.registers.NR12._value;
            // NR13
            case 0xFF13:
                return this.jsboy.papu.channel1.registers.NR13._value;
            // NR14
            case 0xFF14:
                return this.jsboy.papu.channel1.registers.NR14._value;

            // SQUARE Channel 2
            // NR20 UNUSED
            case 0xFF15:
                return 0xFF;
            // NR21
            case 0xFF16:
                return this.jsboy.papu.channel2.registers.NR21._value;
            // NR22
            case 0xFF17:
                return this.jsboy.papu.channel2.registers.NR22._value;
            // NR23
            case 0xFF18:
                return this.jsboy.papu.channel2.registers.NR23._value;
            // NR24
            case 0xFF19:
                return this.jsboy.papu.channel2.registers.NR24._value;
            
            // WAVE Channel 3
            // NR30
            case 0xFF1A:
                return this.jsboy.papu.channel3.registers.NR30._value;
            // NR31
            case 0xFF1B:
                return this.jsboy.papu.channel3.registers.NR31._value;
            // NR32
            case 0xFF1C:
                return this.jsboy.papu.channel3.registers.NR32._value;
            // NR33
            case 0xFF1D:
                return this.jsboy.papu.channel3.registers.NR33._value;
            // NR34
            case 0xFF1E:
                return this.jsboy.papu.channel3.registers.NR34._value;

            // NOISE Channel 4
            // NR40 UNUSED
            case 0xFF1F:
                return 0xFF;
            // NR41
            case 0xFF20:
                return this.jsboy.papu.channel4.registers.NR41._value;
            // NR42
            case 0xFF21:
                return this.jsboy.papu.channel4.registers.NR42._value;
            // NR43
            case 0xFF22:
                return this.jsboy.papu.channel4.registers.NR43._value;
            // NR44
            case 0xFF23:
                return this.jsboy.papu.channel4.registers.NR44._value;

            // STAT
            case 0xFF41:
                return this.jsboy.gpu.stat;
            // LY
            case 0xFF44:
                return this.jsboy.gpu._ly;
            // LYC
            case 0xFF45:
                return this.jsboy.gpu._lyc;
            // DMA Request - Write Only
            case 0xFF46:
                return 0xFF;
        }
        return this._io[address - 0xFF00];
    }

    _transferDMA(data) {
        // TODO: CHECK
        let address = data << 8;
        let [ array, offset ] = this._getSector(address);
        let start = address - offset, end = start + this._oam.length;
        this._oam.set(array.slice(start, end));
    }

    _getSector(address) {
        if (address < 0x8000) {
            // ROM
            return [ this.rom.data, 0 ];
        } else if (address >= 0x8000 && address < 0xA000) {
            // VRAM
            return [ this._vram, 0x8000 ];
        } else if (address >= 0xA000 && address < 0xC000) {
            // External WRAM
            return [ this._eram, 0xA000 ];
        } else if (address >= 0xC000 && address < 0xE000) {
            // WRAM
            return [ this._wram, 0xC000 ];
        } else if (address >= 0xE000 && address < 0xFE00) {
            // ECHO
            return [ this._wram, 0xE000 ];
        } else if (address >= 0xFE00 && address < 0xFEA0) {
            // OAM
            return [ this._oam, 0xFE00 ];
        } else if (address >= 0xFF00 && address < 0xFF80) {
            // IO
            return [ this._io, 0xFF00 ];
        } else if (address >= 0xFF80 && address < 0xFFFF) {
            // HRAM
            return [ this._hram, 0xFF80 ];
        } else if (address === 0xFFFF) {
            // IE Register
            return [ this._ie, 0xFFFF ];
        }
    }

}
