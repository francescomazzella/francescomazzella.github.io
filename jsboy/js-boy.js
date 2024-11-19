const EMULATOR_CONFIGURATION = {
    clockSpeed: 0x400000, // ‭4194304‬
    screenRefreshRate: (0x400000 / 60) | 0,

}

const EMULATOR_STATUS = {
    stop: 0,
    play: 1,
    pause: 2,
    frame: 3,
}

const TIMER_FREQUENCY = {
    0: 1024, // 4096,
    1: 16, // 262144,
    2: 64, // 65536,
    3: 256, // 16384,
}

const INTERRUPTS = {
    0x01: { type: 'V-Blank', address: 0x0040, },
    0x02: { type: 'LCDC', address: 0x0048, },
    0x04: { type: 'Timer', address: 0x0050, },
    0x08: { type: 'Serial Transfer Complete', address: 0x0058, },
    0x10: { type: '10-13 Pins Falling Edge (Joypad)', address: 0x0060, },

    VBlank: 0x01,
    LCDC: 0x02,
    Timer: 0x04,
    STC: 0x08,
    Joypad: 0x10,
}

class JSBoy extends ClassEventsES6 {
    constructor(canvasContainer, rom = undefined, debugCanvasContainer) {

        super();

        this._raf;
        this._breakpoints = [];
        this._skipBreakpoint = false;

        this._dividerCounter = 0;
        this._timerCounter = 0;

        this._biosMode = true;

        /** @type {boolean} Interrupts Master Enable */
        this.ime = false;
        this._imePending = false;

        this.halted = false;
        this.stopped = false;
        this.gbcMode = false;


        this.status = EMULATOR_STATUS.stop;

        this.cpu = new CPU(this);
        this.memory = new Memory(this, rom);
        this.gpu = new GPU(this, canvasContainer, debugCanvasContainer);
        this.joypad = new Joypad(this, true);
        this.papu = new PAPU(this);

        this.turbo;

        // this.initialize();

    }

    /**
     * Resets the emulator and all its components (Memory, CPU, Screen&hellip;)
     * @param {boolean} initialized If set the Memory will be initialized with the start-up values
     */
    reset(initialized = true) {
        this.status = EMULATOR_STATUS.stop;
        this.cpu.reset();
        this.memory.reset();
        this.gpu.reset();

        this._dividerCounter = 0;
        this._timerCounter = 0;

        this.halted = false;
        this.stopped = false;
        this.ime = false;
        this._imePending = false;

        if (initialized) {
            this.initialize();
        } else {
            this._biosMode = true;
        }
    }

    loadRom(data) {
        this.reset();
        this.memory.loadRom(data);
    }

    initialize() {
        this._biosMode = false;

        this.cpu.registers.af = 0x01B0;
        this.cpu.registers.bc = 0x0013;
        this.cpu.registers.de = 0x00D8;
        this.cpu.registers.hl = 0x014D;
        this.cpu.sp = 0xFFFE;
        this.cpu.pc = 0x0100;

        this.memory.write(0xFF05, 0x00);
        this.memory.write(0xFF06, 0x00);
        this.memory.write(0xFF07, 0x00);
        this.memory.write(0xFF10, 0x80);
        this.memory.write(0xFF11, 0xBF);
        this.memory.write(0xFF12, 0xF3);
        this.memory.write(0xFF14, 0xBF);
        this.memory.write(0xFF16, 0x3F);
        this.memory.write(0xFF17, 0x00);
        this.memory.write(0xFF19, 0xBF);
        this.memory.write(0xFF1A, 0x7F);
        this.memory.write(0xFF1B, 0xFF);
        this.memory.write(0xFF1C, 0x9F);
        this.memory.write(0xFF1E, 0xBF);
        this.memory.write(0xFF20, 0xFF);
        this.memory.write(0xFF21, 0x00);
        this.memory.write(0xFF22, 0x00);
        this.memory.write(0xFF23, 0xBF);
        this.memory.write(0xFF24, 0x77);
        this.memory.write(0xFF25, 0xF3);
        this.memory.write(0xFF26, 0xF1);
        this.memory.write(0xFF40, 0x91);
        this.memory.write(0xFF42, 0x00);
        this.memory.write(0xFF43, 0x00);
        this.memory.write(0xFF45, 0x00);
        this.memory.write(0xFF47, 0xFC);
        this.memory.write(0xFF48, 0xFF);
        this.memory.write(0xFF49, 0xFF);
        this.memory.write(0xFF4A, 0x00);
        this.memory.write(0xFF4B, 0x00);
        this.memory.write(0xFFFF, 0x00);

        this.papu.reset();
        this.papu.initStartState();
    }

    step() {
        if (this.status == EMULATOR_STATUS.play) {
            this.status = EMULATOR_STATUS.pause;
        } else {
            this._update(this);
        }
    }

    frame() {
        if (this.status != EMULATOR_STATUS.play) {
            this.status = EMULATOR_STATUS.frame;
            this._update(this);
        } else
            this.status = EMULATOR_STATUS.frame;
    }

    /**
     * Toggles between play/pause
     */
    play() {
        if (this.status != EMULATOR_STATUS.play) {
            this.status = EMULATOR_STATUS.play;
            this._update(this);
        } else {
            this.status = EMULATOR_STATUS.pause;
            cancelAnimationFrame(this._raf);
        }
    }

    _update(self = this) {

        let vBlanked = false;

        mainloop:
        do {
            if (self._biosMode && self.cpu.pc >= 0x100)
            self._biosMode = false;

            do {
                let cycles = 1;
                if (!self.halted && !self.stopped)
                    cycles = self.cpu.execute();
                
                self._updateTimers(cycles);
                vBlanked = self.gpu.update(cycles);
                self._interrupts();

                if (self._imePending) {
                    self._imePending = false;
                    self.ime = true;
                }
                if (!self.stopped) {
                    this.papu.audioTicks += cycles;
                    this.papu.runJIT();
                }
            } while (self.halted || self.stopped);

            if (!self._skipBreakpoint) {
                if (self._breakpoints.length) {
                    for (let b of self._breakpoints) {
                        if (!b.enabled)
                            continue;
                        if (self.cpu.pc === b.index && !b.condition ||
                            self.cpu.pc === b.index && b.condition) {
                                self.status = EMULATOR_STATUS.pause;
                                self._skipBreakpoint = true;
                                console.log('BREAKPOINT hit at', self.cpu.pc.toString(16).padStart(4, 0))
                                break mainloop;
                        }
                    }
                }
            } else {
                self._skipBreakpoint = false;
            }

            
            if (self.status != EMULATOR_STATUS.play &&
                self.status != EMULATOR_STATUS.frame) {
                break;
            }

        } while (!vBlanked && !self.halted && !self.stopped);

        if (vBlanked) {
            self.gpu.render();
        }

        // self.gpu.renderBackground();

        self.trigger('update');

        
        if (self.status == EMULATOR_STATUS.play) {
            if (!self.turbo) {
                self._raf = requestAnimationFrame(() => self._update(self));
            } else {
                setZeroTimeout(() => self._update(self));
            }
        } else if (self.status == EMULATOR_STATUS.frame)
            self.status = EMULATOR_STATUS.pause;

    }

    _updateTimers(cycles) {
        
        if ((this._dividerCounter += cycles) >= 256) {
            this._dividerCounter -= 256;
            this.memory._io[0x0004]++;
        }

        // Timer is enabled
        if (this.memory._io[0x0007] & 0x4) {
            this._timerCounter -= cycles;

            if (this._timerCounter <= 0) {

                this._timerCounter += TIMER_FREQUENCY[this.memory._io[0x0007] & 0x3];

                // TODO: REMOVE?
                if (isNaN(this._timerCounter)) {
                    console.error('CHE SUCCEDE?');
                    debugger;
                }

                if (++this.memory._io[0x0005] > 255) {
                    // Request Timer Interrupt by setting bit 2 of Interrupt Flag (IF)
                    this._requestInterrupt(INTERRUPTS.Timer);
                }

            }
        }
    }

    _interrupts() {
        if (this.ime) {
            // Read Interrupt Flag (IF) for requests
            let requests = this.memory._io[0x000F];
            if (requests) {
                // Check each request and Interrupt if Enabled in Interrupt Enable (IE) 0xFFFF
                let enabled = this.memory._ie[0];
                for (let i = 0; i < 5; i++) {
                    if ((requests & (1 << i)) && (enabled & (1 << i))) {
                        // Automatically disable IME
                        this.ime = false;
                        // Disable HALT and STOP modes
                        this.halted = false;
                        this.stopped = false;
                        // TReset the interrupt request flag IF
                        this.memory._io[0x000F] &= ~(1 << i);

                        // Get Interrupt info
                        let interrupt = INTERRUPTS[1 << i];

                        // console.log('INTERRUPT:', interrupt.type, `cur PC: ${this.cpu.pc.toString(16)}`);
                        
                        // If current instruction is HALT, skip it after Interrupt execution
                        if (this.memory.read(this.cpu.pc) === 0x76) {
                            this.cpu.pc++;
                        }

                        // Save PC to Stack and execute Interrupt Routine
                        this.cpu.sp -= 2;
                        this.memory.writeShort(this.cpu.sp, this.cpu.pc);
                        this.cpu.pc = interrupt.address;
                        break;
                    }
                }
            }
        }
    }

    _requestInterrupt(interrupt) {
        this.memory._io[0x000F] |= interrupt;
        this.stopped = false;
        if (this.halted)
            this.halted = ((this.memory._io[0x000F] & this.memory._ie[0]) == 0);
    }

    exportState() {
        return {
            c: this.cpu.state,
            m: this.memory.state,
            g: this.gpu.state,
            b: this._biosMode,
        };
    }

    importState(state) {
        this.reset(false);
        this.cpu.state = state.c;
        this.memory.state = state.m;
        this.gpu.state = state.g;
        this._biosMode = state.b;
    }


}